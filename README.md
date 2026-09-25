# Shoreline Access — demo

A clickable demo of a guest and owner access system for **Shoreline Residences**, a fictional 340-unit, 14-floor beachfront condominium in Panama City Beach, Florida. It shows the workflow for a custom Track Hospitality → UniFi Access integration: management can see immediately whether arriving guests will have access, understand any problem, and resolve the exception.

<p align="center"><img src="docs/brand/shoreline-access-logo.png" alt="Shoreline Access" width="420"></p>

> **Demo only.** Every person, reservation, credential, PIN, QR code and number is invented. Nothing connects to Track, UniFi, email or SMS. There is **no database**: all state lives in memory in the API and resets when the API restarts or you choose **Reset demo**.

| Layer | Stack |
| --- | --- |
| Frontend | Angular 22 (standalone components, signals, `httpResource`, reactive forms, zoneless), SCSS design tokens, Inter (bundled), Lucide icons (bundled) |
| Backend | ASP.NET Core 10 minimal API, **vertical slice architecture**, in-memory state, xUnit integration tests |

## Architecture

### Backend — vertical slices

Each use case is one file that contains its request/response contract, validation, handler and endpoint mapping. Endpoints are discovered through `IEndpoint`, so adding a feature never touches `Program.cs`. There are no controllers, service layers or repositories to thread through.

```text
backend/
  src/Shoreline.Api/
    Program.cs                    composition root (JSON, ProblemDetails, OpenAPI, static SPA)
    Common/                       IEndpoint discovery, Validator, PropertyTime, QueryEnum<T>
    Domain/                       entities + AccessRules (the single "is access active?" rule)
    Infrastructure/Demo/          DemoStore (lock-guarded in-memory state), deterministic fixtures, demo clock
    Features/
      Overview/     GetOverview, ListStays
      People/       ListPeople, GetPerson, ExtendAccess, RevokeAccess,
                    GetMessagePreview, ResendMessage, CreateTemporaryAccess
      Sync/         GetSyncCenter, RunSync, RetryIssue, MapUnit, ChooseReservation, SetScenario
      AccessPoints/ ListAccessPoints, GetAccessPoint
      Activity/     ListActivity
      GuestPass/    GetGuestPass
      Search/       GlobalSearch
      Demo/         GetDemoState, AdvanceClock, ResetDemo
      Shared/       PersonSummary row contract + stay segments shared by read slices
  tests/Shoreline.Api.Tests/      AccessRules unit tests + end-to-end demo-script tests
```

Key rules live in `Domain/AccessRules.cs`:

- Credential lifecycle (`scheduled/active/expired/revoked`), provisioning (`pending/succeeded/failed`) and reservation state (`confirmed/cancelled`) are stored separately and combined only there.
- Access is active only when provisioning succeeded, the credential isn't revoked, the reservation is confirmed, and the demo clock is inside the window. Check-in is inclusive and checkout is exclusive. Staff and vendor schedules are evaluated in property time.
- Failed or pending provisioning never produces active access, and the guest pass never exposes a PIN or QR for it.
- Revocation always wins, even after the clock moves forward.
- Provisioning is idempotent. A retry of a completed operation returns `alreadyResolved` and never writes a second credential.

### Frontend — feature folders

```text
frontend/src/app/
  core/          API contracts, DemoState (clock/scenario + revision signal), liveResource, property-time utils, panels, toasts
  layout/        admin shell, sidebar, top bar, demo-controls menu, global search (⌘K)
  shared/ui/     icon, status badge, avatar, metric tile, dialog surface (native <dialog>), toast outlet,
                 activity timeline, credential card, QR code, empty state, skeleton, brand mark
  features/
    overview/  people/ (directory, person drawer, temporary access)  sync/  access-points/  activity/  guest-pass/
```

Every read goes through `liveResource()`, an `httpResource` keyed on a shared `revision` signal. Every mutation calls `DemoState.mutate()`, which bumps the revision. All visible screens then refetch from the one server-side state, so counts, histories and statuses always agree.

Drawers and dialogs use the native `<dialog>` element: the browser provides the focus trap, Escape handling and top-layer stacking, and focus returns to the element that opened them. Routing uses `withHashLocation()`, so deep links and refreshes work on any static host.

## Run locally

Requirements: **.NET SDK 10** and **Node.js 24** (`frontend/.nvmrc`).

