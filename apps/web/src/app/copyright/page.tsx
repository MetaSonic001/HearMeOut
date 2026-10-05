import { LegalPage } from "@/components/marketing/legal"
import { SITE } from "@/lib/config"
import { pageMetadata } from "@/lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Copyright and content rights",
  description: "How HearMeOut treats copyright: use it for content you have the right to listen to, and how rights holders can contact us.",
  path: "/copyright",
})

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright and content rights" updated="October 2026">
      <p>
        HearMeOut is a tool for personal listening. We respect creators, and we ask you to do the same.
      </p>

      <h2>For users</h2>
      <ul>
        <li>Use HearMeOut with content you wrote, own, have purchased for personal use, or that is openly licensed or in the public domain.</li>
        <li>Audio you create is for your private listening. Do not publish, share or sell it unless you hold the rights to do so.</li>
        <li>Documents are private to you. There are no public pages or links for user content.</li>
        <li>HearMeOut cannot open DRM-protected files and does not remove DRM.</li>
      </ul>

      <h2>For rights holders</h2>
      <p>
        If you believe content on HearMeOut infringes your rights, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with: the work concerned, enough detail for us to locate the content, your contact details, and a statement that you are the rights holder or authorised to act for them. Because documents are private to their owners, we may act by removing the specific document and warning or suspending the account involved.
      </p>
    </LegalPage>
  )
}
