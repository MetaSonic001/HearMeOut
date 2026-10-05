"""Billing endpoints: start checkout, open the customer portal, receive Dodo webhooks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.deps import CurrentIdentity, State, rate_limit
from app.errors import ApiError
from app.schemas import CheckoutRequest

router = APIRouter(tags=["billing"])


@router.post("/v1/billing/checkout", dependencies=[Depends(rate_limit("checkout", 10, 60))])
async def checkout(body: CheckoutRequest, identity: CurrentIdentity, state: State) -> dict[str, str]:
    url = await state.billing.create_checkout(identity, body.product, body.doc_id, body.return_path)
    return {"checkout_url": url}


@router.post("/v1/billing/portal", dependencies=[Depends(rate_limit("portal", 10, 60))])
async def portal(identity: CurrentIdentity, state: State) -> dict[str, str]:
    return {"url": await state.billing.create_portal(identity)}


@router.post("/v1/webhooks/dodo")
async def dodo_webhook(request: Request, state: State) -> dict[str, object]:
    body = await request.body()
    headers = {k: request.headers.get(k, "") for k in ("webhook-id", "webhook-signature", "webhook-timestamp")}
    event = state.billing.verify(body, headers)
    if not headers["webhook-id"]:
        raise ApiError(400, "missing_id", "Missing webhook id.")
    outcome = await state.billing.handle_event(headers["webhook-id"], event)
    return {"received": True, "outcome": outcome}
