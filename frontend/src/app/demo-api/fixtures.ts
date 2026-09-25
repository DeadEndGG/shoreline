import { AccessPointCategory, AccessPointKind, CredentialMethod, PersonType } from '../core/api/models';
import { Credential, DailySchedule, Person, Stay, SyncIssue } from './domain';
import { DeterministicRandom } from './random';
import { DemoClock, DemoState } from './state';
import { DAY, HOUR, MINUTE, addMonths, at, atDay, dayOf } from './time';

/**
 * Deterministic seed data. Every name, unit, and number here is invented demo content.
 * Mirrors the C# fixtures so the browser-only and server-backed demos tell the same story.
 */
export const ACTIVE_STAY_COUNT = 186;
export const DEPARTED_TODAY_COUNT = 38;
export const ARRIVALS_TODAY_COUNT = 42;

const FIRST_NAMES = [
  'Olivia', 'Liam', 'Harper', 'Noah', 'Amelia', 'Ethan', 'Sofia', 'Mason', 'Isla', 'Lucas', 'Chloe', 'Owen',
  'Nora', 'Caleb', 'Grace', 'Wyatt', 'Hazel', 'Julian', 'Violet', 'Miles', 'Aurora', 'Rowan', 'Stella', 'Ezra',
  'Lila', 'Silas', 'Ruby', 'Declan', 'Ivy', 'Theo', 'Maya', 'Gavin', 'Clara', 'Reid', 'Eliza', 'Beckett', 'Naomi',
  'Asher', 'Lucy', 'Graham', 'Wren', 'Hudson', 'Tessa', 'Adrian', 'June', 'Carter', 'Leah', 'Parker', 'Iris',
  'Bennett', 'Sadie', 'Dylan', 'Margo', 'Felix', 'Quinn', 'Nolan', 'Paige', 'Emmett', 'Vera', 'Rhett', 'Alma',
];

const LAST_NAMES = [
  'Whitaker', 'Castillo', 'Donovan', 'Nguyen', 'Holloway', 'Patel', 'Sinclair', 'Brennan', 'Okafor', 'Lindqvist',
  'Marsh', 'Delgado', 'Fairbanks', 'Kowalski', 'Ashford', 'Moreau', 'Calloway', 'Yamada', 'Pruitt', 'Ramsey',
  'Harlow', 'Vance', 'Cortez', 'Beaumont', 'Kline', 'Abernathy', 'Soto', 'Merritt', 'Langford', 'Tran', 'Gallagher',
  'Hendricks', 'Oyelaran', 'Pierce', 'Bishop', 'Easton', 'Mercer', 'Figueroa', 'Halvorsen', 'Whitfield', 'Ashby',
  'Crane', 'Novak', 'Sterling', 'Dunmore', 'Quintero', 'Rasmussen', 'Talbot', 'Wexler', 'Iverson', 'Hayward',
];

const TODAY = dayOf(at(2026, 9, 26, 12));
const CHECK_IN_HOUR = 16;
const CHECK_OUT_HOUR = 10;
const schedule = (startHour: number, endHour: number, endMinute = 0): DailySchedule => ({ start: startHour * 60, end: endHour * 60 + endMinute });

export function createDemoState(): DemoState {
  const state = new DemoState(DemoClock.start, DemoClock.start - 2 * MINUTE);
  const ctx = new Context(state);
  seedAccessPoints(state);
  seedAccessGroups(state);
  seedUnitMappings(state);
  seedPeople(ctx);
  seedSyncHistory(ctx);
  seedActivity(ctx);
  return state;
}

// ── Access points & groups ──────────────────────────────────────────────────

