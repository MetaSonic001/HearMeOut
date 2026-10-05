"""Dodo Payments: checkout sessions, customer portal and verified webhook fulfilment."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from dodopayments import AsyncDodoPayments
from standardwebhooks import Webhook
from standardwebhooks.webhooks import WebhookVerificationError

from app.config import Settings
from app.db.repo import Repo
from app.db.schema import utcnow
from app.errors import ApiError
from app.services.analytics import track
from app.services.identity import Identity

log = logging.getLogger(__name__)
KINDS = ("pro_monthly", "pro_yearly", "book")
RENEWAL_GRACE = timedelta(days=2)


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class Billing:
    def __init__(self, settings: Settings, repo: Repo):
        self.settings = settings
        self.repo = repo
        self.client: AsyncDodoPayments | None = (
            AsyncDodoPayments(bearer_token=settings.dodo_payments_api_key, environment=settings.dodo_environment)
            if settings.dodo_payments_api_key
            else None
        )

    @property
    def enabled(self) -> bool:
        return self.client is not None

    def product_id(self, kind: str) -> str:
        pid = {
            "pro_monthly": self.settings.dodo_product_pro_monthly,
            "pro_yearly": self.settings.dodo_product_pro_yearly,
            "book": self.settings.dodo_product_book,
        }.get(kind, "")
        if not pid:
            raise ApiError(503, "billing_unavailable", "This plan is not available for purchase yet.")
        return pid

    def _return_url(self, return_path: str | None, status: str) -> str:
        path = return_path if return_path and return_path.startswith("/") and not return_path.startswith("//") else "/account"
        joiner = "&" if "?" in path else "?"
        return f"{self.settings.site_url.rstrip('/')}{path}{joiner}checkout={status}"

    async def create_checkout(
        self, identity: Identity, kind: str, doc_id: str | None, return_path: str | None
    ) -> str:
        if self.client is None:
            raise ApiError(503, "billing_unavailable", "Payments are not switched on yet. Please check back soon.")
        if identity.kind != "user" or not identity.user_id:
            raise ApiError(401, "signin_required", "Please sign in or create a free account to continue.")
        if identity.is_admin:
            raise ApiError(409, "already_unlimited", "You are the owner: everything is already free for you.")
        metadata = {"app_user_id": identity.user_id, "kind": kind}
        if kind == "book":
            if not doc_id:
                raise ApiError(422, "doc_required", "Choose which document to unlock.")
            doc = await self.repo.get_document(doc_id)
            if doc is None or not identity.owns(doc["owner_key"]):
                raise ApiError(404, "doc_not_found", "We could not find that document.")
            if doc["owner_key"] != identity.owner_key:
                await self.repo.claim_owner(doc["owner_key"], identity.owner_key)
            if doc["unlocked"]:
                raise ApiError(409, "already_unlocked", "This document is already unlocked.")
            metadata["doc_id"] = doc_id
        elif identity.is_pro:
            raise ApiError(409, "already_pro", "You already have Pro.")
        customer: dict[str, Any] = {}
        user = await self.repo.get_user(identity.user_id)
        if user and user.get("dodo_customer_id"):
            customer["customer_id"] = user["dodo_customer_id"]
        elif identity.email:
            customer["email"] = identity.email
            if identity.name:
                customer["name"] = identity.name
        session = await self.client.checkout_sessions.create(
            product_cart=[{"product_id": self.product_id(kind), "quantity": 1}],
            customer=customer or None,  # type: ignore[arg-type]
            metadata=metadata,
            return_url=self._return_url(return_path, "success"),
        )
        if not session.checkout_url:
            raise ApiError(502, "checkout_failed", "We could not start checkout. Please try again.")
        return session.checkout_url

    async def create_portal(self, identity: Identity) -> str:
        if self.client is None:
            raise ApiError(503, "billing_unavailable", "Payments are not switched on yet.")
        user = await self.repo.get_user(identity.user_id) if identity.user_id else None
        if not user or not user.get("dodo_customer_id"):
            raise ApiError(404, "no_subscription", "There is no subscription to manage yet.")
        portal = await self.client.customers.customer_portal.create(
            user["dodo_customer_id"], return_url=self._return_url("/account", "back")
        )
        return str(portal.link)

    # ---------------------------------------------------------------- webhooks
    def verify(self, body: bytes, headers: dict[str, str]) -> dict[str, Any]:
        secret = self.settings.dodo_webhook_secret
        if not secret:
            raise ApiError(503, "billing_unavailable", "Webhooks are not configured.")
        try:
            payload = Webhook(secret).verify(body, headers)
        except (WebhookVerificationError, ValueError) as exc:
            raise ApiError(401, "invalid_signature", "Invalid webhook signature.") from exc
        if not isinstance(payload, dict):
            payload = json.loads(body)
        return payload

    async def handle_event(self, event_id: str, event: dict[str, Any]) -> str:
        """Apply a verified event. Every operation is idempotent, so redelivery is harmless."""
        etype = str(event.get("type", ""))
        data: dict[str, Any] = event.get("data") or {}
        outcome = "ignored"
        if etype == "payment.succeeded":
            outcome = await self._on_payment(data)
        elif etype in {"subscription.active", "subscription.renewed", "subscription.plan_changed"}:
            outcome = await self._on_subscription_active(data)
        elif etype == "subscription.cancelled":
            outcome = await self._on_subscription_cancelled(data)
        elif etype in {"subscription.expired", "subscription.failed"}:
            outcome = await self._on_subscription_ended(data)
        await self.repo.mark_webhook_seen(event_id, etype)
        return outcome

    async def _find_user_id(self, data: dict[str, Any]) -> str | None:
        meta = data.get("metadata") or {}
        if meta.get("app_user_id"):
            return str(meta["app_user_id"])
        sub_id = data.get("subscription_id")
        if sub_id:
            row = await self.repo.user_by_subscription(str(sub_id))
            if row:
                return str(row["id"])
        return None

    async def _remember_customer(self, user_id: str, data: dict[str, Any]) -> None:
        customer = data.get("customer") or {}
        fields: dict[str, Any] = {}
        if customer.get("customer_id"):
            fields["dodo_customer_id"] = customer["customer_id"]
        if data.get("subscription_id"):
            fields["dodo_subscription_id"] = data["subscription_id"]
        if fields:
            await self.repo.upsert_user(user_id)
            await self.repo.update_user(user_id, **fields)

    async def _on_payment(self, data: dict[str, Any]) -> str:
        user_id = await self._find_user_id(data)
        meta = data.get("metadata") or {}
        kind = str(meta.get("kind") or "")
        payment_id = str(data.get("payment_id") or "")
        if not user_id or not payment_id or kind not in KINDS:
            return "ignored"
        await self.repo.upsert_user(user_id)
        await self._remember_customer(user_id, data)
        fresh = await self.repo.record_purchase(
            {
                "id": payment_id,
                "user_id": user_id,
                "doc_id": meta.get("doc_id"),
                "kind": kind,
                "amount": data.get("total_amount"),
                "currency": data.get("currency"),
                "status": "succeeded",
                "created_at": utcnow(),
            }
        )
        if fresh:
            await track(self.repo, "purchase", user_id=user_id, anon_id=user_id, kind=kind, amount=data.get("total_amount"), currency=data.get("currency"))
        if kind == "book" and meta.get("doc_id"):
            doc = await self.repo.get_document(str(meta["doc_id"]))
            if doc:
                await self.repo.unlock_document(doc["id"], doc["owner_key"])
                return "book_unlocked"
        return "payment_recorded" if fresh else "duplicate"

    async def _on_subscription_active(self, data: dict[str, Any]) -> str:
        user_id = await self._find_user_id(data)
        if not user_id:
            return "ignored"
        await self.repo.upsert_user(user_id)
        await self._remember_customer(user_id, data)
        ends = _parse_dt(data.get("next_billing_date")) or (utcnow() + timedelta(days=35))
        await self.repo.update_user(user_id, plan="pro", plan_ends_at=ends + RENEWAL_GRACE)
        return "pro_activated"

    async def _on_subscription_cancelled(self, data: dict[str, Any]) -> str:
        user_id = await self._find_user_id(data)
        if not user_id:
            return "ignored"
        if data.get("cancel_at_next_billing_date"):
            ends = _parse_dt(data.get("next_billing_date")) or utcnow()
        else:
            ends = utcnow()
        await self.repo.update_user(user_id, plan_ends_at=ends)
        return "pro_scheduled_end"

    async def _on_subscription_ended(self, data: dict[str, Any]) -> str:
        user_id = await self._find_user_id(data)
        if not user_id:
            return "ignored"
        await self.repo.update_user(user_id, plan="free", plan_ends_at=utcnow())
        return "pro_ended"

    async def close(self) -> None:
        if self.client is not None:
            await self.client.close()

