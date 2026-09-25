# Shoreline Access — UI Demo Prototype Plan

A fast, UI-only prototype that shows Jon Hodge (Panama City Beach, FL) what his automated condo/STR access system would feel like to operate. It is built in Angular, deployed to GitHub Pages, and designed to look like a finished product. White surfaces, restrained blues, and Linear-level precision.

> **Status:** implemented in this repository. The demo runs entirely in the browser (no backend, no database), so it's a static site. This document is the plan and the acceptance record in one.

---

## 1. Goal and positioning

**One-sentence story:** *Management can see immediately whether arriving guests will have access, understand any problem, and resolve an exception — without anyone touching UniFi.*

Jon's post asks for a phased build that starts with a **Phase 1 proof of concept on one or two gates**. This prototype comes before that. It is a low-risk, zero-hardware way to agree on the workflow and the admin experience before any paid integration work. It must:

- look and behave like a real, premium product (first impression matters more than breadth);
- map visibly to the words Jon used in his post, so he recognises his own requirements;
- be honest: every integration is simulated and labelled as such, and nothing claims UniFi or Track capability that hasn't been validated.

**Out of scope:** real Track or UniFi calls, real authentication (a cosmetic sign-in with pre-filled demo credentials is included for realism), billing, a rules editor, door-unlock controls, live camera video, a backend or database.

---

## 2. Traceability: Jon's post → the demo

| Jon's requirement | Where it lives in the demo | Status |
| --- | --- | --- |
| 340 units, 14 floors, ~15 access points, 3–5 beach/pool/boardwalk gates | Property header, sidebar, Access points (15 points, **4 exterior gates**) | ✅ |
| Keypad/PIN at all major locations | Hardware chips on every access point (*Keypad*) · PIN on credential card and guest pass | ✅ |
| NFC/fob for people without smartphones | Owners/staff credential method **NFC fob / card** · *NFC* chip on every reader | ✅ |
| QR/mobile credentials where practical | Guest pass with sample QR · *QR* chip at entries and gates | ✅ |
| Protect cameras tied to important access points | *Protect camera* chip · drawer with "Camera preview · Demo still" | ✅ (illustrative still) |
| Intercom/remote entry at selected locations | *Intercom* chip on main lobby, parking entry, service entry | ✅ (capability only) |
| Future vehicle gate / LPR, 40+ cameras | "Future expansion (phase 4)" note on Access points | ✅ (roadmap only) |
| Owners: permanent · STR guests: reservation dates · Snowbirds/mid-term: lease dates · Staff: role/schedule · Vendors: limited locations/times · Visitors/deliveries: temporary | **Access rules** cards on Guests & residents (click to filter) · type filters · per-person access window and schedule | ✅ |
| Track → UniFi user → permissions → credential → activates at check-in → expires at checkout | Person drawer **Lifecycle** timeline · Demo clock: *Advance to check-in* / *Advance to checkout* | ✅ |
| Unit 807 example: Sat 4:00 PM → following Sat 10:00 AM | Avery Morgan, Unit 807. The guest pass reads exactly that sentence. | ✅ |
| Identity → unit → user type → access groups → credential → activation/expiration → audit/error reporting | Sync center pipeline (*Identity → unit → user type → access group*) · lifecycle steps · Activity audit trail | ✅ |
| CSV sync acceptable if there's no API | Source labelled *Demo reservation feed · CSV fallback scenario*, runs every 15 min | ✅ |
| Dashboard: active guests, upcoming arrivals, departures | Overview metrics + Today's arrivals/departures/in-house table | ✅ |
| Dashboard: credentials created, failed syncs, manual exceptions, revoked | Overview **Credentials today** card (created · activated · expired · revoked · manual exceptions · failed syncs) | ✅ |
| "If Track goes down… management needs to know immediately" | **App-wide outage banner** on every screen · Sync center scenario *Track feed unavailable* | ✅ |
| Reliability over complexity; no silent failures | Three distinct failures with distinct fixes (retry / map unit / choose reservation). Retries are idempotent and never "magic-fix" bad data. | ✅ |
| Phased build (PoC first) | README + this plan; the demo closes by pointing to a Phase 1 PoC | ✅ |

---

## 3. Visual direction

**Feel:** calm, precise, expensive. White and blue, Linear-inspired density and craft, with its own identity (the Shoreline Access door-and-waves mark).

