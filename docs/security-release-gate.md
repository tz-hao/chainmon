# ChainMon Public Playtest Security Release Gate

## Scope and decision

This record covers the dependency-security exception accepted for the ChainMon
public playtest on 2026-08-31. It is intentionally limited to the current
release branch and does not remove the requirement to reassess the issue when
the build chain or CSS input model changes.

`npm audit --omit=dev --json` reports zero critical findings and one high
finding: a transitive `postcss` copy under `next` (`<= 8.5.22`). The relevant
advisories are the attacker-controlled `sourceMappingURL` file-disclosure
findings, including `GHSA-6g55-p6wh-862q` and `GHSA-r28c-9q8g-f849`.

**Decision: accepted for the public playtest as a build-time, non-production-
reachable exception.** The project will not run `npm audit fix --force`, make a
Next.js major-version change, or add a manual PostCSS override solely for this
exception.

## Why the current application is not exposed at runtime

- PostCSS is configured only in the Next.js/Tailwind build pipeline.
- The application imports a fixed repository-owned `globals.css` from the root
  layout; it does not compile, transform, or load user-provided CSS at request
  time.
- There is no stylesheet upload, CSS editor, source-map upload, or other
  attacker-controlled CSS input path in the application source.
- The affected code is therefore not on a browser request, API request, wallet,
  or game-play execution path. Exploitation would require a future build flow
  to process attacker-controlled CSS or source-map comments.

## Controls and re-evaluation triggers

- Keep production source changes reviewed and run the release regression suite
  before a production deployment.
- Do not introduce user-controlled CSS, a CSS upload/editor, or a custom CSS
  compilation service without reopening this assessment.
- Reassess immediately when upgrading Next.js/PostCSS, changing Vercel build
  behavior, or when a new advisory changes the affected package or attack
  preconditions.
- Treat any new runtime CSS transformation or source-map ingestion as a
  production-release blocker until it is reviewed.

## Release-gate status

- Classification: `KNOWN TRANSITIVE BUILD-TIME ADVISORY`; `NOT PRODUCTION
  REACHABLE`; `RISK ACCEPTED FOR PUBLIC PLAYTEST`.
- Critical production dependency findings: `0`.
- High production dependency findings: `1`, accepted under this documented
  build-time exception.
- Moderate finding: tracked through the direct `next` dependency advisory and
  not silently remediated by a major-version upgrade during the playtest freeze.