function seedAccessPoints(state: DemoState) {
  const add = (id: string, name: string, location: string, category: AccessPointCategory, kind: AccessPointKind, hasCamera: boolean) =>
    state.accessPoints.push({ id, name, location, category, kind, hasCamera, online: true, offlineSince: null });

  add('main-lobby', 'Main lobby', 'Ground floor · North entrance', 'building', 'door', true);
  add('east-lobby', 'East lobby', 'Ground floor · East tower', 'building', 'door', true);
  add('west-lobby', 'West lobby', 'Ground floor · West tower', 'building', 'door', true);
  add('parking-entry', 'Parking pedestrian entry', 'Garage level P1', 'building', 'door', true);
  add('beach-gate-east', 'Beach gate east', 'Dune walkover · East', 'exterior', 'gate', true);
  add('beach-gate-west', 'Beach gate west', 'Dune walkover · West', 'exterior', 'gate', true);
  add('pool-gate', 'Pool gate', 'Pool deck · South', 'exterior', 'gate', true);
  add('boardwalk-gate', 'Boardwalk gate', 'Front Beach Road boardwalk', 'exterior', 'gate', true);
  add('fitness-center', 'Fitness center', 'Level 2 · Amenity deck', 'amenity', 'room', false);
  add('owners-lounge', 'Owners lounge', 'Level 2 · Amenity deck', 'amenity', 'room', false);
  add('mailroom', 'Mailroom', 'Ground floor · Main lobby', 'amenity', 'room', false);
  add('package-room', 'Package room', 'Ground floor · Main lobby', 'amenity', 'room', true);
  add('service-entry', 'Service entry', 'Loading dock · North', 'service', 'door', true);
  add('staff-entrance', 'Staff entrance', 'Back of house · West', 'service', 'door', true);
  add('maintenance-room', 'Maintenance room', 'Garage level P1', 'service', 'room', false);

  const serviceEntry = state.findAccessPoint('service-entry')!;
  serviceEntry.online = false;
  serviceEntry.offlineSince = DemoClock.start - 8 * MINUTE;
}

function seedAccessGroups(state: DemoState) {
  const lobbies = ['main-lobby', 'east-lobby', 'west-lobby', 'parking-entry'];
  const exterior = ['beach-gate-east', 'beach-gate-west', 'pool-gate', 'boardwalk-gate'];

  state.accessGroups.push(
    {
      id: 'guest-standard', name: 'Guest · Standard stay', assignableToUnits: true,
      description: 'Lobbies, parking, beach and pool gates, fitness center, package room.',
      accessPointIds: [...lobbies, ...exterior, 'fitness-center', 'package-room'],
    },
    {
      id: 'guest-oceanfront', name: 'Guest · Oceanfront suites', assignableToUnits: true,
      description: 'Standard stay access plus the owners lounge for premium suites.',
      accessPointIds: [...lobbies, ...exterior, 'fitness-center', 'package-room', 'owners-lounge'],
    },
    {
      id: 'owner-full', name: 'Owner · Full amenities', assignableToUnits: false,
      description: 'All residential and amenity spaces, including the owners lounge and mailroom.',
      accessPointIds: [...lobbies, ...exterior, 'fitness-center', 'owners-lounge', 'mailroom', 'package-room'],
    },
    {
      id: 'resident-midterm', name: 'Resident · Lease term', assignableToUnits: false,
      description: 'Guest amenities plus mailroom for lease-term residents.',
      accessPointIds: [...lobbies, ...exterior, 'fitness-center', 'mailroom', 'package-room'],
    },
    {
      id: 'staff-housekeeping', name: 'Staff · Housekeeping', assignableToUnits: false,
      description: 'Back-of-house routes, lobbies and package room during scheduled shifts.',
      accessPointIds: ['staff-entrance', 'service-entry', ...lobbies, 'package-room', 'pool-gate'],
    },
    {
      id: 'staff-maintenance', name: 'Staff · Maintenance', assignableToUnits: false,
      description: 'All common areas and service spaces during scheduled shifts.',
      accessPointIds: ['staff-entrance', 'service-entry', 'maintenance-room', ...lobbies, ...exterior, 'fitness-center'],
    },
    {
      id: 'vendor-service', name: 'Vendor · Service only', assignableToUnits: false,
      description: 'Service entry and maintenance room during the approved window.',
      accessPointIds: ['service-entry', 'maintenance-room'],
    },
    {
      id: 'visitor-day', name: 'Visitor · Day pass', assignableToUnits: false,
      description: 'Main lobby and pool gate while accompanied by a host.',
      accessPointIds: ['main-lobby', 'pool-gate'],
    },
  );
}

