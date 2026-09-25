import { ActionResult, DemoScenario } from '../../core/api/models';
import { Credential, Person, Stay, SyncIssue, SyncTrigger, initials } from '../domain';
import { upcomingArrivals } from '../projections';
import { NotFoundError, Route, ValidationError, Validator, enumParam, str } from '../router';
import { DemoClock, DemoState } from '../state';
import { MINUTE, atDay, clock, dayOf, iso, isoOrNull, monthDayTime, shortWeekdayDate } from '../time';

export const CONTROLLER_UNAVAILABLE = 'UniFi Access controller did not acknowledge the write (simulated interruption).';
export const INTERRUPTED_GUEST_ID = 'riley-chen';
const result = (outcome: ActionResult['outcome'], message: string): ActionResult => ({ outcome, message });
const shortTermCount = (state: DemoState) => state.stays.filter((s) => s.isShortTerm).length;

// ── Shared provisioning behaviour ───────────────────────────────────────────

/**
 * Finishes a credential write for an issue. Idempotent by construction — a credential is
 * written at most once, and a resolved issue is never processed again.
 */
function complete(state: DemoState, issue: SyncIssue, resolution: string): ActionResult {
  const person = state.findPerson(issue.personId)!;
  const credential = state.credentialFor(person.id)!;

  if (state.scenario === 'provisioningInterrupted') {
    credential.markFailed(CONTROLLER_UNAVAILABLE);
    issue.attempts.push({ at: state.now, succeeded: false, detail: 'Controller connection interrupted — nothing was written' });
    state.audit('sync', 'Retry failed', 'warning', 'Shoreline Access', { person, detail: 'Controller connection interrupted' });
    return result('failed', "The controller connection is still interrupted. Nothing was written; try again once it's restored.");
  }

  const group = credential.accessGroupId ?? state.unitMappings.get(issue.unit) ?? null;
  const wrote = credential.markProvisioned(state.now, group);
  issue.attempts.push({ at: state.now, succeeded: true, detail: wrote ? 'Credential written and confirmed' : 'Credential already present — no new write' });
  issue.resolve(state.now, resolution);

  state.syncRuns.push({
    id: state.nextId('run'), startedAt: state.now, source: 'Demo reservation feed', trigger: 'retry',
    received: 1, created: wrote ? 1 : 0, updated: 0, unchanged: wrote ? 0 : 1, failed: 0, durationMs: 1240,
    result: 'succeeded', note: `${person.name} · Unit ${issue.unit}`,
  });

  state.audit('sync', 'Exception resolved', 'success', 'Shoreline Access', { person, detail: resolution });
  if (wrote) {
    const window = credential.validUntil !== null
      ? `Scheduled for ${monthDayTime(credential.validFrom)} → ${monthDayTime(credential.validUntil)}`
      : 'Scheduled';
    state.audit('credential', 'Credential prepared', 'success', 'Shoreline Access', { person, detail: window });
  }
  return result('succeeded', `${person.name}'s credential is prepared and scheduled.`);
}

const alreadyResolved = (issue: SyncIssue) =>
  result('alreadyResolved', `This issue was already resolved${issue.resolution ? `: ${issue.resolution}` : ''}. No changes were made.`);

function findIssue(state: DemoState, id: string): SyncIssue {
  const issue = state.syncIssues.find((i) => i.id === id);
  if (!issue) throw new NotFoundError();
  return issue;
}

// ── RetryIssue ──────────────────────────────────────────────────────────────

/** Retries a transient failure. Invalid data is never "fixed" by retrying. */
function retryIssue(state: DemoState, id: string): ActionResult {
  const issue = findIssue(state, id);
  if (issue.isResolved) return alreadyResolved(issue);
  const blocked =
    issue.kind === 'provisioningTimeout' || issue.kind === 'provisioningInterrupted' ? null
    : issue.kind === 'missingUnitMapping'
      ? state.unitMappings.has(issue.unit) ? null : `Unit ${issue.unit} still has no access group. Assign one first.`
      : 'Choose which reservation to keep before provisioning.';
  if (blocked) throw new ValidationError({ issue: [blocked] });
  return complete(state, issue, 'Provisioning retried successfully');
}

// ── MapUnit ─────────────────────────────────────────────────────────────────