| Token | Value |
| --- | --- |
| Canvas / surface / sidebar | `#F7F9FC` / `#FFFFFF` / `#F3F6FB` |
| Text / secondary / muted | `#17243B` / `#52627A` / `#64748B` |
| Primary / hover / soft | `#2563EB` / `#1D4ED8` / `#EFF6FF` |
| Brand navy / brand blue | `#10203D` / `#1D63ED` |
| Success / warning / danger | `#15803D` / `#B45309` / `#B91C1C` (always with pale tint + icon + text) |
| Radius | cards 14px · controls 8px |
| Shadows | card `0 2px 8px rgb(23 36 59 / 3%)` · overlay `0 18px 60px rgb(23 36 59 / 14%)` |

- **Layout:** 232px light sidebar, 64px translucent top bar (breadcrumbs, ⌘K search, *Demo* chip, demo clock, avatar), pale canvas with white bordered cards, 28–32px page padding.
- **Type:** Inter (bundled). Page title 28/600, section 16/600, body 14, meta 12–13, metrics 30–34 with tabular numerals.
- **Tables:** ~56px rows, quiet hover, sticky headers, avatar + name + mono reservation ID.
- **Status chips:** *Scheduled* (blue/clock), *Active* (green/check), *Needs attention* (amber/warning), *Expired* (grey/pause), *Revoked* (red/ban).
- **Motion:** 140–200ms fades, 220ms drawer slide, animated progress bar, full `prefers-reduced-motion` support.
- **Guest pass:** the second visual centrepiece, with a coastal line illustration, a large QR, a readable PIN, and an elegant ended/revoked state.
- **Avoid:** gradients-as-decoration, dark sidebar, rainbow charts, glassmorphism, stock photos, default component-library look.

---

## 4. Screens

| Priority | Screen | What it must show |
| --- | --- | --- |
| P0 | **Overview** | Greeting and property time · 4 clickable metrics (186 active stays, 42 arrivals, 38 departures, 3 need attention) · **Arrival readiness 39 of 42** with the three exceptions · Today's arrivals table (tabs, search, status filter) · System health · **Credentials today** · Recent activity |
| P0 | **Guests & residents** | Access rules cards per user type · searchable, paginated directory · deep links from metrics |
| P0 | **Person drawer** | Identity, reservation, stay (property time), credential card (masked PIN, reveal/copy, QR), permitted locations, lifecycle timeline, activity · *Preview message*, *Extend access*, *Revoke access* (reason + confirmation) · phone-frame guest pass preview |
| P0 | **Sync center** | Track → Shoreline Access → UniFi pipeline · last/next run, processed, unresolved · issues with the right fix for each cause · scenario control · run history |
| P0 | **Guest pass** `#/guest/:id` | Standalone mobile page · *Ready for your arrival* / *Access active* / *Stay ended* / *Access revoked* · never shows a PIN or QR for unusable credentials |
| P1 | **Access points** | 15 points, grid/table, area filters, hardware chips, offline state · drawer with groups, recent entries, camera still |
| P1 | **Activity** | Day-grouped audit trail, category and denied filters, search, clickable rows |
| — | Sign-in | Split-screen brand panel and form, credentials pre-filled (`morgan.hale@example.com` / `shoreline-demo`, any password works), redirect back to the requested page, *Sign out* in the avatar menu. Guest pass links stay public. |
| — | Global | ⌘K search (people, units, doors) · temporary access modal (visitor/vendor, locations, window, reason) · toasts · app-wide outage banner |

---

## 5. Demo data and clock

- Fixed clock: **Saturday, September 26, 2026, 3:45 PM, America/Chicago**. Schedules are always shown in property time, never in the viewer's time zone.
- Deterministic fixtures: 186 in-house STR stays, 38 departed this morning, 42 arrivals (39 ready), a week of upcoming arrivals, 24 owners, 10 mid-term renters, 8 staff, 5 vendors, 2 visitors.
- Hero records: **Avery Morgan (807)** scheduled arrival · **Jordan Ellis (1104)** missing unit mapping · **Taylor Reed (612)** provisioning timeout · **Casey Brooks (905)** duplicate reservation · **Morgan Lane (1201)** owner · **Elena Park (304)** mid-term · **Sam Rivera** housekeeping 8–4 · **Coastal HVAC** vendor 9–12.
- Demo controls: *Advance to check-in* (4:00 PM), *Advance to checkout* (Oct 3, 10:00 AM), *Reset demo*.
- Scenarios: *Normal operation*, *Track feed unavailable*, *Provisioning interrupted*.
- All names use fictional people and `example.com` addresses. PIN and QR are inert samples labelled *Demo pass — not valid for entry*.

