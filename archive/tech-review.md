# Mimic Feeder Technical Review

> **Archive status (2026-07-09):** Historical technical review and phased remediation plan (Feb 2026).  
> Phases 1–5 code work is **done** in the tree; a few **manual** feel/regression passes were never formally closed.  
> **Do not treat unchecked boxes or “open” findings below as current blockers** without re-checking the code.  
> Superseded for pre-merge work by `PRE_MERGE_PLAN.md` (repo root); agent orientation is in `AGENTS.md`.  
> **Post–this-doc work (2026-07, not listed in original findings):** analytics/Functions/D1 removal, pause freeze (`lastGameplayFrame`) + paused input guards, bomb count single-owner (shadow-bolt path), Playwright Brave playtest, real OG card, safe tooling / html-minifier-terser.

Date: 2026-02-12  
Scope: Full repository static review (logic, code quality, naming, docs drift, build/tooling, maintainability)  
Original status: Phase 1 (High Priority items 1-3) and Phase 2 implemented on 2026-02-12.  
**Archive refresh:** 2026-07-09 (status accuracy only; not a new review).

## Decisions Confirmed by Project Owner

These decisions are treated as requirements for remediation:

1. Achievements should persist across runs and only be earned once (unless browser storage is cleared).
2. Movement must support both `WASD` and arrow keys.
3. Achievements should move off `A` to a non-conflicting key (`K` confirmed).
4. Magnetism should affect only objects that were on screen when activated, and keep affecting those objects until they are eaten/removed.
5. Cooldown is re-use gating only; it is not ability active duration.
6. Project status should be unified toward "playable beta" (not alpha, not "feature complete").

## Findings (Prioritized)

### High Priority

1. Input conflict between movement and achievements.
- Evidence: `A` is currently used for left movement and for opening achievements.
- Impact: accidental achievements screen opens during gameplay; control friction.
- Files: `src/js/player.js:30`, `src/js/sketch.js:761`
- Requirement-aligned remediation: keep `WASD` + arrows for movement, move achievements to `K`.
- Implementation status (2026-02-12): Completed (`K` now opens achievements; `A` remains movement-only).

2. Achievement persistence is reset on restart flow.
- Evidence: game state reinitialization wipes achievements and restart path does not reload persisted achievement state.
- Impact: conflicts with intended one-time unlock persistence across runs.
- Files: `src/js/sketch.js:889`, `src/js/sketch.js:940`, `src/js/achievements.js:194`
- Requirement-aligned remediation: always reload persisted achievements after state initialization in restart flow.
- Implementation status (2026-02-12): Completed (restart flow now reloads persisted achievements after state initialization).

3. Achievement storage parsing lacks defensive handling.
- Evidence: JSON parse path for achievements has no `try/catch`.
- Impact: malformed local storage can break achievement initialization.
- Files: `src/js/achievements.js:194`
- Remediation: parse defensively and reset to `{}` on parse failure.
- Implementation status (2026-02-12): Completed (defensive parse with safe fallback and invalid storage reset).

### Medium Priority

4. Mixed timing model across systems (frame-based and delta-time-based updates mixed).
- Evidence: object motion uses `deltaTime`, while other systems and cooldowns are frame-based.
- Impact: inconsistent gameplay feel across frame rates; harder tuning and bug diagnosis.
- Files: `src/js/objects.js:585`, `src/js/abilities.js:304`, `src/js/player.js:31`, `src/js/sketch.js:365`
- Remediation: prefer a single timing model where safe, but keep a documented hybrid boundary if full migration risks gameplay regressions.

5. Help/UI copy drifts from actual controls and behavior.
- Evidence: help text references `1 key` / `2 key` for abilities while implementation uses `Z`/`X`.
- Impact: onboarding confusion.
- Files: `src/js/helpScreen.js:105`, `src/js/helpScreen.js:117`, `src/js/abilities.js:6`, `src/js/abilities.js:221`
- Remediation: update help and overlays to match true keybinds, including achievement key move to `K`.