function allUnits(): string[] {
  const units: string[] = [];
  for (let floor = 2; floor <= 14; floor++) {
    for (let n = 1; n <= 26; n++) units.push(`${floor}${String(n).padStart(2, '0')}`);
  }
  return units;
}

function seedUnitMappings(state: DemoState) {
  for (const unit of allUnits()) {
    // Unit 1104 was recently renumbered after a renovation and never mapped: the arrival blocker.
    if (unit === '1104') continue;
    const n = Number(unit.slice(-2));
    state.unitMappings.set(unit, n <= 4 ? 'guest-oceanfront' : 'guest-standard');
  }
}

// ── People ──────────────────────────────────────────────────────────────────

function seedPeople(ctx: Context) {
  const s = ctx.state;
  const arrivalPrepared = atDay(TODAY, 12, 2);

  // Hero fixtures
  const avery = ctx.addPerson('Avery Morgan', 'strGuest', '807', { featured: true });
  ctx.addGuestStay(avery, TODAY, dayOf(at(2026, 10, 3, 12)), 21, 16 * 60 + 30, { pin: '482915', guests: 3, preparedAt: arrivalPrepared });

  const jordan = ctx.addPerson('Jordan Ellis', 'strGuest', '1104', { featured: true });
  const jordanStay = ctx.addGuestStay(jordan, TODAY, TODAY + 4, 9, 17 * 60 + 15, { pin: '730641', provisioned: false });
  s.credentialFor(jordan.id)!.markFailed('No access group is mapped to Unit 1104.');

  const taylor = ctx.addPerson('Taylor Reed', 'strGuest', '612', { featured: true });
  const taylorStay = ctx.addGuestStay(taylor, TODAY, TODAY + 5, 14, 18 * 60, { pin: '915372', provisioned: false });
  const taylorCredential = s.credentialFor(taylor.id)!;
  taylorCredential.accessGroupId = s.unitMappings.get('612')!;
  taylorCredential.markFailed('UniFi Access did not confirm the credential within 30 seconds.');

  const casey = ctx.addPerson('Casey Brooks', 'strGuest', '905', { featured: true });
  const caseyStay = ctx.addGuestStay(casey, TODAY, TODAY + 4, 14, 19 * 60 + 45, { pin: '268054', provisioned: false });

  const morgan = ctx.addPerson('Morgan Lane', 'owner', '1201', { featured: true });
  ctx.addCredential(morgan, null, 'keyCard', 'owner-full', at(2024, 3, 1, 9), null, '551204', at(2024, 3, 1, 9));

  const elena = ctx.addPerson('Elena Park', 'midtermRenter', '304', { featured: true });
  const elenaStay = ctx.addStay(elena, at(2026, 9, 1, 12), at(2026, 11, 30, 12), at(2026, 8, 14, 10), { shortTerm: false, source: 'Lease agreement' });
  ctx.addCredential(elena, elenaStay, 'pinAndQr', 'resident-midterm', elenaStay.checkIn, elenaStay.checkOut, '604418', at(2026, 8, 31, 12));

  const sam = ctx.addPerson('Sam Rivera', 'staff', null, { featured: true, role: 'Housekeeping' });
  ctx.addCredential(sam, null, 'keyCard', 'staff-housekeeping', at(2025, 5, 12, 8), null, '117630', at(2025, 5, 12, 8), schedule(8, 16));

  const hvac = ctx.addPerson('Coastal HVAC', 'vendor', null, { featured: true, role: 'HVAC service contractor' });
  ctx.addCredential(hvac, null, 'pin', 'vendor-service', at(2026, 9, 1), at(2026, 10, 31), '903311', at(2026, 8, 28, 15), schedule(9, 12));

  for (const unit of ['807', '1104', '612', '905', '1201', '304', '1008']) ctx.reserveUnit(unit);

  // Issues for the three blocked arrivals
  const firstAttempt = atDay(TODAY, 12, 1);
  const taylorIssue = new SyncIssue(
    'iss-taylor-reed', 'provisioningTimeout', taylor.id, taylorStay.id, '612',
    "UniFi Access did not confirm Taylor Reed's credential for Unit 612 in time.",
    'Retry provisioning — the reservation and mapping are valid.', firstAttempt,
  );
  taylorIssue.attempts.push(
    { at: firstAttempt, succeeded: false, detail: 'Controller timeout after 30 s' },
    { at: firstAttempt + 15 * MINUTE, succeeded: false, detail: 'Automatic retry timed out after 30 s' },
    { at: firstAttempt + 30 * MINUTE, succeeded: false, detail: 'Automatic retries paused after 2 attempts' },
  );

  const jordanIssue = new SyncIssue(
    'iss-jordan-ellis', 'missingUnitMapping', jordan.id, jordanStay.id, '1104',
    'Unit 1104 has no assigned access group.',
    'Choose the access group guests in Unit 1104 should receive.', firstAttempt,
  );
  jordanIssue.attempts.push({ at: firstAttempt, succeeded: false, detail: 'No access group mapped to Unit 1104 — credential not created' });

  const caseyIssue = new SyncIssue(
    'iss-casey-brooks', 'duplicateReservation', casey.id, caseyStay.id, '905',
    'Two overlapping reservations for Casey Brooks in Unit 905.',
    'Review both reservations and keep the correct one.', firstAttempt,
    [
      { reservationId: caseyStay.reservationId, checkIn: caseyStay.checkIn, checkOut: caseyStay.checkOut, guests: 2, receivedAt: caseyStay.receivedAt, note: 'Original booking via owner website' },
      {
        reservationId: `TRK-${Number(caseyStay.reservationId.slice(4)) + 4817}`, checkIn: caseyStay.checkIn,
        checkOut: atDay(dayOf(at(2026, 10, 1, 12)), CHECK_OUT_HOUR), guests: 3, receivedAt: at(2026, 9, 25, 21, 14),
        note: 'Modified booking — one extra night, 3 guests',
      },
    ],
  );
  caseyIssue.attempts.push({ at: firstAttempt, succeeded: false, detail: 'Held for review — duplicate reservation detected' });
  s.syncIssues.push(taylorIssue, jordanIssue, caseyIssue);

  // Departed earlier today
  const blake = ctx.addPerson('Blake Turner', 'strGuest', ctx.takeUnit(), { featured: true });
  const departedUnits = [blake.unit!];
  ctx.addGuestStay(blake, dayOf(at(2026, 9, 21, 12)), TODAY, 30, 17 * 60);
  for (let i = 1; i < DEPARTED_TODAY_COUNT; i++) {
    const person = ctx.addPerson(ctx.randomName(), 'strGuest', ctx.takeUnit());
    departedUnits.push(person.unit!);
    const checkIn = TODAY - ctx.random.next(3, 8);
    ctx.addGuestStay(person, checkIn, TODAY, ctx.random.next(10, 60), ctx.randomEta());
  }

  // Currently in house
  for (let i = 0; i < ACTIVE_STAY_COUNT; i++) {
    const person = ctx.addPerson(ctx.randomName(), 'strGuest', ctx.takeUnit());
    const checkIn = TODAY - ctx.random.next(1, 8);
    const checkOut = TODAY + ctx.random.next(1, 9);
    ctx.addGuestStay(person, checkIn, checkOut, ctx.random.next(7, 90), ctx.randomEta());
  }

  // Arriving today — most take over units that turned over this morning.
  for (let i = 0; i < ARRIVALS_TODAY_COUNT - 4; i++) {
    const name = ctx.randomName();
    const unit = i < departedUnits.length - 1 ? departedUnits[i + 1] : ctx.takeUnit();
    const person = ctx.addPerson(name, 'strGuest', unit);
    const checkOut = TODAY + ctx.random.next(2, 8);
    ctx.addGuestStay(person, TODAY, checkOut, ctx.random.next(5, 60), ctx.randomEta(), { preparedAt: arrivalPrepared + i * 1000 });
  }

  // Upcoming arrivals over the following week
  const upcomingPerDay = [5, 4, 3, 4, 3, 4, 8];
  upcomingPerDay.forEach((count, index) => {
    const arrival = TODAY + index + 1;
    for (let i = 0; i < count; i++) {
      const person = ctx.addPerson(ctx.randomName(), 'strGuest', ctx.takeUnit());
      const checkOut = arrival + ctx.random.next(3, 8);
      const received = ctx.random.next(3, 45);
      const eta = ctx.randomEta();
      const prepared = arrivalPrepared - ctx.random.next(60, 2000) * MINUTE;
      ctx.addGuestStay(person, arrival, checkOut, received, eta, { preparedAt: prepared });
    }
  });

  // Owners
  for (let i = 0; i < 23; i++) {
    const owner = ctx.addPerson(ctx.randomName(), 'owner', ctx.takeUnit());
    const since = at(2019 + ctx.random.next(0, 7), ctx.random.next(1, 13), ctx.random.next(1, 28), 9);
    ctx.addCredential(owner, null, 'keyCard', 'owner-full', since, null, ctx.randomPin(), since);
  }

  // Mid-term renters
  for (let i = 0; i < 9; i++) {
    const renter = ctx.addPerson(ctx.randomName(), 'midtermRenter', ctx.takeUnit());
    const start = at(2026, ctx.random.next(7, 10), 1, 12);
    const end = addMonths(start, ctx.random.next(3, 7));
    const stay = ctx.addStay(renter, start, end, start - 20 * DAY, { shortTerm: false, source: 'Lease agreement' });
    ctx.addCredential(renter, stay, 'pinAndQr', 'resident-midterm', start, end, ctx.randomPin(), start - DAY);
  }

  // Staff
  const staff: [string, string, string, number, number][] = [
    ['Priya Raman', 'Front desk lead', 'staff-housekeeping', 7, 15],
    ['Marcus Webb', 'Maintenance technician', 'staff-maintenance', 7, 16],
    ['Lena Ortiz', 'Housekeeping', 'staff-housekeeping', 8, 16],
    ['Andre Coleman', 'Night security', 'staff-maintenance', 22, 24],
    ['Hollis Grant', 'Maintenance supervisor', 'staff-maintenance', 6, 15],
    ['Rosa Villanueva', 'Housekeeping', 'staff-housekeeping', 9, 17],
    ['Tomas Reyes', 'Pool attendant', 'staff-housekeeping', 10, 18],
  ];
  for (const [name, role, group, startHour, endHour] of staff) {
    const person = ctx.addPerson(name, 'staff', null, { role });
    const since = at(2025, ctx.random.next(1, 13), ctx.random.next(1, 28), 8);
    const window = endHour === 24 ? schedule(startHour, 23, 59) : schedule(startHour, endHour);
    ctx.addCredential(person, null, 'keyCard', group, since, null, ctx.randomPin(), since, window);
  }

  // Vendors
  const vendors: [string, string, number, number][] = [
    ['Gulfside Pool Care', 'Pool maintenance', 7, 10],
    ['Emerald Coast Elevator', 'Elevator inspection', 9, 15],
    ['Bayline Pest Control', 'Quarterly pest service', 8, 11],
    ['Sandpiper Linen Co.', 'Linen delivery', 6, 9],
  ];
  for (const [name, role, startHour, endHour] of vendors) {
    const person = ctx.addPerson(name, 'vendor', null, { role });
    ctx.addCredential(person, null, 'pin', 'vendor-service', at(2026, 9, 1), at(2026, 12, 31), ctx.randomPin(), at(2026, 8, 30, 10), schedule(startHour, endHour));
  }

  // Visitors
  const visitors: [string, string, number, number][] = [
    ['Dana Whitfield', '1201', 14, 19],
    ['Chris Albright', '304', 11, 17],
  ];
  for (const [name, host, startHour, endHour] of visitors) {
    const person = ctx.addPerson(name, 'visitor', null, { role: `Guest of Unit ${host}`, hostUnit: host });
    ctx.addCredential(person, null, 'pinAndQr', 'visitor-day', atDay(TODAY, startHour), atDay(TODAY, endHour), ctx.randomPin(), atDay(TODAY, startHour - 1, 30));
  }
}

