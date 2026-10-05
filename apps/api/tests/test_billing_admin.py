import base64
import json
import time
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx
from standardwebhooks import Webhook

from app.services import mp3
from tests.conftest import long_text

SECRET_RAW = b"test-webhook-secret-0123456789"
WH_SECRET = "whsec_" + base64.b64encode(SECRET_RAW).decode()
BILLING = {
    "dodo_payments_api_key": "dodo-test-key",
    "dodo_webhook_secret": WH_SECRET,
    "dodo_product_pro_monthly": "pdt_monthly",
    "dodo_product_pro_yearly": "pdt_yearly",
    "dodo_product_book": "pdt_book",
    "site_url": "https://hearmeout.example",
}


def send_webhook(api, event_type: str, data: dict, *, event_id: str | None = None, sign: bool = True):
    body = json.dumps({"type": event_type, "timestamp": datetime.now(UTC).isoformat(), "data": data})
    msg_id = event_id or f"evt_{uuid.uuid4().hex[:10]}"
    headers = {"content-type": "application/json", "webhook-id": msg_id}
    if sign:
        now = datetime.now(UTC)
        headers["webhook-timestamp"] = str(int(now.timestamp()))
        headers["webhook-signature"] = Webhook(WH_SECRET).sign(msg_id, now, body)
    return api.c.post("/v1/webhooks/dodo", content=body, headers=headers)


def iso(delta_days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=delta_days)).isoformat()


# ------------------------------------------------------------------ checkout
def test_checkout_unavailable_until_configured(api):
    r = api.c.post("/v1/billing/checkout", json={"product": "pro_monthly"}, headers=api.user("alice"))
    assert r.status_code == 503 and r.json()["error"]["code"] == "billing_unavailable"
    assert api.c.get("/v1/config").json()["billing"] is False


@respx.mock
def test_checkout_requires_account_and_returns_hosted_url(make_api):
    api = make_api(**BILLING)
    route = respx.post(url__regex=r".*dodopayments\.com/checkouts").mock(
        return_value=httpx.Response(200, json={"session_id": "cks_1", "checkout_url": "https://checkout.dodopayments.com/s/cks_1"})
    )
    guest = api.guest()
    r = api.c.post("/v1/billing/checkout", json={"product": "pro_monthly"}, headers=guest)
    assert r.status_code == 401 and r.json()["error"]["code"] == "signin_required"

    r = api.c.post("/v1/billing/checkout", json={"product": "pro_yearly", "return_path": "/pricing"}, headers=api.user("alice"))
    assert r.status_code == 200 and r.json()["checkout_url"].endswith("cks_1")
    sent = json.loads(route.calls[0].request.content)
    assert sent["product_cart"] == [{"product_id": "pdt_yearly", "quantity": 1}]
    assert sent["metadata"] == {"app_user_id": "user_alice", "kind": "pro_yearly"}
    assert sent["return_url"] == "https://hearmeout.example/pricing?checkout=success"
    assert sent["customer"]["email"] == "user_alice@test.dev"


@respx.mock
def test_book_checkout_checks_ownership_and_open_redirects_are_ignored(make_api):
    api = make_api(**BILLING)
    route = respx.post(url__regex=r".*dodopayments\.com/checkouts").mock(
        return_value=httpx.Response(200, json={"session_id": "cks_2", "checkout_url": "https://checkout.example/2"})
    )
    alice, bob = api.user("alice"), api.user("bob")
    doc = api.create(alice, api.draft(alice, long_text(3))["id"])
    r = api.c.post("/v1/billing/checkout", json={"product": "book"}, headers=alice)
    assert r.status_code == 422 and r.json()["error"]["code"] == "doc_required"
    r = api.c.post("/v1/billing/checkout", json={"product": "book", "doc_id": doc["id"]}, headers=bob)
    assert r.status_code == 404
    r = api.c.post(
        "/v1/billing/checkout", json={"product": "book", "doc_id": doc["id"], "return_path": "//evil.example"}, headers=alice
    )
    assert r.status_code == 200
    sent = json.loads(route.calls[0].request.content)
    assert sent["metadata"]["doc_id"] == doc["id"]
    assert sent["return_url"].startswith("https://hearmeout.example/account")  # protocol-relative path rejected