6. Magnetism behavior matches requested outcome but contract is implicit and terminology is easy to misread.
- Evidence: current logic snapshots on-screen objects, then keeps pulling marked objects until removed; this is independent of cooldown timer.
- Impact: behavior is correct for current requirement, but fragile due to implicit semantics and potential future regressions.
- Files: `src/js/abilities.js:227`, `src/js/abilities.js:246`, `src/js/abilities.js:274`
- Remediation: codify contract in code comments/tests: "cooldown gates re-activation only; magnetized snapshot persists until consumed/removed; newly spawned objects are unaffected."
- Implementation status (2026-02-12): Completed (snapshot-only magnetization on activation, persistent pull until removal, cooldown-only reactivation gating, help text updated).

7. Overlay layouts have hard minimum widths that can break on small viewports.
- Evidence: multiple overlays clamp minimum width to `550`.
- Impact: clipping/cutoff on narrower screens.
- Files: `src/js/introScreen.js:24`, `src/js/helpScreen.js:14`, `src/js/objectInfoScreen.js:14`, `src/js/aboutScreen.js:14`, `src/js/achievements.js:219`
- Remediation: use viewport-aware min/max bounds and responsive typography, and introduce scrolling/pagination where text cannot fit safely without making type illegible.

8. Build HTML script injection is brittle. — **Done (Phase 5)**
- Was: insert via hardcoded script string match.
- Now: marker-based replacement (`BUILD:GAME_SCRIPTS_START` / `END`) with regex fallback in `build.js`.

### Low Priority

9. Open Graph metadata references a missing image. — **Done (Phase 4 + 2026-07 OG refresh)**
- Real `1200×630` asset at `src/assets/og-image.png`; absolute OG/Twitter URLs in `src/index.html`.

10. Unused constants indicate config drift.
- Evidence: constants are defined but not consumed.
- Impact: confusion and maintenance noise.
- Files: `src/js/constants.js` (line numbers from original review may have shifted).
- Remediation: remove unused constants or wire them into logic.
- **Status (2026-07-09):** Not re-audited in this archive refresh; treat as optional cleanup if still true.

11. Likely unused asset groups in repository. — **Done (Phase 5)**
- Confirmed unused assets live under `src/assets/_unused/`; build skips that tree.

12. Product status messaging is inconsistent across docs and in-game text. — **Done (Phase 4)**
- Unified toward playable beta / variable maintenance cadence (README + About).

13. No automated lint/test gate in scripts. — **Done (Phase 5 + later)**
- `npm run lint`, `npm run smoke`, `npm test`, and `npm run playtest` (Playwright / system Brave) exist.

## Bugs (Reported Post-Phase 1)

1. `M` mute toggle updates UI state but does not silence active audio. — **Done**
- Mute is applied via silence helpers (`masterVolume`) and `playSound` respects mute / game-audio-silenced state.
- Residual: occasional edge cases under heavy overlay silence transitions are playtest territory, not known open bugs.

2. Notification/toast overlap makes simultaneous events illegible. — **Done**
- Shared center notification queue + measured panel layout; smoke contracts assert queue usage for achievements, boss, unlocks, etc.

## Phased Remediation Plan

## Phase 1: Core Behavior Corrections (Input + Persistence)
Goal: Resolve user-facing correctness issues first.

Implementation Update (2026-02-12):
- [x] Move achievements keybinding from `A` to `K`.
- [x] Keep movement on both arrow keys and `WASD` (including dash support for arrow keys and `A`/`D`).
- [x] Update relevant help/onboarding/UI text to reflect final bindings.
- [x] Ensure achievements are reloaded from persistent storage after restart initialization.
- [x] Add defensive parsing around achievement storage read path.
- [x] Verify build passes (`npm run build`).
- [x] Run manual regression checks for achievements persistence across restart + browser refresh.

