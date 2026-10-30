# PS-003 Judge-First Presentation Design

## Intent

Create a maximum 8-slide submission presentation for PS-003, “Small Web Reader: Anonymous Discovery for Independent Blogs.” The audience is the hackathon judging panel, and the deck must make the strongest evidence visible against the rubric: innovation, system design/codebase knowledge, problem understanding, tests, impact/feasibility, and presentation quality.

## Goals

- Explain the problem and why algorithm-free discovery matters.
- Show the product experience and the distinctive privacy-preserving discovery mechanism.
- Demonstrate architecture and data boundaries clearly enough for a technical Q&A.
- Present concrete test and edge-case evidence without claiming unsupported production deployment.
- Explain feasibility, practical use, and next-step readiness.

## Non-goals

- Exhaustively document every source file.
- Claim a verified production deployment or end-to-end browser test that is not present in the repository.
- Present optional infrastructure or future ideas as completed features.
- Exceed 8 slides.

## Constraints

- Use the repository and PS-003 implementation as the source of truth.
- Keep claims aligned with `README.md`, `DESIGN.md`, `PRODUCT.md`, `IMPLEMENTATION_PLAN.md`, source files, and tests.
- Mention the distinction between the Vercel API path and Firebase Functions path when discussing security/deployment.
- Highlight the 70 passing tests and name representative edge-case groups.
- Make the deck useful for a live demo and technical defense.

## Approaches considered

1. **Judge-first evidence deck — chosen**
   - Structure: problem, innovation, architecture, privacy/security, demo journey, tests, impact/feasibility, close.
   - Best fit because the judging rubric rewards balanced proof across technical and product dimensions.
2. **Product-story deck**
   - Stronger emotional narrative and UI emphasis, but risks under-serving the 20-point system-design and 20-point testing categories.
3. **Architecture-first deck**
   - Strong technical detail, but risks making the problem, user value, and innovation less memorable in an 8-slide limit.

## Chosen slide structure

1. **Small Web Reader** — one-line value proposition, audience, and rubric-aligned promise.
2. **The problem** — algorithmic feeds vs. independent blogs; discovery gap; PS-003 requirements.
3. **Our innovation** — anonymous co-subscription discovery, private by default, explicit contribution, no profiles.
4. **System design** — browser/client, fetch boundary, discovery API, Firestore aggregate stores, and local IndexedDB.
5. **How it works** — add feed → parse/extract → cache/read offline → opt in → recommend/contribute; visual product flow.
6. **Trust by construction** — SSRF/App Check/rate limits/sanitization/idempotency and what never leaves the device.
7. **Proof: tests and resilience** — 70 passing tests, representative edge cases, seed audit, and explicit test limitation.
8. **Impact, feasibility, and close** — practical users, deployment options, demo checklist, repository handoff, and final takeaway.

## Visual direction

Use the existing product language: warm paper background, ink typography, sage/ochre/clay accents, editorial serif headings, and restrained technical diagrams. Favor diagrams, metric cards, and short phrases over paragraphs. Include source-file callouts in small text where they strengthen codebase credibility.

## Builder calls

- Produce an editable `.pptx` in the repository’s `artifacts` directory.
- Also produce a concise presenter-notes text file so the team can explain each slide confidently.
- Use only evidence available in the repository; label unsupported production claims as “documented path” rather than “deployed.”
- Include a final slide with demo/repository readiness rather than a separate appendix, because the 8-slide cap is strict.
