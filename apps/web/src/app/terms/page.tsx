import Link from "next/link"

import { LegalPage } from "@/components/marketing/legal"
import { SITE } from "@/lib/config"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Terms of use",
  description: "The rules for using HearMeOut: acceptable use, content rights, payments, limits and warranties.",
  path: "/terms",
})

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 2026">
      <p>By using HearMeOut you agree to these terms. They are written to be read.</p>

      <h2>Using HearMeOut</h2>
      <ul>
        <li>You may use HearMeOut for your own private listening and learning.</li>
        <li>You must have the right to listen to the content you upload. See our <Link href="/copyright">copyright page</Link>.</li>
        <li>You may not share, sell, publish or redistribute audio created with HearMeOut from content you do not own or are not licensed to distribute.</li>
        <li>You may not abuse the service: no automated scraping, attempts to bypass limits, security testing without permission, or uploading unlawful or harmful material.</li>
      </ul>

      <h2>Limits and plans</h2>
      <p>
        Free, guest, per-book and Pro plans have limits described on the <Link href="/pricing">pricing page</Link>, including daily listening time and document size. We may adjust limits to keep the service fair and sustainable, and we will not reduce what you have already paid for during your paid period.
      </p>

      <h2>Payments</h2>
      <p>
        Payments are processed by Dodo Payments, which acts as the seller of record. Pro subscriptions renew until cancelled and can be managed from your account. A per-book unlock is a one-time purchase for one document. If something went wrong with a payment, write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we will help.
      </p>

      <h2>AI-generated content</h2>
      <p>
        Study, revision, explain and quiz modes use AI and can make mistakes. They are learning aids, not professional advice. Check the original document for anything important.
      </p>

      <h2>Availability and warranty</h2>
      <p>
        HearMeOut is provided as is. We work hard to keep it running but do not guarantee uninterrupted service, and to the extent permitted by law we are not liable for indirect losses.
      </p>

      <h2>Ending your use</h2>
      <p>You can stop using HearMeOut and delete your documents or account at any time. We may suspend access that breaks these terms.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalPage>
  )
}