Actions:
- Move achievements keybinding from `A` to `K`.
- Keep movement on both arrow keys and `WASD`.
- Update all relevant help/onboarding/UI text to reflect final bindings.
- Ensure achievements are reloaded from persistent storage after restart initialization.
- Add defensive parsing around achievement storage read path.
- Add regression checks that verify achievements remain unlocked after restart and reload.

Acceptance Criteria:
- Pressing `A` never opens achievements during gameplay.
- `K` opens achievements reliably in active gameplay state.
- Previously unlocked achievements remain unlocked after restart and browser refresh.
- Corrupted achievements storage does not crash flow; fallback state is safe.

## Phase 2: Lock Magnetism Contract
Goal: Preserve your intended magnetism behavior in a robust, explicit way.

Implementation Update (2026-02-12):
- [x] Keep “snapshot on activation” semantics.
- [x] Ensure only that snapshot set is affected.
- [x] Maintain pull effect for those objects until eaten/removed.
- [x] Ensure cooldown only controls re-activation timing and does not terminate active snapshot behavior.
- [x] Prevent newly spawned objects from becoming magnetized during an active session.
- [x] Document behavior in code comments and player-facing help.
- [x] Verify build passes (`npm run build`).
- [ ] Run focused manual magnetism regression pass (activation snapshot, spawn-after-activation, cooldown-expiry behavior). *(optional residual; help/smoke cover contract partially)*

Actions:
- Keep “snapshot on activation” semantics.
- Ensure only that snapshot set is affected.
- Maintain pull effect for those objects until eaten/removed.
- Ensure cooldown only controls re-activation timing and does not terminate active snapshot behavior.
- Prevent newly spawned objects from becoming magnetized during an active session.
- Document this behavior in code comments and player-facing help.

Acceptance Criteria:
- Trigger magnetism with N objects on screen; only those N can be magnetized.
- Newly spawned objects remain unaffected.
- Magnetized objects continue to be pulled until collected/removed.
- Cooldown expiration alone does not stop pull behavior on already-magnetized objects.

## Phase 3: Timing & Gameplay Consistency
Goal: Improve determinism and tuning confidence.

Implementation Update (2026-02-16):
- [x] Added shared timing helpers (`getFrameDelta`, `getDeltaSeconds`) with clamped frame-step handling.
- [x] Normalized key timing-sensitive gameplay paths to frame-delta scaling (player movement/gravity, ability cooldowns, dash timing window, spawn cadence, projectile/effect timers).
- [x] Switched dash double-tap detection to millisecond timing to remove refresh-rate dependence.
- [x] Clarified/normalized timing unit naming for drop-speed constants (`BASE_DROP_SPEED_PX_PER_SECOND`) and timing comments.
- [x] Verified build passes (`npm run build`).
- [ ] Run manual gameplay sanity check at ~60Hz and high-refresh display to confirm feel parity. *(optional residual feel check)*

Actions:
- Attempt timing standardization only where low-risk; retain hybrid where needed to preserve feel.
- Normalize constants naming to match actual units.
- Verify cooldowns and movement behave consistently across different frame rates.
- Add before/after gameplay sanity checks to catch any feel regressions.

Acceptance Criteria:
- Similar gameplay feel at 60Hz and high-refresh displays.
- Constants clearly map to real unit behavior.
- No major gameplay regressions introduced by timing changes.

## Phase 4: UX/Docs Alignment
Goal: Remove player/developer confusion.