// ── Sync history ────────────────────────────────────────────────────────────

function seedSyncHistory(ctx: Context) {
  const s = ctx.state;
  const received = s.stays.filter((st) => st.isShortTerm).length;
  const first = atDay(TODAY, 12);
  for (let run = first; run < DemoClock.start; run += 15 * MINUTE) {
    const isFirst = run === first;
    const updated = isFirst ? 6 : ctx.random.next(0, 3);
    const created = isFirst ? ARRIVALS_TODAY_COUNT - 3 : 0;
    s.syncRuns.push({
      id: s.nextId('run'), startedAt: run, source: 'Demo reservation feed', trigger: 'scheduled',
      received, created, updated, failed: 3, unchanged: received - created - updated - 3,
      durationMs: 2100 + ctx.random.next(0, 1800) + (isFirst ? 34000 : 0),
      result: 'completedWithIssues',
      note: isFirst ? "Prepared credentials for today's 4:00 PM check-in" : null,
    });
  }

  s.syncRuns.unshift({
    id: 'run-0000', startedAt: atDay(TODAY, 6), source: 'Demo reservation feed', trigger: 'scheduled',
    received, created: 0, updated: 11, unchanged: received - 11, failed: 0, durationMs: 2480,
    result: 'succeeded', note: 'Overnight changes applied',
  });
}

