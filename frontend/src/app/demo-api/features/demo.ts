import { AccessRules, Person } from '../domain';
import { Route, Validator, enumParam } from '../router';
import { DemoClock, DemoState } from '../state';
import { clock, iso, zoneAbbreviation } from '../time';
import { addFailedRun } from './sync';

export function projectDemo(state: DemoState) {
  const checkInPassed = state.now >= DemoClock.checkIn;
  const checkoutPassed = state.now >= DemoClock.checkout;
  return {
    now: iso(state.now),
    timeZone: 'America/Chicago',
    zoneAbbreviation: zoneAbbreviation(state.now),
    scenario: state.scenario,
    checkIn: { at: iso(DemoClock.checkIn), available: !checkInPassed, unavailableReason: checkInPassed ? 'The demo clock is already past 4:00 PM check-in.' : null },
    checkout: { at: iso(DemoClock.checkout), available: !checkoutPassed, unavailableReason: checkoutPassed ? 'The demo clock is already at checkout. Reset to replay.' : null },
    manager: { name: DemoClock.managerName, role: DemoClock.managerRole, initials: 'MH' },
    property: { name: 'Shoreline Residences', city: 'Panama City Beach', units: 340, floors: 14, accessPoints: state.accessPoints.length },
  };
}

/**
 * Moves the demo clock forward to a story boundary and records every credential
 * lifecycle transition that the jump crossed, at the instant it happened.
 */
export function moveClockTo(state: DemoState, target: number) {
  const from = state.now;
  const activated: [Person, number][] = [];
  const expired: [Person, number][] = [];

  for (const credential of state.credentials) {
    const person = state.findPerson(credential.personId)!;
    const stay = credential.stayId === null ? null : state.stayFor(person.id);
    const before = AccessRules.statusOf(credential, stay, from);
    const after = AccessRules.statusOf(credential, stay, target);
    if (before === 'scheduled' && (after === 'active' || after === 'expired')) activated.push([person, credential.validFrom]);
    if ((before === 'scheduled' || before === 'active') && after === 'expired') expired.push([person, credential.validUntil!]);
  }

  state.now = target;
  if (state.scenario === 'feedUnavailable') {
    // The outage continues: the scheduled run at the new time fails too.
    addFailedRun(state, target, 'scheduled');
  } else {
    state.feedLastReceivedAt = target - 2 * 60_000;
  }

  record(state, activated, 'Access activated', 'Credential is now active', 'credentials became active');
  record(state, expired, 'Credential expired', 'Stay ended at checkout', 'credentials ended');
}

function record(state: DemoState, transitions: [Person, number][], title: string, detail: string, summary: string) {
  const groups = new Map<number, [Person, number][]>();
  for (const t of transitions) groups.set(t[1], [...(groups.get(t[1]) ?? []), t]);
  for (const [when, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    let generated = 0;
    for (const [person] of group) {
      if (person.featured) {
        state.audit('credential', title, 'info', 'Shoreline Access', { person, detail: `${detail} · ${clock(when)}`, at: when });
      } else {
        generated++;
      }
    }
    if (generated > 0) {
      const more = group.some(([p]) => p.featured) ? 'more ' : '';
      state.audit('credential', title, 'info', 'Shoreline Access', { detail: `${generated} ${more}${summary} at ${clock(when)}`, at: when });
    }
  }
}

export const demoRoutes: Route[] = [
  { method: 'GET', path: /^demo$/, handle: ({ state }) => projectDemo(state) },
  {
    method: 'POST',
    path: /^demo\/reset$/,
    handle: ({ store }) => {
      store.reset();
      return projectDemo(store.state);
    },
  },
  {
    method: 'POST',
    path: /^demo\/clock\/advance$/,
    handle: ({ state, body }) => {
      const target = enumParam(new URLSearchParams({ target: String(body['target'] ?? '') }), 'target', ['checkIn', 'checkout'] as const);
      const instant = target === 'checkIn' ? DemoClock.checkIn : DemoClock.checkout;
      new Validator().require(target !== null, 'target', 'Choose check-in or checkout.')
        .require(instant > state.now, 'target', 'The demo clock only moves forward. Reset the demo to replay.')
        .ensure();
      moveClockTo(state, instant);
      return projectDemo(state);
    },
  },
];