function mapUnit(state: DemoState, id: string, body: Record<string, unknown>): ActionResult {
  const issue = findIssue(state, id);
  if (issue.isResolved) return alreadyResolved(issue);
  const group = state.findGroup(str(body['accessGroupId']));
  new Validator()
    .require(issue.kind === 'missingUnitMapping', 'accessGroupId', "This issue isn't a unit mapping problem.")
    .require(!!group?.assignableToUnits, 'accessGroupId', 'Choose a guest access group.')
    .ensure();

  const person = state.findPerson(issue.personId)!;
  state.unitMappings.set(issue.unit, group!.id);
  state.credentialFor(person.id)!.accessGroupId = group!.id;
  state.audit('manual', 'Unit mapping assigned', 'success', DemoClock.managerName, { person, detail: `Unit ${issue.unit} → ${group!.name}` });
  return complete(state, issue, `Unit ${issue.unit} mapped to ${group!.name}`);
}

// ── ChooseReservation ───────────────────────────────────────────────────────

function chooseReservation(state: DemoState, id: string, body: Record<string, unknown>): ActionResult {
  const issue = findIssue(state, id);
  if (issue.isResolved) return alreadyResolved(issue);
  const chosen = issue.candidates.find((c) => c.reservationId === str(body['reservationId']));
  new Validator()
    .require(issue.kind === 'duplicateReservation', 'reservationId', "This issue isn't a duplicate reservation.")
    .require(!!chosen, 'reservationId', 'Choose one of the reservations under review.')
    .ensure();

  const person = state.findPerson(issue.personId)!;
  const stay = state.stayFor(person.id)!;
  const credential = state.credentialFor(person.id)!;
  const discarded = issue.candidates.filter((c) => c.reservationId !== chosen!.reservationId).map((c) => c.reservationId);

  stay.reservationId = chosen!.reservationId;
  stay.checkIn = chosen!.checkIn;
  stay.checkOut = chosen!.checkOut;
  stay.guests = chosen!.guests;
  credential.validFrom = chosen!.checkIn;
  credential.validUntil = chosen!.checkOut;

  state.audit('manual', 'Duplicate reservation reviewed', 'success', DemoClock.managerName, {
    person, detail: `Kept ${chosen!.reservationId} · set aside ${discarded.join(', ')}`,
  });
  return complete(state, issue, `Kept reservation ${chosen!.reservationId}`);
}

// ── RunSync ─────────────────────────────────────────────────────────────────

export function addFailedRun(state: DemoState, at: number, trigger: SyncTrigger) {
  state.syncRuns.push({
    id: state.nextId('run'), startedAt: at, source: 'Demo reservation feed', trigger,
    received: 0, created: 0, updated: 0, unchanged: 0, failed: 0, durationMs: 30000,
    result: 'failed', note: 'Demo reservation feed did not respond within 30 s',
  });
}

/** Reports what the feed shows; never silently fixes open issues. */
function runSync(state: DemoState): ActionResult {
  if (state.scenario === 'feedUnavailable') {
    addFailedRun(state, state.now, 'manual');
    state.audit('sync', 'Sync run failed', 'warning', 'Track feed', { detail: 'Reservation feed unavailable · existing credentials unchanged' });
    return result('failed', "The reservation feed didn't respond. Existing credentials were left unchanged.");
  }

  const received = shortTermCount(state);
  const failed = state.syncIssues.filter((i) => !i.isResolved).length;
  const plural = failed === 1 ? '' : 's';
  state.syncRuns.push({
    id: state.nextId('run'), startedAt: state.now, source: 'Demo reservation feed', trigger: 'manual',
    received, created: 0, updated: 0, unchanged: received - failed, failed, durationMs: 2380,
    result: failed === 0 ? 'succeeded' : 'completedWithIssues',
    note: failed === 0 ? 'All reservations in sync' : `${failed} open issue${plural} still need review`,
  });
  state.feedLastReceivedAt = state.now;
  state.audit('sync', failed === 0 ? 'Sync run completed' : 'Sync run completed with issues', failed === 0 ? 'success' : 'warning', 'Track feed', {
    detail: `${received} reservations checked · ${failed} open issue${plural}`,
  });
  return failed === 0
    ? result('succeeded', `Sync complete. ${received} reservations checked, no changes.`)
    : result('failed', `Sync complete. ${failed} issue${plural} still need${failed === 1 ? 's' : ''} a decision.`);
}

// ── SetScenario ─────────────────────────────────────────────────────────────

const SCENARIOS: readonly DemoScenario[] = ['normal', 'feedUnavailable', 'provisioningInterrupted'];