// ── Activity ────────────────────────────────────────────────────────────────

function seedActivity(ctx: Context) {
  const s = ctx.state;
  const T = (h: number, m: number) => atDay(TODAY, h, m);
  const P = (id: string) => s.findPerson(id)!;
  const A = (id: string) => s.findAccessPoint(id)!;

  const yesterday = TODAY - 1;
  s.audit('sync', 'Sync run completed', 'success', 'Track feed', { detail: 'No changes', at: atDay(yesterday, 21) });
  s.audit('credential', 'Reservation modified', 'info', 'Track feed', { person: P('casey-brooks'), detail: 'Second reservation received for Unit 905 (3 guests, +1 night)', at: atDay(yesterday, 21, 14) });
  s.audit('sync', 'Sync run completed', 'success', 'Track feed', { detail: '11 overnight changes applied', at: T(6, 0) });

  // Deterministic background access traffic.
  const inHouse = s.stays.filter((st) => st.isShortTerm && st.checkIn < DemoClock.start && st.checkOut > DemoClock.start).map((st) => st.personId);
  const departed = s.stays.filter((st) => st.isShortTerm && dayOf(st.checkOut) === TODAY).map((st) => st.personId);
  for (let i = 0; i < 46; i++) {
    const minute = 6 * 60 + 40 + ctx.random.next(0, 9 * 60);
    const when = T(Math.floor(minute / 60), minute % 60);
    const pool = when < T(10, 0) && i % 3 === 0 ? departed : inHouse;
    const person = P(pool[ctx.random.next(0, pool.length)]);
    const credential = s.credentialFor(person.id)!;
    const points = s.accessPointsFor(credential).filter((a) => a.online || (a.offlineSince ?? 0) > when);
    const point = points[ctx.random.next(0, points.length)];
    s.audit('access', 'Access granted', 'success', 'UniFi Access', { person, accessPoint: point, detail: 'PIN', at: when });
  }

  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('elena-park'), accessPoint: A('fitness-center'), detail: 'Mobile QR', at: T(7, 12) });
  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('sam-rivera'), accessPoint: A('staff-entrance'), detail: 'Key card · on shift', at: T(7, 56) });
  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('coastal-hvac'), accessPoint: A('service-entry'), detail: 'PIN · within 9:00 AM–12:00 PM window', at: T(9, 4) });
  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('coastal-hvac'), accessPoint: A('maintenance-room'), detail: 'PIN', at: T(9, 11) });

  s.audit('credential', 'Credential expired', 'info', 'Shoreline Access', { detail: `${DEPARTED_TODAY_COUNT} guest credentials ended at 10:00 AM checkout`, at: T(10, 0) });
  s.audit('credential', 'Credential expired', 'info', 'Shoreline Access', { person: P('blake-turner'), detail: 'Stay ended at 10:00 AM checkout', at: T(10, 0) });
  s.audit('access', 'Access denied', 'denied', 'UniFi Access', { person: P('blake-turner'), accessPoint: A('beach-gate-east'), detail: 'Credential expired at 10:00 AM checkout', at: T(11, 12) });

  s.audit('sync', 'Sync run completed with issues', 'warning', 'Track feed', { detail: '39 credentials prepared · 3 need attention', at: T(12, 0) });
  s.audit('credential', 'Credential prepared', 'success', 'Shoreline Access', { person: P('avery-morgan'), detail: 'Scheduled for Sep 26, 4:00 PM → Oct 3, 10:00 AM', at: T(12, 2) });
  s.audit('credential', 'Credentials prepared', 'success', 'Shoreline Access', { detail: `${ARRIVALS_TODAY_COUNT - 4} more arrival credentials scheduled for 4:00 PM`, at: T(12, 2) });
  s.audit('sync', 'Exception created', 'warning', 'Shoreline Access', { person: P('taylor-reed'), detail: 'Provisioning timed out', at: T(12, 1) });
  s.audit('sync', 'Exception created', 'warning', 'Shoreline Access', { person: P('jordan-ellis'), detail: 'Unit 1104 has no assigned access group', at: T(12, 1) });
  s.audit('sync', 'Exception created', 'warning', 'Shoreline Access', { person: P('casey-brooks'), detail: 'Duplicate reservation held for review', at: T(12, 1) });

  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('dana-whitfield'), accessPoint: A('main-lobby'), detail: 'Visitor QR · host Unit 1201', at: T(14, 6) });
  s.audit('access', 'Access granted', 'success', 'UniFi Access', { person: P('morgan-lane'), accessPoint: A('owners-lounge'), detail: 'Key card', at: T(14, 20) });
  s.audit('access', 'Access point offline', 'warning', 'UniFi Access', { accessPoint: A('service-entry'), detail: 'Controller lost contact with the service entry reader', at: T(15, 37) });
  s.audit('sync', 'Reservation feed received', 'success', 'Track feed', { detail: 'No changes', at: T(15, 43) });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '-').replaceAll('--', '-').replace(/^-+|-+$/g, '');
}

