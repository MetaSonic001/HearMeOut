import type { Metadata } from "next"

import { ListenClient } from "@/components/player/listen-client"
import { NOINDEX } from "@/lib/seo/metadata"

export const metadata: Metadata = { title: "Listening", ...NOINDEX }

export default async function ListenPage({ params }: PageProps<"/listen/[id]">) {
  const { id } = await params
  return <ListenClient docId={id} />
}