def test_owner_cannot_buy(make_api):
    api = make_api(**BILLING)
    r = api.c.post("/v1/billing/checkout", json={"product": "pro_monthly"}, headers=api.user("admin"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_unlimited"


# ------------------------------------------------------------------ webhooks
def test_webhook_rejects_missing_or_bad_signature(make_api):
    api = make_api(**BILLING)
    assert send_webhook(api, "payment.succeeded", {}, sign=False).status_code == 401
    body = json.dumps({"type": "subscription.active", "data": {"metadata": {"app_user_id": "user_alice"}}})
    r = api.c.post(
        "/v1/webhooks/dodo",
        content=body,
        headers={"webhook-id": "evt_x", "webhook-timestamp": str(int(time.time())), "webhook-signature": "v1,AAAA"},
    )
    assert r.status_code == 401
    assert api.c.get("/v1/me", headers=api.user("alice")).json()["plan"] == "free"


def test_subscription_lifecycle_grants_and_revokes_pro(make_api):
    api = make_api(**BILLING)
    alice = api.user("alice")
    assert api.c.get("/v1/me", headers=alice).json()["plan"] == "free"
    sub = {
        "subscription_id": "sub_1",
        "customer": {"customer_id": "cus_1", "email": "alice@example.com"},
        "metadata": {"app_user_id": "user_alice", "kind": "pro_monthly"},
        "next_billing_date": iso(30),
    }
    r = send_webhook(api, "subscription.active", sub)
    assert r.status_code == 200 and r.json()["outcome"] == "pro_activated"
    me = api.c.get("/v1/me", headers=alice).json()
    assert me["plan"] == "pro" and me["limits"]["daily_minutes"] == 1200 and me["feed_url"].startswith("http")

    # cancellation at period end keeps access until then
    r = send_webhook(api, "subscription.cancelled", {**sub, "cancel_at_next_billing_date": True})
    assert r.json()["outcome"] == "pro_scheduled_end"
    assert api.c.get("/v1/me", headers=alice).json()["plan"] == "pro"
    # immediate cancellation removes it (subscription id alone identifies the user)
    r = send_webhook(api, "subscription.cancelled", {"subscription_id": "sub_1", "cancel_at_next_billing_date": False})
    assert r.json()["outcome"] == "pro_scheduled_end"
    assert api.c.get("/v1/me", headers=alice).json()["plan"] == "free"
    # renewal brings it back; expiry ends it
    send_webhook(api, "subscription.renewed", sub)
    assert api.c.get("/v1/me", headers=alice).json()["plan"] == "pro"
    send_webhook(api, "subscription.expired", {"subscription_id": "sub_1"})
    assert api.c.get("/v1/me", headers=alice).json()["plan"] == "free"


def test_unknown_events_and_unknown_users_are_acknowledged_but_ignored(make_api):
    api = make_api(**BILLING)
    assert send_webhook(api, "refund.succeeded", {}).json()["outcome"] == "ignored"
    assert send_webhook(api, "subscription.active", {"metadata": {}}).json()["outcome"] == "ignored"


def test_book_purchase_unlocks_that_document_only_and_is_idempotent(make_api):
    api = make_api(**BILLING)
    alice = api.user("alice")
    doc = api.create(alice, api.draft(alice, long_text(115))["id"])  # ~ 2 h of fake audio, more than 60 free minutes
    other = api.create(alice, api.draft(alice, long_text(115))["id"])
    blocked = None
    for i in range(doc["total_chunks"]):
        r = api.c.get(f"/v1/docs/{doc['id']}/chunks/{i}/audio", headers=alice)
        if r.status_code == 402:
            blocked = i
            break
    assert blocked is not None

    payment = {
        "payment_id": "pay_123",
        "total_amount": 9900,
        "currency": "INR",
        "customer": {"customer_id": "cus_9"},
        "metadata": {"app_user_id": "user_alice", "kind": "book", "doc_id": doc["id"]},
    }
    assert send_webhook(api, "payment.succeeded", payment, event_id="evt_same").json()["outcome"] == "book_unlocked"
    assert send_webhook(api, "payment.succeeded", payment, event_id="evt_same").status_code == 200  # redelivery is harmless
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=alice).json()["unlocked"] is True
    for i in range(blocked, min(blocked + 5, doc["total_chunks"])):
        assert api.c.get(f"/v1/docs/{doc['id']}/chunks/{i}/audio", headers=alice).status_code == 200
    # the other document is still metered
    assert api.c.get(f"/v1/docs/{other['id']}/chunks/6/audio", headers=alice).status_code == 402
    # recorded once for revenue analytics
    stats = api.c.get("/v1/admin/stats", headers=api.user("admin")).json()
    assert stats["totals"]["revenue"] == {"INR": 9900} and stats["funnel"]["purchases"] == 1


def test_portal_needs_a_customer(make_api):
    api = make_api(**BILLING)
    r = api.c.post("/v1/billing/portal", headers=api.user("alice"))
    assert r.status_code == 404 and r.json()["error"]["code"] == "no_subscription"


# --------------------------------------------------------------- admin + events
def test_admin_stats_are_owner_only(api):
    assert api.c.get("/v1/admin/stats", headers=api.guest()).status_code == 403
    assert api.c.get("/v1/admin/stats", headers=api.user("alice")).status_code == 403
    assert api.c.get("/v1/admin/stats").status_code == 401
    assert api.c.get("/v1/admin/stats", headers=api.user("admin")).status_code == 200


def collect(api, name: str, **kw):
    headers = {"x-internal-secret": "internal-secret", "x-country": kw.pop("country", "IN"), "x-device": kw.pop("device", "mobile")}
    return api.c.post("/v1/events", json={"name": name, **kw}, headers=headers)


def test_event_ingestion_is_protected(api):
    assert api.c.post("/v1/events", json={"name": "page_view"}).status_code == 403
    assert api.c.post("/v1/events", json={"name": "page_view"}, headers={"x-internal-secret": "wrong"}).status_code == 403
    assert collect(api, "not_allowed").status_code == 422
    assert collect(api, "page_view", path="/", anon_id="a1").json() == {"recorded": True}
    assert collect(api, "page_view", path="/", anon_id="a2", device="bot").json() == {"recorded": False}
    assert api.c.post("/v1/events", json={"name": "Bad Name!"}, headers={"x-internal-secret": "internal-secret"}).status_code == 422


def test_dashboard_numbers_reflect_real_activity(api):
    for anon, path, ref in (("a1", "/", "https://www.google.com/search"), ("a1", "/pricing", ""), ("a2", "/", "https://t.co/x"), ("a3", "/use-cases/pdf-to-audiobook", "")):
        collect(api, "page_view", path=path, referrer=ref, anon_id=anon)
    collect(api, "play_started", anon_id="a1")

    guest = api.guest()
    draft = api.draft(guest, long_text(4))
    api.create(guest, draft["id"], mode="read")
    api.create(guest, draft["id"], mode="study", language="en")
    alice = api.user("alice")
    api.c.get("/v1/me", headers=alice)
    doc = api.create(alice, api.draft(alice, long_text(3))["id"])
    api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=alice)

    stats = api.c.get("/v1/admin/stats", params={"days": 7}, headers=api.user("admin")).json()
    totals = stats["totals"]
    assert totals["visitors"] == 3 and totals["pageviews"] == 4
    assert totals["docs_created"] == 3 and totals["signups"] >= 2  # alice + admin first seen
    assert totals["minutes_listened"] > 0 and totals["users"] >= 2
    assert stats["funnel"]["drafts"] == 2 and stats["funnel"]["plays"] == 1
    assert len(stats["daily"]) == 7 and sum(d["visitors"] for d in stats["daily"]) == 3  # IST day may run ahead of UTC
    top = stats["top"]
    assert {r["label"] for r in top["referrers"]} >= {"google.com", "t.co", "Direct"}
    assert top["countries"][0] == {"label": "IN", "count": 4}
    assert {r["label"] for r in top["modes"]} == {"read", "study"}
    assert top["pages"][0]["label"] == "/"


