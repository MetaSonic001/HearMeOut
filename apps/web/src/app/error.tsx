"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">That was our mistake, not yours. Please try again.</p>
      <Button size="lg" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