Implementation Update (2026-02-16):
- [x] Updated intro/help/README controls to match runtime bindings (`Esc`, `K`, `P`, `M`, movement/dash/jump, unlock-based ability keys).
- [x] Aligned in-game About copy with playable beta messaging used in docs.
- [x] Added OG asset at `src/assets/og-image.png` (`1200x630`) and kept existing social metadata target.
- [x] Added shared responsive overlay helpers and removed brittle fixed width clamps from overlay screens.
- [x] Unified adaptive overlay fit logic via shared helper (`computeAdaptiveOverlayLayout`) across intro/help/object info/about/achievements screens.
- [x] Added minimum-viewport fallback for text-heavy overlays (`840x630`) that shows a readable resize-required panel instead of clipping content.
- [x] Reduced excessive Help/Object Info/About vertical footprint using content-driven target heights while keeping centered responsive behavior.
- [x] Fixed threshold edge cases by moving safety-gap handling into pre-fit layout calculations (prevents dual-overlay draw paths near resize boundaries).
- [x] Run manual overlay UX pass around the minimum viewport threshold to confirm readability and navigation behavior.
- [x] Final Phase 4 code review pass completed with build verification (`npm run build`).

Actions:
- Update help, intro, and README control docs with final key mappings.
- Align project status/version messaging across README and in-game copy to playable beta.
- Fix social metadata by adding valid OG image asset.
- Improve overlay responsiveness for smaller screens using adaptive layout and a minimum-viewport fallback for text-heavy screens.
- Implement cautiously due to existing brittleness in help/about/object-info screens.

Acceptance Criteria:
- All listed controls in docs/UI match runtime behavior.
- Social cards render valid preview image.
- Overlays remain readable and unclipped on narrow screens.
- If canvas is below supported minimum, overlays show explicit resize guidance instead of clipped/truncated text.

## Phase 5: Technical Debt & Guardrails
Goal: Reduce maintenance cost and prevent regressions.

Implementation Update (2026-07-09 archive refresh):
- [x] Move confirmed-unused assets to `src/assets/_unused/` for manual review (build skips the tree).
- [x] Harden build HTML script insertion via `BUILD:GAME_SCRIPTS_*` markers (regex fallback retained).
- [x] Add baseline lint and smoke tests (`scripts/lint.js`, `scripts/smoke.js`, `npm test`).
- [x] Add browser playtest harness (`scripts/playtest.js`, system Brave; pause / bomb / mute / no-analytics contracts).
- [ ] Optional: re-audit and remove or wire any remaining unused constants (finding #10).

Actions (original):
- Move confirmed-unused assets to `src/assets/_unused/` for manual review.
- Remove/wire unused constants.
- Harden build HTML script insertion method.
- Add baseline lint and smoke tests for key gameplay paths (controls, achievements persistence, restart flow, core screen navigation).

Acceptance Criteria:
- Active runtime assets are clearly separated from `_unused` assets. — **Met**
- Build remains stable after HTML/script tag changes. — **Met** (marker-based)
- CI/local checks catch obvious input/progression regressions. — **Met** for local gates; no required remote CI assumed

## Suggested Execution Order

1. Phase 1 (highest user impact, lowest risk)
2. Phase 2 (confirm and codify intended magnetism behavior)
3. Phase 4 (docs + UX alignment)
4. Phase 3 (timing normalization)
5. Phase 5 (debt cleanup + quality gates)

## Notes

- This plan intentionally avoids feature expansion and focuses on correctness, clarity, and maintainability.
- Once Phase 1 is complete, run a short manual regression pass over controls, achievements, and restart behavior before moving on.
- OG image guidance: yes, existing art can be reused. Recommended composition is one background + mimic chest + 1-2 recognizable collectibles, with the game title in large high-contrast text and safe margins.

## Implementation Readiness Review

The plan is coherent, internally consistent with your decisions, and achievable in phased delivery without high-risk rewrites.

Confidence:
- Scope control: strong (focused on correctness, UX alignment, and guardrails, not feature creep).
- Risk level: moderate (mainly around brittle overlay layout work and timing-model adjustments).
- Feasibility: high with careful sequencing and regression checks.

Primary execution cautions:
- Implement input and persistence changes first, then regression-test before any timing or layout refactors.
- Treat overlay responsiveness as incremental hardening (hybrid strategy), not a single large rewrite.
- Only move assets to `src/assets/_unused/` after confirming they have zero runtime references.
