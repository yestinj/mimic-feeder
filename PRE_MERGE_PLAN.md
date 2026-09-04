# Pre-merge plan: `develop` → `main`

> **Status (2026-07-09):** Active pre-merge checklist for `develop` → `main`.  
> Code items in sections 1–6 are **Done**. Remaining: **§7 Cloudflare dashboard follow-up** (D1 unbind if still bound) and optional **§8 manual playtest**.  
> Historical polish/review notes live under `archive/plan.md` and `archive/tech-review.md`. Agent orientation: `AGENTS.md`.

Based on the branch review of `develop` vs `origin/main` (2026-07-09).  
Implementation status updated while applying the agreed fixes.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Do** | Agreed; implement before merge |
| **Done** | Implemented in this pass |
| **Skip** | Explicitly out of scope for this pass |
| **Follow-up** | Manual / non-code step after deploy |

---

## Decisions log

| Topic | Decision | Rationale |
|--------|----------|-----------|
| Analytics (review 4–7) | **Remove entirely** | Hobby project, long idle periods, few expected players |
| D1 migration docs (review 8) | **N/A** — remove metrics docs | Follows analytics removal |
| Lint `scripts/` (review 9) | **Do** | Cheap hygiene |
| Magnetism balance (review 10) | **Keep current behavior** | Intentional power fantasy |
| Magnetism help text | **Do** | Clarify snapshot + bomb risk |
| Animation frame catch-up (review 11) | **Skip for now** | Not noticed in normal play |

---

## 1. Must fix

### 1.1 Pause still accepts gameplay keys — **Done**
- Guard in `keyPressed` includes `isPaused` and other overlays.
- P / M / Esc / K still work while paused as intended.

### 1.2 Pause does not show a frozen playfield — **Done**
- Active gameplay frames capture via `get()` into `lastGameplayFrame`.
- Pause path redraws that snapshot, then `drawPauseScreen()`.

### 1.3 Shadow-bolt bomb double-count — **Done**
- Pre-increment removed in `abilities.js`; `handleBombCollection` owns counting.
- Smoke contract asserts no double-count on bolt-bomb path.

---

## 2. Remove analytics — **Done**

Removed:
- `src/js/analytics.js` and all track call sites
- `functions/api/track.js` (+ `functions/`)
- `migrations/`, `queries/`, `CLOUDFLARE_METRICS_SETUP.md`
- `src/_routes.json`, `.dev.vars.example`
- D1 / `ALLOWED_ORIGINS` from `wrangler.toml`
- `wrangler` npm dependency (Pages GitHub deploy does not need it locally)
- README metrics / privacy sections
- Analytics smoke contracts (replaced with “analytics removed” contracts)

---

## 3. Magnetism help polish — **Done**

- Help screen: snapshot contract + bombs risk
- Unlock toast + object info line clarified
- Behavior unchanged (strong pull, bombs magnetizable)

---

## 4. Lint hygiene — **Done**

- `scripts/lint.js` syntax-checks `build.js`, `src/js/*`, and `scripts/**/*.js`

---

## 5. Nits — **Done**

- N2: build logs warnings on optional `_headers` copy failure (no silent empty catch for missing `_routes`)
- N3: `saveAchievements()` try/catch around `localStorage.setItem`

---

## 6. Explicitly skipped

| Item | Why |
|------|-----|
| Animation frame steppers under large `frameDelta` | Not observed; later polish |

---

## 7. Follow-up after merge/deploy (manual Cloudflare)

**Do this once production is on the analytics-free build:**

1. Cloudflare Dashboard → Pages → `mimic-feeder` (or project name) → **Settings**.
2. Remove any **D1 database binding** (e.g. `mimic_feeder_metrics`) if still present.
   - A leftover required binding can break deploys after code no longer declares D1.
3. Optional cleanup: delete the unused D1 database `mimic-feeder-metrics` if you no longer want the data.
4. Confirm a successful Pages deploy of pure static `dist/` with no Functions errors.

Keep this section until the dashboard cleanup is done, then delete or archive this file.

---

## 8. Verification

```bash
npm test   # lint + build + smoke
```

Manual playtest checklist:
- [ ] Pause mid-run: frozen world visible, P resumes; jump/dash/abilities do nothing while paused
- [ ] Shadow bolt a bomb once; hazard achievement progress should not jump by 2
- [ ] Magnet unlock toast / help text readable; bombs still pullable
- [ ] No network calls to `/api/track` in browser devtools
- [ ] Mute / retry / achievements still work

---

## 9. Implementation order (completed)

1. Pause fixes + bomb double-count
2. Analytics removal
3. Magnetism help + nits + lint
4. Smoke contracts + `npm test`
