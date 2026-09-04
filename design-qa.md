# ChainMon Collection Visual QA

## Scope and source

- Scope: Collection (`/monsters`), Team (`/team`), Protocol Rift Hub / deployment / route (`/rift`), Battle, Capture, and the Evolution protocol panel on the owned monster detail route. Each scope was reviewed only after its implementation turn in the agreed page order.
- Source visual truth: `C:\Users\71546\AppData\Local\Temp\codex-clipboard-3393f2a3-51b2-4f63-adb4-8fcb7becee5f.png`.
- Source pixels and density: 256 x 171 px, treated as a 1x pixel-art reference.
- Source state: dense monster roster with a dark navy game surface, thin pixel dividers, compact information hierarchy, saturated monster pixels, and bottom navigation language.

## Browser-rendered implementation evidence

- Route and state: `/monsters`, local QA-only memory session with three owned monsters and the full 28-species Dex. No production database, wallet action, or gameplay state was used.
- Desktop: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\collection-1440x900.png` — 1440 x 900 CSS px, DPR 1, browser PNG 1440 x 900 px.
- Tablet: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\collection-768x512.png` — 768 x 512 CSS px, DPR 1, browser PNG 768 x 512 px.
- Mobile: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\collection-390x844.png` — 390 x 844 CSS px, DPR 1, browser PNG 390 x 844 px.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\collection-reference-comparison.png`. The reference is nearest-neighbor enlarged to 768 x 513 and placed above the normalized desktop implementation capture.

## State and interaction evidence

- Default Dex grid: 28 species cards at all three viewport sizes.
- Owned filter: keyboard focus reached the button; hover and click were exercised; `aria-pressed` became `true`; visible cards changed from 28 to 3.
- Image verification: every one of the 28 sprites was brought into view before inspection; zero incomplete or zero-natural-size images.
- Asset responses at image paths: zero 4xx responses.
- Console errors: 0 at 1440 x 900, 768 x 512, and 390 x 844.
- Horizontal overflow: none (`scrollWidth === clientWidth`) at all three viewport sizes.
- Responsive shell: desktop/tablet bottom navigation is hidden; mobile bottom navigation is visible and the Dex remains two columns.

## Full-view comparison

The reference and Collection do not represent the same product screen or data state, so their panel geometry is not judged as a literal pixel-for-pixel match. The combined input is used to judge the requested shared visual system: deep blue-black background, thin square pixel borders, compact dense spacing, restrained chrome, sharp pixel sprites, muted locked state, and amber/green state accents. The implementation carries those visible rules without using the reference as a background or overlay.

- Desktop: centered game-width frame; six consistent card columns; 128 px sprite wells; names, rarity, and owned/locked state remain readable without dashboard statistics.
- Tablet: four-column compact Dex remains intact above the fold; filter rows wrap without clipping.
- Mobile: intentionally reflows to two columns; compact filter rows and the fixed game navigation stay within 390 px.

## Focused region comparison

Focused review was required because sprites, controls, and mobile navigation are too small to judge only in the full view.

- Sprite wells: all use real canonical raster sprites with `image-rendering: pixelated`, `object-contain`, and equal 128 px visual boxes. No CSS, emoji, or generic placeholder monsters are visible.
- Card surface and states: square dark panels use thin low-contrast borders; owned cards retain saturated species color while locked cards are clearly muted without hiding their silhouette.
- Filter/navigation controls: active state uses a thin amber pixel border; controls have keyboard focus support; mobile bottom navigation follows the reference's compact game-bar rhythm rather than a rounded SaaS tab bar.

## Findings

No actionable P0, P1, or P2 visual findings remain for the Collection scope.

### Follow-up polish

- [P3] The Collection intentionally uses single-species Dex cards instead of the reference roster's three-stage mini-strips; this is an intentional information-architecture adaptation and is not a visual QA blocker.

## Comparison history

1. Initial iteration: browser capture was blocked by the normal local memory-mode authentication boundary. No visual pass was issued.
2. QA-only recovery: user explicitly authorized a local, memory-only seeded session fixture. The fixture uses existing canonical data and is not production-accessible.
3. First rendered comparison: the app supplied a missing favicon, causing a single development-console 404. A real app icon derived from the canonical FireCub pixel sprite was added; this eliminated the error without changing the registry or species assets.
4. Final comparison: the three exact browser captures above were taken in local Chromium at DPR 1. All required Collection interaction, image, console, and overflow checks passed.

## Implementation checklist

