// HeroBanner.tsx — Generated from Figma via Flint D2C pipeline
// Source: demos/figma-d2c/payloads/hero-banner.json node 1:100
// Library: shadcn/ui
// Generated: 2026-03-26

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function HeroBanner() {
  return (
    <section
      className="flex flex-col items-center justify-center gap-6 w-full px-20 py-24 bg-foreground"
      aria-label="Hero section"
    >
      {/* Beta badge */}
      <Badge
        variant="outline"
        className="bg-primary/15 text-primary border-primary/40 font-medium"
      >
        Now in public beta
      </Badge>

      {/* Headline */}
      <h1 className="text-5xl font-extrabold text-center leading-tight text-background max-w-3xl">
        Ship production-ready UI
        <br />
        without the guesswork
      </h1>

      {/* Description */}
      <p className="text-lg text-center text-muted max-w-2xl leading-relaxed">
        Flint enforces your design system at the AST level — before code reaches production.
        Every token, every component, every brand rule. Deterministically.
      </p>

      {/* CTA group */}
      <div className="flex items-center gap-3" role="group" aria-label="Call to action">
        <Button size="lg" className="bg-primary hover:bg-primary/90">
          Get started free
        </Button>
        <Button size="lg" variant="outline" className="border-border/50 text-background hover:bg-background/10">
          View docs
        </Button>
      </div>

      {/* Trust line */}
      <p className="text-sm text-muted-foreground/70 text-center">
        Trusted by design teams at Vercel, Linear, and Notion.
      </p>
    </section>
  )
}
