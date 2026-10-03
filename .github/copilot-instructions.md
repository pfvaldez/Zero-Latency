# Copilot instructions: Ask Noor

These mirror `CLAUDE.md`. If they ever disagree, `CLAUDE.md` wins.

## Context
Offline tour companion for a small coffee-farm tourism operator (Noor). World Bank "Small AI for Development," Track C: Tourism. Guests hear Noor's own recordings with checked subtitles, ask questions answered only with her recordings, give feedback and order coffee. Noor gets a monthly text from a checked template.

## Never do these
- Call any text-generation model from `apps/web`. The guest app only plays Noor's recordings and shows checked text.
- Show unchecked translations, facts, recipes or templates to guests.
- Play a matched clip without the guest's confirmation.
- Send a safety or health question to the matcher, or store it.
- Put service-role keys, Groq keys or ElevenLabs keys in client code.
- Collect names, phone numbers or emails.
- Use npm, yarn or pnpm. Use Bun.
- Use Node 16. Use Node 24 LTS.

## Always do these
- Keep domain logic in `packages/core` (pure functions, no I/O, fully tested).
- In `apps/web`, components render, hooks hold view state, services do I/O. Inject services through `ServicesProvider`.
- Depend on interfaces (`Matcher`, `PackRepository`, `Outbox`, `SyncService`, `Scanner`, `AudioPlayer`), not implementations.
- Validate every boundary with Zod.
- Add or update tests with every change. Run `bun run test` and, for guest-app changes, `bun run e2e`.
- Respect `prefers-reduced-motion`. Keep GSAP to the subtitle progress timeline.
- Label stand-ins and synthetic data in demo mode.

## Commands
`bun install` · `bun run dev` · `bun run test` · `bun run e2e` · `bun run check` · `bun run typecheck` · `bunx supabase start`

## Style
TypeScript strict, Biome formatting, small functions, descriptive names, no `any`, no default exports except React route components.
