"use client"

import { Section } from "@/components/marketing/section"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { FaqItem } from "@/lib/content/core"

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <Accordion className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card px-5">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`}>
          <AccordionTrigger className="py-4 text-base">{item.q}</AccordionTrigger>
          <AccordionContent className="text-base text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function FaqSection({ items, title = "Questions, answered" }: { items: FaqItem[]; title?: string }) {
  return (
    <Section id="faq" eyebrow="FAQ" title={title}>
      <FaqList items={items} />
    </Section>
  )
}
