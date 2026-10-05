import { LegalPage } from "@/components/marketing/legal"
import { SITE } from "@/lib/config"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: "What HearMeOut collects, how long documents are kept, which services process your text, and how you can delete your data.",
  path: "/privacy",
})

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2026">
      <p>
        HearMeOut turns documents into audio. This page explains in plain language what we collect and why. If anything is unclear, write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>

      <h2>What you give us</h2>
      <ul>
        <li><strong>Documents and text</strong> you paste, upload or link to, and the audio prepared from them.</li>
        <li><strong>Account details</strong> if you sign up: your email address and name, handled by our sign-in provider, Clerk.</li>
        <li><strong>Payment details</strong> are entered on Dodo Payments&apos; checkout. We never see or store your card or UPI details; we receive confirmation that a payment succeeded.</li>
      </ul>

      <h2>How long we keep documents</h2>
      <p>
        Your documents are private to you. Guest documents are deleted after 24 hours, free-account documents after 7 days, and Pro or unlocked documents after 90 days. You can delete any document yourself at any time from the player or your library, which removes the text and audio. Uploads that you have not turned into audio are deleted after a few hours.
      </p>

      <h2>Who processes your content</h2>
      <p>To provide the service, your text is processed by these providers acting on our behalf:</p>
      <ul>
        <li><strong>Speech synthesis services</strong> convert text to audio. Text is sent to the service to be spoken.</li>
        <li><strong>Groq</strong> processes the text of a section when you use Translate, Study, Revision, Explain or Quiz modes, to write the spoken version.</li>
        <li><strong>Supabase</strong> stores your documents and audio in a private database and storage bucket.</li>
        <li><strong>Clerk</strong> handles sign-in. <strong>Dodo Payments</strong> handles payments and acts as the seller of record.</li>
        <li><strong>Vercel</strong> and <strong>Render</strong> host the website and the API.</li>
      </ul>
      <p>Scanned PDFs are read with open-source OCR software running on our own servers: the page images are not sent to any other provider and are not kept after the text has been read.</p>
      <p>Identical passages of text may reuse the same prepared audio to save time. This audio is only reachable through documents that you own.</p>

      <h2>Analytics and cookies</h2>
      <p>
        We count visits and feature use with our own privacy-friendly analytics, which store a random identifier in your browser but no IP address, and we use Vercel Analytics, which does not use cookies. If you choose Allow on the banner, we also use Google Analytics. You can say no and everything still works. Sign-in uses cookies that are needed to keep you signed in.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete any document at any time.</li>
        <li>Ask us to delete your account and data by email.</li>
        <li>Decline Google Analytics on the banner; clear your browser storage to reset your visitor identifier.</li>
      </ul>

      <h2>Children</h2>
      <p>HearMeOut is not directed at children under 13, and we do not knowingly collect their personal information.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way we will update the date above and, where appropriate, tell you on the site.</p>
    </LegalPage>
  )
}