---

## 6. Implementation (Angular)

- **Angular 22:** standalone components, signals, `httpResource`, reactive forms, zoneless, strict TypeScript, lazy-loaded routes, hash routing (`withHashLocation()`).
- **Feature folders:** `features/overview`, `people`, `sync`, `access-points`, `activity`, `guest-pass`, plus `shared/ui` (badge, avatar, metric tile, dialog surface built on native `<dialog>`, toast, timeline, credential card, QR, empty state, skeleton).
- **Demo data layer:** `src/app/demo-api/` is an in-browser "API" organised as vertical slices. An `HttpInterceptor` answers `api/...` requests from memory with short simulated latency. Every mutation bumps one revision signal, so every visible screen refreshes and all counts agree.
- **Optional server:** an equivalent ASP.NET Core API lives in `backend/` for later phases. `npm run start:server` switches to it.
- **Assets:** Inter font, Lucide icons and QR generation are all bundled locally, with no runtime network dependencies.

---

## 7. GitHub Pages

1. Merge to `main`. `.github/workflows/deploy-pages.yml` runs the tests, builds with `--base-href /<repo>/`, and deploys with the official Pages actions.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The site is published at `https://<owner>.github.io/<repo>/`. Deep links such as `#/guest/avery-morgan` work, and so do refreshes.

For a custom domain or a user site, build with `--base-href /`.

---

## 8. Three-minute demo script

0. **Sign in (before you start).** Open the link and press **Sign in**; the credentials are pre-filled.
1. **Overview (0:00–0:30).** 42 arrivals, 39 ready, 3 exceptions. *Credentials today* shows the automation working. Problems are visible before check-in.
2. **Unit 807 (0:30–1:10).** Open Avery. Show the permitted gates, the Saturday 4 PM → Saturday 10 AM window and **Preview guest pass**. Use **Advance to check-in**: *Active* everywhere.
3. **Resolve a failure (1:10–1:50).** Taylor Reed → **Retry provisioning**. Readiness moves from 39 to 40 of 42, and open issues from 3 to 2. Point out that Jordan and Casey need a decision; a retry won't fix them.
4. **Track outage (1:50–2:20).** Choose *Track feed unavailable*. The banner appears on every screen, the pipeline turns red, and upcoming arrivals are flagged. Restore *Normal operation*.
5. **Automatic expiration (2:20–2:45).** Use **Advance to checkout**. The pass shows *Stay ended* at exactly 10:00 AM, and the audit log records it.
6. **Close (2:45–3:00).** This is the workflow. Next step: a Phase 1 proof of concept on one or two gates with test reservations.

Choose **Reset demo** (or reload) before the next presentation.

---

## 9. Acceptance checklist

- [x] Polished at 1440px and 1280px; the first viewport shows the metrics, the readiness panel and the start of the arrivals table
- [x] Sidebar collapses on tablet; admin pages usable at 390px; guest pass excellent at 390px and comfortable at 360px
- [x] Every enabled button, filter, tab, menu and row action works; disabled actions explain why
- [x] Unit 807 goes scheduled → active → expired at exact boundaries (check-in inclusive, checkout exclusive)
- [x] Revoked credentials stay revoked when the clock advances
- [x] Retrying never duplicates identities or credentials
- [x] Fixing one of three failures moves readiness from 39/42 to 40/42 and issues from 3 to 2
- [x] Temporary access validates the window and locations and writes an audit entry
- [x] Failed provisioning never renders a usable guest pass
- [x] Counts, histories and statuses agree across screens
- [x] Loading, empty, error and success states designed
- [x] Visible keyboard focus, accessible dialogs (focus trap, Escape, focus return), AA contrast, reduced motion
- [x] No console errors or network calls; works under a repository sub-path with hash deep links
- [x] Demo scope visible (*Demo* chip, "simulated" labels) without distracting from the product
- [x] Automated checks (Vitest) for lifecycle boundaries, revocation, retry idempotency, shared counts and time-zone independence

---

## 10. What the demo does not prove

Track API/webhook/export availability, UniFi credential-method support (PIN, NFC, QR, mobile), schedule enforcement on hardware, offline behaviour, Protect streaming, intercom, LPR, and emergency-access procedures. These belong to **Jon's Phase 1**: one or two gates, test reservations, confirmed interfaces, and observed activation and revocation.