- [x] 28-card, compact, equal-height Collection Dex
- [x] Canonical sharp pixel sprites in a consistent visual box
- [x] Name, rarity, and owned/locked state only in the grid
- [x] Hover, focus, click, responsive layout, and filters exercised
- [x] Browser QA at 1440 x 900, 768 x 512, and 390 x 844

## Team stage visual QA

- Browser evidence: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\team-1440x900.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\team-768x512.png`, and `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\team-390x844.png` were captured at their named CSS viewports and DPR 1.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\team-reference-comparison.png` places the same nearest-neighbor reference capture above the normalized Team desktop screenshot.
- Full view: the former small dashboard rows were replaced by three equal large deployment panels (Lead, Wing, Anchor), each with a centered canonical battle sprite, level, element, rarity, and vitality bar. The reserve is now a compact secondary roster rather than a competing dashboard column.
- Responsive behavior: desktop and tablet use a three-panel formation; mobile becomes a deliberate vertical formation with full-width sprite wells and the fixed pixel bottom navigation. No overlap, clipping, or horizontal overflow was found at 1440 x 900, 768 x 512, or 390 x 844.
- Interaction evidence: keyboard focus reached Remove; removing FireCub exposed the empty-slot state; selecting the FireCub reserve card restored the slot and disabled the duplicate reserve entry. No persistence action was invoked during this interaction check.
- Images, asset responses, and console: zero broken images, zero image 4xx responses, and zero console errors at all three target viewports.
- Findings: no actionable P0, P1, or P2 visual findings remain for the Team scope. The reference does not depict a team-management screen, so the three-slot composition is an intentional functional adaptation of its visual language.
- Team stage result: passed

## Rift Hub / Route stage visual QA

- Browser evidence: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\rift-hub-1440x900.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\rift-hub-768x512.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\rift-hub-390x844.png`, plus same-size `rift-team-select-*`, `rift-select-*`, and `rift-route-*` captures. Every capture uses its named CSS viewport and DPR 1.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\rift-reference-comparison.png` places the nearest-neighbor enlarged source above the normalized Rift Hub desktop capture.
- Full view: the old gradient hero, dossier, concept-tag dashboard, rounded cards, and SVG map canvas were removed from this path. The Hub now contains exactly four large biome panels with canonical featured battle sprites and one compact eight-step route preview. The live route is a dense ordered board rather than an eight-button card grid.
- Deployment / confirmation: the transition preserves the existing selection and run-state callbacks, but now uses square roster cards, canonical battle sprites, three clear field slots, and a compact route-confirmation surface. No rules, seed generation, monster registry, data source, or battle/capture flow was changed.
- Responsive behavior: at 1440 x 900 the Hub uses a two-by-two biome board; at 768 x 512 it maintains the two-column game surface; at 390 x 844 it becomes one compact panel per row and retains the fixed pixel navigation. The route board remains a single vertical progression at all sizes. `scrollWidth === clientWidth` at all three exact sizes.
- Interaction evidence: keyboard focus reached both a Hub route action and the first available route node. The local QA-only flow successfully traversed Hub → deployment → route confirmation → generated route. Entering the available node opened its event state (three buttons including the two decision choices) with zero console errors. No event choice, battle, capture, persistence action, wallet action, or production data was invoked.
- Images, assets, and console: zero broken images, zero image 4xx responses, and zero console errors at all three target viewports. The canonical featured sprites are rendered through `PixelMonster` at native 64 px dimensions, preserving hard pixel edges.
- Findings: no actionable P0, P1, or P2 visual findings remain for this Rift Hub / Route scope. The source is a roster reference rather than a route screen; the judgement applied its shared visual language—dense navy game planes, thin square borders, restrained colored states, compact hierarchy, and sharp sprites—rather than copying its content structure.
- Rift Hub / Route stage result: passed

## Battle stage visual QA

- Browser evidence: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\battle-hub-1440x900.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\battle-hub-768x512.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\battle-hub-390x844.png`, and same-size `battle-arena-*` captures. Each is a DPR 1 browser capture at its named CSS viewport.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\battle-reference-comparison.png` combines the enlarged source truth with the normalized Battle Arena desktop capture.
- Full view: the Battle hub is now a compact field terminal with a three-creature deployment line. The arena no longer uses two matching dashboard cards or a central VS component. It is a JRPG-style scene: hostile name/level/HP at the top, hostile canonical sprite at upper-right, player canonical sprite at lower-left, player HUD at lower-right, compact reserve strips, and the command pad beneath the field.
- Responsive behavior: desktop preserves the upper-right / lower-left scene placement; tablet preserves the complete field surface without horizontal overflow; mobile deliberately retains enemy-top and player-lower composition, then places command controls after the field. The fixed mobile pixel navigation remains visible at 390 x 844.
- Interaction evidence: keyboard focus reached Start Battle and Skill. In the QA-only memory session, Start Battle opened a new local match; Skill expanded the two actual skills; Switch exposed the actual reserve-selection affordance; a Defend command resolved server-authoritatively and advanced the visible turn from 1 to 2. No production data, wallet, capture, or economy action was invoked.
- Images, assets, and console: zero broken images, zero image 4xx responses, zero console errors, and no horizontal overflow at 1440 x 900, 768 x 512, or 390 x 844. Primary battle sprites use integer 128 px or 192 px `PixelMonster` rendering; no CSS or placeholder creature is used.
- Findings: no actionable P0, P1, or P2 visual findings remain for the Battle scope. The neutral field uses dark pixel-grid depth without gradients, glow, rounded SaaS cards, or Web3 dashboard chrome.
- Battle stage result: passed