# ------------------------------------------------------------------------ feed
def make_pro(api, name: str = "alice"):
    send_webhook(
        api,
        "subscription.active",
        {"subscription_id": f"sub_{name}", "metadata": {"app_user_id": f"user_{name}"}, "next_billing_date": iso(30)},
    )


def test_podcast_feed_is_pro_only_and_streams_with_range_support(make_api):
    api = make_api(**BILLING)
    alice = api.user("alice")
    assert api.c.get("/v1/me", headers=alice).json()["feed_url"] is None
    make_pro(api)
    feed_url = api.c.get("/v1/me", headers=alice).json()["feed_url"]
    assert feed_url.startswith("http://localhost:8000/v1/feed/") and feed_url.endswith(".xml")
    token = feed_url.rsplit("/", 1)[1].removesuffix(".xml")

    text = "# One\n\n" + long_text(6) + "\n\n# Two\n\n" + long_text(6)
    doc = api.create(alice, api.draft(alice, text, "Feed Test")["id"])
    assert doc["total_sections"] == 2
    for _ in range(150):  # Pro documents are rendered in the background automatically
        if api.c.get(f"/v1/docs/{doc['id']}", headers=alice).json()["ready_chunks"] == doc["total_chunks"]:
            break
        time.sleep(0.1)

    xml = api.c.get(f"/v1/feed/{token}.xml")
    assert xml.status_code == 200 and xml.headers["content-type"].startswith("application/rss+xml")
    assert xml.text.count("<item>") == 2 and "Feed Test - One" in xml.text and "itunes:duration" in xml.text
    first_url = xml.text.split('<enclosure url="')[1].split('"')[0].replace("http://localhost:8000", "")

    full = api.c.get(first_url)
    assert full.status_code == 200 and full.headers["accept-ranges"] == "bytes"
    assert int(full.headers["content-length"]) == len(full.content) > 1000
    assert mp3.inspect(full.content).duration_ms > 5000
    part = api.c.get(first_url, headers={"range": "bytes=100-299"})
    assert part.status_code == 206 and part.content == full.content[100:300]
    assert part.headers["content-range"] == f"bytes 100-299/{len(full.content)}"
    tail = api.c.get(first_url, headers={"range": "bytes=-64"})
    assert tail.status_code == 206 and tail.content == full.content[-64:]
    assert api.c.get(first_url, headers={"range": "bytes=99999999-"}).status_code == 416

    assert api.c.get("/v1/feed/not-a-token.xml").status_code == 404
    assert api.c.get(first_url.replace(token, "wrong")).status_code == 404


def test_feed_stops_working_when_pro_ends(make_api):
    api = make_api(**BILLING)
    make_pro(api)
    alice = api.user("alice")
    token = api.c.get("/v1/me", headers=alice).json()["feed_url"].rsplit("/", 1)[1].removesuffix(".xml")
    assert api.c.get(f"/v1/feed/{token}.xml").status_code == 200
    send_webhook(api, "subscription.expired", {"subscription_id": "sub_alice"})
    assert api.c.get(f"/v1/feed/{token}.xml").status_code == 402


@pytest.mark.parametrize("path", ["/v1/billing/checkout", "/v1/billing/portal"])
def test_billing_endpoints_need_identity(api, path):
    assert api.c.post(path, json={"product": "book"}).status_code == 401