export function applyScenario(state: DemoState, next: DemoScenario): ActionResult {
  const previous = state.scenario;
  if (previous === next) return result('alreadyResolved', 'That scenario is already active.');

  if (previous === 'feedUnavailable') {
    state.feedLastReceivedAt = state.now;
    const received = shortTermCount(state);
    const open = state.syncIssues.filter((i) => !i.isResolved).length;
    state.syncRuns.push({
      id: state.nextId('run'), startedAt: state.now, source: 'Demo reservation feed', trigger: 'recovery',
      received, created: 0, updated: 2, unchanged: received - 2 - open, failed: open, durationMs: 4120,
      result: open === 0 ? 'succeeded' : 'completedWithIssues', note: 'Feed restored · caught up on 2 delayed changes',
    });
    state.audit('sync', 'Reservation feed restored', 'success', 'Track feed', { detail: 'Caught up on 2 delayed changes' });
  } else if (previous === 'provisioningInterrupted') {
    state.audit('sync', 'Controller connection restored', 'success', 'UniFi Access', { detail: 'Interrupted writes can now be retried' });
  }

  state.scenario = next;
  if (next === 'feedUnavailable') {
    addFailedRun(state, state.now, 'scheduled');
    state.audit('sync', 'Reservation feed unavailable', 'warning', 'Track feed', {
      detail: `No response since ${clock(state.feedLastReceivedAt)} · existing access status requires confirmation`,
    });
    return result('succeeded', 'Feed outage simulated.');
  }
  if (next === 'provisioningInterrupted') {
    interrupt(state);
    return result('succeeded', 'Provisioning interruption simulated.');
  }
  return result('succeeded', 'Normal operation restored.');
}

function interrupt(state: DemoState) {
  if (state.findPerson(INTERRUPTED_GUEST_ID)) {
    if (!state.openIssueFor(INTERRUPTED_GUEST_ID)) {
      state.audit('sync', 'Controller connection interrupted', 'warning', 'UniFi Access', { detail: 'New credential writes will fail until restored' });
    }
    return;
  }

  const person: Person = {
    id: INTERRUPTED_GUEST_ID, name: 'Riley Chen', type: 'strGuest', unit: '1008', role: null, hostUnit: null,
    email: 'riley.chen@example.com', phone: '(850) 555-0177', featured: true,
  };
  state.people.push(person);

  const arrival = dayOf(state.now) + 1;
  const stay: Stay = {
    id: state.nextId('stay'), personId: person.id, reservationId: 'TRK-771204', source: 'Track Hospitality', unit: '1008',
    checkIn: atDay(arrival, 16), checkOut: atDay(arrival + 4, 10), expectedArrival: atDay(arrival, 17, 30), guests: 4,
    state: 'confirmed', receivedAt: state.now - MINUTE, isShortTerm: true,
  };
  state.stays.push(stay);

  const credential = new Credential(state.nextId('cred'), person.id, stay.id, 'pinAndQr', '640297', state.unitMappings.get('1008') ?? null, stay.checkIn, stay.checkOut);
  credential.markFailed(CONTROLLER_UNAVAILABLE);
  state.credentials.push(credential);

  const issue = new SyncIssue(
    'iss-riley-chen', 'provisioningInterrupted', person.id, stay.id, '1008',
    'Provisioning for Unit 1008 stopped before UniFi Access confirmed the credential.',
    'Retry once the controller connection is stable. The credential stays pending until confirmed.', state.now,
  );
  issue.attempts.push({ at: state.now, succeeded: false, detail: 'Write interrupted after reservation match — credential pending' });
  state.syncIssues.push(issue);

  const received = shortTermCount(state);
  const open = state.syncIssues.filter((i) => !i.isResolved).length;
  state.syncRuns.push({
    id: state.nextId('run'), startedAt: state.now, source: 'Demo reservation feed', trigger: 'scheduled',
    received, created: 1, updated: 0, unchanged: received - 1 - open, failed: open, durationMs: 31800,
    result: 'completedWithIssues', note: 'Provisioning interrupted for 1 new reservation',
  });
  state.audit('credential', 'Reservation received', 'info', 'Track feed', { person, detail: `${stay.reservationId} · arrives ${shortWeekdayDate(stay.checkIn)}` });
  state.audit('sync', 'Exception created', 'warning', 'Shoreline Access', { person, detail: 'Provisioning interrupted — credential pending' });
}

// ── GetSyncCenter ───────────────────────────────────────────────────────────