## Capture stage visual QA

- Browser evidence: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\capture-1440x900.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\capture-768x512.png`, and `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\capture-390x844.png` were captured during a real local Rift capture route at the named CSS viewports and DPR 1.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\capture-reference-comparison.png` puts the nearest-neighbor source reference above the normalized desktop capture screen.
- Full view: both the standard encounter component and the active Rift capture component now use the same capture composition: the canonical wild monster is the center of a dark pixel field, with name/level above, a real HP bar and status frame below, and a separate inventory row of three game-item capture capsules. The former rounded split dashboard, conic progress ring, glow, and generic card treatment are removed.
- Responsive behavior: desktop keeps the centered capture scene and three inventory items in one row. Tablet deliberately reduces only the scene height while preserving an integer 128 px sprite and exposing the inventory header within the 768 x 512 viewport. Mobile keeps the monster at the top, HP/status below it, and capture capsules in a vertical game-inventory sequence with fixed pixel navigation.
- Interaction evidence: the local QA-only flow traversed Hub → team → route → event decision → unlocked capture node. Keyboard focus reached Basic Capsule, and all three server-backed inventory entries were visible and enabled with their actual quantity and calculated lock chance. No ball was thrown, so no capture outcome, inventory consumption, or collection persistence action was invoked.
- Images, assets, and console: zero broken images, zero image 4xx responses, zero console errors, and no horizontal overflow at 1440 x 900, 768 x 512, or 390 x 844. The focal creature uses canonical `PixelMonster` at 128 px on mobile/tablet and 192 px on desktop; no CSS placeholder creature is present.
- Findings: no actionable P0, P1, or P2 visual findings remain for the Capture scope. The screen reads as a game encounter rather than a Web3 or analytics dashboard.
- Capture stage result: passed

## Evolution stage visual QA

- Browser evidence: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\evolution-1440x900.png`, `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\evolution-768x512.png`, and `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\evolution-390x844.png` were captured at their named CSS viewports and DPR 1 from the FireCub owned-monster detail route in the local QA-only memory session.
- Combined comparison input: `C:\Users\71546\Desktop\dk\chainmon\artifacts\visual-qa\evolution-reference-comparison.png` places the nearest-neighbor source truth and the rendered Evolution screen in one review image.
- Full view: Evolution is now a single compact game protocol surface rather than a set of rounded statistic cards. It presents the real FireCub line as Stage 1 → Stage 2 → Stage 3 with the canonical FireCub, FireWolf, and InfernoWolf pixels centered symmetrically. The current form has an amber pixel border; future forms are visibly muted; requirements and the real action state are compact secondary information.
- Responsive behavior: desktop and tablet retain three equal stages in one row with native 128 px portrait sprites. At 390 x 844, the line deliberately becomes a vertical compact sequence with native 64 px battle sprites; no sprite is CSS-scaled to a fractional size. The action remains below the route and no horizontal overflow occurs.
- Interaction evidence: the existing evolution eligibility is preserved. In the QA fixture FireCub is level 1, so the action accurately remained disabled as `Requires level 16`; the real action contract and its confirmation form were left unchanged. No evolution, item consumption, persistence action, wallet action, or production data was invoked.
- Images, assets, and console: three real canonical stage sprites were visible at every target viewport; zero broken images, zero image 4xx responses, zero console errors, and `scrollWidth === clientWidth` at 1440 x 900, 768 x 512, and 390 x 844.
- Findings: no actionable P0, P1, or P2 visual findings remain for the Evolution scope. The intentional adaptation is an in-product evolution view, judged against the source's dark navy, thin square borders, dense pixel hierarchy, saturated canonical pixels, and muted state treatment rather than as an overlay or copied background.
- Evolution stage result: passed

final result: passed
