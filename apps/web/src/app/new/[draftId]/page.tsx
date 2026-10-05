import type { Metadata } from "next"

import { OptionsClient } from "@/components/options/options-client"
import { NOINDEX } from "@/lib/seo/metadata"

export const metadata: Metadata = { title: "Choose how to listen", ...NOINDEX }

export default async function NewPage({ params }: PageProps<"/new/[draftId]">) {
  const { draftId } = await params
  return <OptionsClient draftId={draftId} />
}
