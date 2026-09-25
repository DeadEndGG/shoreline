import { CredentialStatus } from '../../core/api/models';
import { AccessRules, Stay, initials } from '../domain';
import { StaySegments, matchesSummary, toActivityItem, toSummary, upcomingArrivals } from '../projections';
import { Route, clamp, enumParam, intParam } from '../router';
import { DemoClock, DemoState } from '../state';
import { dayOf, iso, minuteOfDay } from '../time';

export const STATUSES: readonly CredentialStatus[] = ['scheduled', 'active', 'needsAttention', 'expired', 'revoked'];

/** Everything the hero dashboard needs, computed from one consistent snapshot. */
export function getOverview(state: DemoState) {
  const now = state.now;
  const arrivals = state.stays.filter((s) => StaySegments.arrivesToday(s, now));
  const ready = arrivals.filter((s) => {
    const c = state.credentialFor(s.personId);
    return c !== null && AccessRules.isReady(c, s);
  }).length;
  const open = state.syncIssues.filter((i) => !i.isResolved);
  const arrivalIds = new Set(arrivals.map((a) => a.personId));
  const feedStale = state.scenario === 'feedUnavailable';
  const minute = minuteOfDay(now);
  const greeting = minute < 12 * 60 ? 'Good morning' : minute < 17 * 60 ? 'Good afternoon' : 'Good evening';

  // Jon's dashboard list: created, activated, expired, revoked, manual exceptions, failed syncs.
  const today = dayOf(now);
  const happenedToday = (ms: number | null) => ms !== null && ms <= now && dayOf(ms) === today;
  const live = state.credentials.filter((c) => c.provisioning === 'succeeded' && !c.isRevoked);

  return {
    lifecycle: {
      created: state.credentials.filter((c) => happenedToday(c.preparedAt)).length,
      activated: live.filter((c) => happenedToday(c.validFrom)).length,
      expired: live.filter((c) => happenedToday(c.validUntil)).length,
      revoked: state.credentials.filter((c) => happenedToday(c.revokedAt)).length,
      manualExceptions: state.auditEvents.filter((e) => e.category === 'manual' && happenedToday(e.at)).length,
      failedSyncs: open.length,
    },
    greeting: `${greeting}, ${DemoClock.managerName.split(' ')[0]}`,
    now: iso(now),
    metrics: {
      activeGuestStays: state.stays.filter((s) => StaySegments.isActiveGuestStay(s, now)).length,
      arrivalsToday: arrivals.length,
      departuresToday: state.stays.filter((s) => StaySegments.departsToday(s, now)).length,
      needsAttention: open.length,
    },
    readiness: {
      ready,
      total: arrivals.length,
      checkInAt: arrivals.length ? iso(Math.min(...arrivals.map((a) => a.checkIn))) : null,
      issues: open
        .filter((i) => arrivalIds.has(i.personId))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((i) => {
          const person = state.findPerson(i.personId)!;
          return { issueId: i.id, kind: i.kind, personId: person.id, personName: person.name, initials: initials(person.name), unit: i.unit, summary: i.summary };
        }),
    },
    health: {
      scenario: state.scenario,
      feedLastReceivedAt: iso(state.feedLastReceivedAt),
      feedStale,
      accessPointsOnline: state.accessPoints.filter((a) => a.online).length,
      accessPointsTotal: state.accessPoints.length,
      offline: state.accessPoints.filter((a) => !a.online).map((a) => ({ id: a.id, name: a.name, since: iso(a.offlineSince ?? now) })),
      upcomingArrivalsAffected: feedStale ? upcomingArrivals(state).length : 0,
    },
    recentActivity: state.auditTimeline().filter((e) => e.at <= now).slice(0, 7).map(toActivityItem),
  };
}

const VIEWS = ['arrivals', 'departures', 'inHouse'] as const;

/** The "Today" table on the overview: arrivals, departures, or everyone in house. */
function listStays(state: DemoState, query: URLSearchParams) {
  const view = enumParam(query, 'view', VIEWS) ?? 'arrivals';
  const status = enumParam(query, 'status', STATUSES);
  const q = query.get('q');
  const take = clamp(intParam(query, 'take', 8), 1, 500);
  const now = state.now;
  const inView: (s: Stay) => boolean =
    view === 'departures' ? (s) => StaySegments.departsToday(s, now)
    : view === 'inHouse' ? (s) => StaySegments.isActiveGuestStay(s, now)
    : (s) => StaySegments.arrivesToday(s, now);

  const rows = state.stays.filter(inView).map((s) => toSummary(state, state.findPerson(s.personId)!));
  const key = (iso: string | null) => (iso ? Date.parse(iso) : Number.MAX_SAFE_INTEGER);
  const matching = rows
    .filter((r) => status === null || r.status === status)
    .filter((r) => matchesSummary(r, q))
    // Problems first, then by expected arrival (or checkout), then name.
    .sort((a, b) =>
      Number(!(a.hasOpenIssue || a.status === 'needsAttention')) - Number(!(b.hasOpenIssue || b.status === 'needsAttention'))
      || (view === 'departures' ? key(a.accessUntil) - key(b.accessUntil) : key(a.expectedArrival) - key(b.expectedArrival))
      || a.name.localeCompare(b.name));

  return { view, total: rows.length, matching: matching.length, items: matching.slice(0, take) };
}

export const overviewRoutes: Route[] = [
  { method: 'GET', path: /^overview$/, handle: ({ state }) => getOverview(state) },
  { method: 'GET', path: /^overview\/stays$/, handle: ({ state, query }) => listStays(state, query) },
];