function getSyncCenter(state: DemoState) {
  const now = state.now;
  const open = state.syncIssues.filter((i) => !i.isResolved);
  const online = state.accessPoints.filter((a) => a.online).length;
  const outage = state.scenario === 'feedUnavailable';
  const interrupted = state.scenario === 'provisioningInterrupted';
  const plural = open.length === 1 ? '' : 's';

  const pipeline = [
    {
      key: 'source', name: 'Track Hospitality', caption: 'Demo reservation feed · CSV fallback scenario',
      health: outage ? 'down' : 'healthy', status: outage ? `No response · last received ${clock(state.feedLastReceivedAt)}` : 'Receiving',
    },
    {
      key: 'shoreline', name: 'Shoreline Access', caption: 'Matching, permissions and scheduling',
      health: open.length ? 'degraded' : 'healthy', status: open.length ? `${open.length} item${plural} need review` : 'All records matched',
    },
    {
      key: 'unifi', name: 'UniFi Access', caption: 'Credential provisioning (simulated)',
      health: interrupted ? 'down' : online < state.accessPoints.length ? 'degraded' : 'healthy',
      status: interrupted ? 'Writes interrupted' : `${online} of ${state.accessPoints.length} access points online`,
    },
  ];

  const runs = state.syncRuns.filter((r) => r.startedAt <= now).sort((a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : -1));
  const lastGood = runs.find((r) => r.result !== 'failed' && r.trigger !== 'retry');
  const quarter = 15 * MINUTE;
  const nextRun = Math.floor(now / quarter) * quarter + quarter;

  const issues = [...state.syncIssues]
    .sort((a, b) => Number(a.isResolved) - Number(b.isResolved) || (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0) || a.createdAt - b.createdAt)
    .map((i) => {
      const person = state.findPerson(i.personId)!;
      const stay = state.stayFor(person.id);
      const action = i.kind === 'missingUnitMapping' && !state.unitMappings.has(i.unit) ? 'map' : i.kind === 'duplicateReservation' ? 'choose' : 'retry';
      return {
        id: i.id, kind: i.kind, personId: person.id, personName: person.name, initials: initials(person.name), unit: i.unit,
        reservationId: stay?.reservationId ?? null, checkIn: isoOrNull(stay?.checkIn), summary: i.summary, nextAction: i.nextAction,
        createdAt: iso(i.createdAt), resolvedAt: isoOrNull(i.resolvedAt), resolution: i.resolution,
        attempts: [...i.attempts].sort((a, b) => b.at - a.at).map((a) => ({ at: iso(a.at), succeeded: a.succeeded, detail: a.detail })),
        candidates: i.candidates.map((c) => ({ ...c, checkIn: iso(c.checkIn), checkOut: iso(c.checkOut), receivedAt: iso(c.receivedAt) })),
        action,
      };
    });

  return {
    scenario: state.scenario,
    pipeline,
    stats: {
      lastSuccessfulRun: isoOrNull(lastGood?.startedAt),
      nextScheduledRun: iso(nextRun),
      processedRecords: lastGood?.received ?? 0,
      unresolvedFailures: open.length,
      feedLastReceivedAt: iso(state.feedLastReceivedAt),
    },
    runs: runs.slice(0, 12).map((r) => ({ ...r, startedAt: iso(r.startedAt) })),
    issues,
    accessGroups: state.accessGroups.filter((g) => g.assignableToUnits)
      .map((g) => ({ id: g.id, name: g.name, description: g.description, accessPoints: g.accessPointIds.length })),
    affectedArrivals: outage
      ? upcomingArrivals(state).sort((a, b) => a.checkIn - b.checkIn)
        .map((s) => ({ personId: s.personId, name: state.findPerson(s.personId)!.name, unit: s.unit, checkIn: iso(s.checkIn) }))
      : [],
  };
}

export const syncRoutes: Route[] = [
  { method: 'GET', path: /^sync$/, handle: ({ state }) => getSyncCenter(state) },
  { method: 'POST', path: /^sync\/runs$/, latency: 1.8, handle: ({ state }) => runSync(state) },
  { method: 'POST', path: /^sync\/issues\/([^/]+)\/retry$/, latency: 1.4, handle: ({ state, params }) => retryIssue(state, params[0]) },
  { method: 'POST', path: /^sync\/issues\/([^/]+)\/map-unit$/, latency: 1.2, handle: ({ state, params, body }) => mapUnit(state, params[0], body) },
  {
    method: 'POST', path: /^sync\/issues\/([^/]+)\/choose-reservation$/, latency: 1.2,
    handle: ({ state, params, body }) => chooseReservation(state, params[0], body),
  },
  {
    method: 'PUT',
    path: /^sync\/scenario$/,
    handle: ({ state, body }) => {
      const scenario = enumParam(new URLSearchParams({ scenario: String(body['scenario'] ?? '') }), 'scenario', SCENARIOS);
      if (!scenario) throw new ValidationError({ scenario: ['Choose a scenario.'] });
      return applyScenario(state, scenario);
    },
  },
];