function shuffle<T>(items: T[], random: DeterministicRandom): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random.next(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

class Context {
  private readonly names = new Set<string>();
  private readonly pins = new Set<string>();
  private readonly units = shuffle(allUnits(), new DeterministicRandom(19));
  private unitIndex = 0;
  private readonly reserved = new Set<string>();
  readonly random = new DeterministicRandom(2026);

  constructor(readonly state: DemoState) {}

  reserveUnit(unit: string) {
    this.reserved.add(unit);
  }

  takeUnit(): string {
    let unit: string;
    do {
      unit = this.units[this.unitIndex++];
    } while (this.reserved.has(unit));
    this.reserved.add(unit);
    return unit;
  }

  randomName(): string {
    for (;;) {
      const name = `${FIRST_NAMES[this.random.next(0, FIRST_NAMES.length)]} ${LAST_NAMES[this.random.next(0, LAST_NAMES.length)]}`;
      if (!this.names.has(name)) {
        this.names.add(name);
        return name;
      }
    }
  }

  randomPin(): string {
    for (;;) {
      const pin = String(this.random.next(100000, 1000000));
      if (!this.pins.has(pin)) {
        this.pins.add(pin);
        return pin;
      }
    }
  }

  /** Expected arrival between 4:00 and 8:30 PM, in minutes after midnight. */
  randomEta(): number {
    return 16 * 60 + this.random.next(0, 19) * 15;
  }

  addPerson(name: string, type: PersonType, unit: string | null, options: { featured?: boolean; role?: string; hostUnit?: string } = {}): Person {
    this.names.add(name);
    const base = slug(name);
    let id = base;
    for (let n = 2; this.state.findPerson(id); n++) id = `${base}-${n}`;
    const person: Person = {
      id, name, type, unit,
      role: options.role ?? null,
      hostUnit: options.hostUnit ?? null,
      email: `${base.replaceAll('-', '.')}@example.com`,
      phone: `(850) 555-${String(this.random.next(100, 200)).padStart(4, '0')}`,
      featured: options.featured ?? false,
    };
    this.state.people.push(person);
    return person;
  }

  addStay(
    person: Person, checkIn: number, checkOut: number, receivedAt: number,
    options: { shortTerm?: boolean; source?: string; eta?: number | null; guests?: number } = {},
  ): Stay {
    const stay: Stay = {
      id: this.state.nextId('stay'),
      personId: person.id,
      reservationId: `TRK-${this.random.next(400000, 900000)}`,
      source: options.source ?? 'Track Hospitality',
      unit: person.unit!,
      checkIn,
      checkOut,
      expectedArrival: options.eta !== undefined && options.eta !== null ? atDay(dayOf(checkIn), Math.floor(options.eta / 60), options.eta % 60) : null,
      guests: options.guests ?? 2,
      state: 'confirmed',
      receivedAt,
      isShortTerm: options.shortTerm ?? true,
    };
    this.state.stays.push(stay);
    return stay;
  }

  addGuestStay(
    person: Person, checkInDay: number, checkOutDay: number, receivedDaysBefore: number, eta: number,
    options: { pin?: string; provisioned?: boolean; guests?: number; preparedAt?: number } = {},
  ): Stay {
    const from = atDay(checkInDay, CHECK_IN_HOUR);
    const until = atDay(checkOutDay, CHECK_OUT_HOUR);
    const guests = options.guests ?? this.random.next(1, 6);
    const stay = this.addStay(person, from, until, from - receivedDaysBefore * DAY, { eta, guests });
    const group = this.state.unitMappings.get(person.unit!) ?? null;
    const provisioned = options.provisioned ?? true;
    const pin = options.pin ?? this.randomPin();
    const credential = this.addCredential(person, stay, 'pinAndQr', group, from, until, pin, provisioned ? options.preparedAt ?? from - 4 * HOUR : null);
    if (!provisioned) credential.accessGroupId = null;
    return stay;
  }

  addCredential(
    person: Person, stay: Stay | null, method: CredentialMethod, groupId: string | null, from: number, until: number | null,
    pin: string, preparedAt: number | null, window: DailySchedule | null = null,
  ): Credential {
    this.pins.add(pin);
    const credential = new Credential(this.state.nextId('cred'), person.id, stay?.id ?? null, method, pin, groupId, from, until, window);
    if (preparedAt !== null && groupId !== null) credential.markProvisioned(preparedAt, groupId);
    this.state.credentials.push(credential);
    return credential;
  }
}