```bash
# 1. API on http://localhost:5080
cd backend
dotnet run --project src/Shoreline.Api

# 2. Web app on http://localhost:4200 (proxies /api to the API)
cd frontend
npm ci
npm start
```

Open <http://localhost:4200>. The app opens straight onto the dashboard; there is no sign-in.

```bash
# Tests
cd backend && dotnet test

# Production build of the web app
cd frontend && npx ng build          # → frontend/dist/frontend/browser
```

The OpenAPI document is available in Development at `http://localhost:5080/openapi/v1.json`.

Simulated controller and feed calls wait about 900 ms so the loading states are visible. Set `Demo__SimulatedLatencyMs=0` to disable the delay.

## Deploy

Because the demo now has a C# API, it can't be served from GitHub Pages alone. The repository ships a single container in which the API also serves the compiled Angular app:

```bash
docker build -t shoreline-access .
docker run -p 8080:8080 shoreline-access     # → http://localhost:8080
```

This works on any container host (Azure App Service or Container Apps, Fly.io, Render, Railway, and so on). Run **one instance**: the demo state is in memory, so separate instances wouldn't share it.

**Sub-path hosting:** API calls use paths relative to `<base href>` (`api/...`). To host under a sub-path such as `https://example.com/shoreline/`, build with `npx ng build --base-href /shoreline/` and serve the API and SPA together under that same prefix (for example with `app.UsePathBase("/shoreline")`).

CI (`.github/workflows/ci.yml`) builds and tests the API, builds the web app, and builds the container image on every push and pull request.

## Demo controls

- **Demo clock** (top bar): the fixed start is Saturday, September 26, 2026, 3:45 PM Central.
  - **Advance to check-in** moves to 4:00 PM. Arrival credentials become active, and each transition is logged.
  - **Advance to checkout** moves to Saturday, October 3, 10:00 AM. Avery's stay ends at exactly 10:00 AM, and every expiration crossed along the way is logged.
  - **Reset demo** restores the clock, records and scenario.
- **Demo scenario** (Sync center): *Normal operation*, *Track feed unavailable*, or *Provisioning interrupted*.
- **Global search**: ⌘K / Ctrl+K or `/`.

## Routes

| Route | Screen |
| --- | --- |
| `#/overview` | Arrival readiness, metrics, system health, recent activity |
| `#/people` | Directory. Accepts `?segment=activeStays\|arrivalsToday\|departuresToday`, `?type=`, `?status=`, `?q=` |
| `#/sync` | Sync center. Accepts `?filter=open\|resolved\|all`, `?issue=<id>` |
| `#/access-points` | Fifteen access points, grid or table view |
| `#/activity` | Audit trail |
| `#/guest/:id` | Stand-alone guest pass, e.g. `#/guest/avery-morgan` |

## Three-minute walkthrough

1. **Overview (0:00–0:30).** Show 42 arrivals with 39 ready and the three exceptions. Management sees problems before check-in.
2. **Unit 807 (0:30–1:10).** Click *Avery Morgan* in Today's arrivals. Show the permitted locations, the scheduled window and **Preview guest pass**. Then use **Demo clock → Advance to check-in**: the credential becomes *Active* in the drawer, the table and the pass.
3. **Resolve a failure (1:10–1:50).** Click *Resolve* next to Taylor Reed (or go to Sync center) and choose **Retry provisioning**. The timeline shows success and readiness moves from 39/42 to 40/42. Jordan (unit mapping) and Casey (duplicate reservation) each need a reviewed decision; a retry won't fix them.
4. **Track outage (1:50–2:20).** In Sync center, choose **Track feed unavailable**. The feed goes stale, a failed run is logged, and upcoming arrivals are flagged. Switch back to **Normal operation**.
5. **Automatic expiration (2:20–2:45).** Use **Advance to checkout**. Avery's pass changes to *Stay ended* at exactly 10:00 AM, and Activity records the expiration.
6. **Close (2:45–3:00).** The prototype shows the management workflow. A hardware/API proof of concept would validate the real integration next.

Choose **Reset demo** before the next presentation.

## What this demo does not establish

It doesn't validate Track API, webhook or export availability, UniFi credential-method support, schedule enforcement, offline operation, camera streaming, or emergency-access procedures. The PIN and QR are illustrative, and the QR payload is an inert string. The next real milestone is a proof of concept on one or two gates with test reservations and observed activation and revocation.
