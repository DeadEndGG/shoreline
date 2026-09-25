import { PersonType } from '../../core/api/models';
import { AccessRules, Credential, Person, Stay, SyncIssue, firstName } from '../domain';
import { DeterministicRandom } from '../random';
import { StaySegments, matchesSummary, methodLabel, scheduleLabel, toActivityItem, toSummary } from '../projections';
import { NotFoundError, Route, ValidationError, Validator, clamp, enumParam, intParam, str } from '../router';
import { DemoClock, DemoState } from '../state';
import { DAY, iso, isoOrNull, monthDayTime, parseLocal, shortWeekdayClock, weekdayDateAt } from '../time';
import { STATUSES } from './overview';

const TYPES: readonly PersonType[] = ['owner', 'strGuest', 'midtermRenter', 'staff', 'vendor', 'visitor'];
const SEGMENTS = ['activeStays', 'arrivalsToday', 'departuresToday'] as const;

// ── ListPeople ──────────────────────────────────────────────────────────────

function listPeople(state: DemoState, query: URLSearchParams) {
  const type = enumParam(query, 'type', TYPES);
  const segment = enumParam(query, 'segment', SEGMENTS);
  const status = enumParam(query, 'status', STATUSES);
  const q = query.get('q');
  const skip = Math.max(0, intParam(query, 'skip', 0));
  const take = clamp(intParam(query, 'take', 25), 1, 100);
  const now = state.now;
  const inSegment = (stay: Stay | null) =>
    segment === 'activeStays' ? !!stay && StaySegments.isActiveGuestStay(stay, now)
    : segment === 'arrivalsToday' ? !!stay && StaySegments.arrivesToday(stay, now)
    : segment === 'departuresToday' ? !!stay && StaySegments.departsToday(stay, now)
    : true;

  // Segment + search narrow the population; type counts reflect that population.
  const population = state.people
    .filter((p) => inSegment(state.stayFor(p.id)))
    .map((p) => toSummary(state, p))
    .filter((r) => matchesSummary(r, q))
    .filter((r) => status === null || r.status === status);

  const typeCounts = Object.fromEntries(TYPES.map((t) => [t, population.filter((r) => r.type === t).length]));
  const matching = population
    .filter((r) => type === null || r.type === type)
    .sort((a, b) => Number(!a.hasOpenIssue) - Number(!b.hasOpenIssue) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.name.localeCompare(b.name));

  return { total: state.people.length, matching: matching.length, typeCounts, items: matching.slice(skip, skip + take) };
}

// ── GetPerson ───────────────────────────────────────────────────────────────

export function projectPerson(state: DemoState, person: Person) {
  const stay = state.stayFor(person.id);
  const credential = state.credentialFor(person.id);
  const summary = toSummary(state, person);
  const issue = state.openIssueFor(person.id);
  const status = summary.status;
  const ended = status === 'revoked' || status === 'expired';

  return {
    summary,
    email: person.email,
    phone: person.phone,
    stay: stay && {
      reservationId: stay.reservationId, source: stay.source, unit: stay.unit, checkIn: iso(stay.checkIn), checkOut: iso(stay.checkOut),
      expectedArrival: isoOrNull(stay.expectedArrival), guests: stay.guests, state: stay.state, isShortTerm: stay.isShortTerm,
    },
    credential: credential && {
      id: credential.id,
      method: credential.method,
      methodLabel: methodLabel(credential.method),
      pin: credential.pin,
      qrPayload: credential.qrPayload,
      provisioning: credential.provisioning,
      provisioningError: credential.provisioningError,
      preparedAt: isoOrNull(credential.preparedAt),
      validFrom: iso(credential.validFrom),
      validUntil: isoOrNull(credential.validUntil),
      schedule: credential.schedule ? scheduleLabel(credential.schedule) : null,
      canEnterNow: AccessRules.canEnterNow(credential, stay, state.now),
      accessGroup: state.groupNameFor(credential),
      revokedAt: isoOrNull(credential.revokedAt),
      revokeReason: credential.revokeReason,
    },
    locations: credential
      ? state.accessPointsFor(credential).map((a) => ({ id: a.id, name: a.name, place: a.location, category: a.category, online: a.online }))
      : [],
    lifecycle: buildLifecycle(state, person, stay, credential, issue),
    issue: issue && { id: issue.id, kind: issue.kind, summary: issue.summary, nextAction: issue.nextAction },
    activity: state.auditTimeline().filter((e) => e.personId === person.id && e.at <= state.now).slice(0, 8).map(toActivityItem),
    actions: {
      canExtend: !!credential && !credential.isRevoked && credential.validUntil !== null,
      extendDisabledReason: !credential ? 'No credential exists for this person.'
        : credential.isRevoked ? "Revoked access can't be extended. Create temporary access instead."
        : credential.validUntil === null ? 'This access has no end date.'
        : null,
      canRevoke: !!credential && !ended,
      revokeDisabledReason: ended ? `Access is already ${status}.` : null,
      hasGuestPass: !!credential && ['strGuest', 'midtermRenter', 'visitor'].includes(person.type),
    },
  };
}

type StepState = 'done' | 'current' | 'failed' | 'upcoming';
const step = (key: string, label: string, state: StepState, at: number | null | undefined, detail: string | null) =>
  ({ key, label, state, at: isoOrNull(at), detail });

/** received → identity matched → permissions assigned → credential prepared → scheduled/active → expired/revoked. */
function buildLifecycle(state: DemoState, person: Person, stay: Stay | null, credential: Credential | null, issue: SyncIssue | null) {
  const now = state.now;
  const steps = [];
  const received = stay?.receivedAt ?? credential?.preparedAt ?? credential?.validFrom ?? null;
  const receivedLabel = stay === null
    ? ({ owner: 'Owner record created', staff: 'Staff profile created', vendor: 'Vendor approved' } as Record<string, string>)[person.type] ?? 'Access requested'
    : stay.isShortTerm ? 'Reservation received' : 'Lease received';

  steps.push(step('received', receivedLabel, 'done', received, stay ? `${stay.source} · ${stay.reservationId}` : null));

  const duplicate = issue?.kind === 'duplicateReservation';
  steps.push(duplicate
    ? step('identity', 'Identity matched', 'failed', issue!.createdAt, 'Two overlapping reservations — review needed')
    : step('identity', 'Identity matched', 'done', received === null ? null : received + 2000, person.email));

  const mappingGap = issue?.kind === 'missingUnitMapping';
  const groupName = credential ? state.groupNameFor(credential) : null;
  steps.push(mappingGap
    ? step('permissions', 'Permissions assigned', 'failed', issue!.createdAt, issue!.summary)
    : duplicate
      ? step('permissions', 'Permissions assigned', 'upcoming', null, 'Waiting for reservation review')
      : step('permissions', 'Permissions assigned', 'done', credential?.preparedAt ?? received, groupName));

  const provisioning = credential?.provisioning ?? 'pending';
  steps.push(provisioning === 'succeeded'
    ? step('prepared', 'Credential prepared', 'done', credential!.preparedAt, 'Written to UniFi Access (simulated)')
    : provisioning === 'failed' && !mappingGap
      ? step('prepared', 'Credential prepared', 'failed', issue?.attempts.at(-1)?.at ?? null, credential!.provisioningError)
      : step('prepared', 'Credential prepared', 'upcoming', null, 'Not yet created'));

  if (!credential) return steps;

  const status = AccessRules.statusOf(credential, stay, now);
  const activeState: StepState =
    status === 'scheduled' || status === 'active' ? 'current'
    : status === 'expired' ? 'done'
    : status === 'revoked' && (credential.revokedAt ?? 0) >= credential.validFrom ? 'done'
    : 'upcoming';
  steps.push(step('active', status === 'scheduled' ? 'Scheduled' : credential.validFrom > now ? 'Scheduled' : 'Active', activeState, credential.validFrom,
    status === 'scheduled' ? 'Becomes active at check-in' : credential.schedule ? scheduleLabel(credential.schedule) : 'Access window open'));

  steps.push(
    status === 'revoked' ? step('ended', 'Revoked', 'done', credential.revokedAt, credential.revokeReason)
    : status === 'expired' ? step('ended', 'Expired', 'done', credential.validUntil, 'Access window closed at checkout')
    : credential.validUntil !== null ? step('ended', 'Expires', 'upcoming', credential.validUntil, 'Ends automatically at checkout')
    : step('ended', 'No end date', 'upcoming', null, 'Continues until revoked'));

  return steps;
}

function requirePerson(state: DemoState, id: string): [Person, Credential] {
  const person = state.findPerson(id);
  const credential = state.credentialFor(id);
  if (!person || !credential) throw new NotFoundError();
  return [person, credential];
}

// ── ExtendAccess ────────────────────────────────────────────────────────────

function extendAccess(state: DemoState, id: string, body: Record<string, unknown>) {
  const [person, credential] = requirePerson(state, id);
  const until = parseLocal(str(body['until']));
  const v = new Validator()
    .require(!credential.isRevoked, 'until', "Revoked access can't be extended.")
    .require(credential.validUntil !== null, 'until', 'This access has no end date to extend.')
    .require(until !== null, 'until', 'Enter a valid end date and time.');
  if (until !== null) {
    v.require(until > credential.validFrom, 'until', 'The new end must be after the access start.')
      .require(until > state.now, 'until', 'The new end must be in the future.')
      .require(credential.validUntil === null || until > credential.validUntil, 'until', 'The new end must be later than the current end.');
  }
  v.ensure();

  const previous = credential.validUntil!;
  credential.validUntil = until!;
  const stay = state.stayFor(id);
  if (stay && credential.stayId === stay.id) stay.checkOut = until!;

  const note = str(body['note'])?.trim();
  state.audit('manual', 'Access extended', 'success', DemoClock.managerName, {
    person, detail: `${monthDayTime(previous)} → ${monthDayTime(until!)}${note ? ` · ${note}` : ''}`,
  });
  return projectPerson(state, person);
}

// ── RevokeAccess ────────────────────────────────────────────────────────────

/** Immediate, permanent revocation. Advancing the clock never reactivates it. */
function revokeAccess(state: DemoState, id: string, body: Record<string, unknown>) {
  const [person, credential] = requirePerson(state, id);
  const status = AccessRules.statusOf(credential, state.stayFor(id), state.now);
  const reason = str(body['reason'])?.trim() ?? '';
  new Validator()
    .require(reason.length >= 3, 'reason', 'Add a short reason for the audit log.')
    .require(status !== 'revoked' && status !== 'expired', 'reason', `Access is already ${status}.`)
    .ensure();

  credential.revoke(state.now, reason);
  state.openIssueFor(id)?.resolve(state.now, 'Access revoked by manager');
  state.audit('manual', 'Access revoked', 'warning', DemoClock.managerName, { person, detail: reason });
  return projectPerson(state, person);
}

// ── Message preview & simulated resend ──────────────────────────────────────

/** Renders the guest-facing email and SMS. Nothing is ever sent. */
function messagePreview(state: DemoState, person: Person, credential: Credential) {
  const status = AccessRules.statusOf(credential, state.stayFor(person.id), state.now);
  const unit = person.unit ?? person.hostUnit;
  const unitSuffix = unit ? `, Unit ${unit}` : '';
  const from = weekdayDateAt(credential.validFrom);
  const until = credential.validUntil !== null ? weekdayDateAt(credential.validUntil) : null;
  const hi = `Hi ${firstName(person.name)},`;

  const paragraphs = status === 'revoked' || status === 'expired'
    ? [hi, 'Your access to Shoreline Residences has ended. If you believe this is a mistake, please contact the front desk at (850) 555-0140.']
    : status === 'needsAttention'
      ? [hi, "We're finishing the setup of your building access. The front desk will confirm your entry details before check-in."]
      : [
        hi,
        `Your digital pass for Shoreline Residences${unitSuffix} is ready.`,
        until === null ? `Access begins ${from}.` : `Access begins ${from} and ends ${until}.`,
        'Show the QR code or enter your PIN at the lobby readers and amenity gates listed in your pass.',
      ];

  const smsText = status === 'scheduled' || status === 'active'
    ? `Shoreline Residences: your pass${unit ? ` for Unit ${unit}` : ''} is ready. Access begins ${shortWeekdayClock(credential.validFrom)}. View: shoreline.example.com/p/${person.id} (demo)`
    : 'Shoreline Residences: please contact the front desk at (850) 555-0140 about your building access. (demo)';

  const canResend = status !== 'revoked' && status !== 'expired';
  const resent = state.messagesResent.get(person.id);
  return {
    email: {
      to: person.email, from: 'Shoreline Residences <frontdesk@example.com>', subject: `Your access for Shoreline Residences${unitSuffix}`,
      preheader: 'Your digital pass, access window and arrival details.', paragraphs, passLink: `#/guest/${person.id}`,
    },
    sms: { to: person.phone, text: smsText },
    canResend,
    resendDisabledReason: canResend ? null : 'Access has ended, so there is nothing to resend.',
    lastResentAt: resent === undefined ? null : iso(resent),
  };
}

function resendMessage(state: DemoState, id: string, body: Record<string, unknown>) {
  const [person, credential] = requirePerson(state, id);
  const preview = messagePreview(state, person, credential);
  if (!preview.canResend) throw new ValidationError({ channel: [preview.resendDisabledReason!] });
  const sms = String(body['channel'] ?? '').toLowerCase() === 'sms';
  state.messagesResent.set(id, state.now);
  state.audit('manual', 'Guest message resent (simulated)', 'info', DemoClock.managerName, {
    person, detail: `${sms ? 'SMS' : 'Email'} to ${sms ? person.phone : person.email} · not actually sent`,
  });
  return messagePreview(state, person, credential);
}

// ── CreateTemporaryAccess ───────────────────────────────────────────────────

/** Manual exception: a visitor or vendor with explicit locations and a bounded window. */
function createTemporaryAccess(state: DemoState, body: Record<string, unknown>) {
  const name = str(body['name'])?.trim() ?? '';
  const host = str(body['host'])?.trim() ?? '';
  const reason = str(body['reason'])?.trim() ?? '';
  const type = String(body['type'] ?? '').toLowerCase();
  const pointIds = [...new Set(Array.isArray(body['accessPointIds']) ? (body['accessPointIds'] as unknown[]).map(String) : [])];
  const start = parseLocal(str(body['start']));
  const end = parseLocal(str(body['end']));

  const v = new Validator()
    .require(name.length >= 2, 'name', 'Enter the visitor or company name.')
    .require(type === 'visitor' || type === 'vendor', 'type', 'Choose visitor or vendor.')
    .require(host.length > 0, 'host', 'Enter the host unit or responsible staff member.')
    .require(pointIds.length > 0, 'accessPointIds', 'Choose at least one permitted location.')
    .require(pointIds.every((pid) => state.findAccessPoint(pid) !== null), 'accessPointIds', 'One or more locations are unknown.')
    .require(start !== null, 'start', 'Enter a valid start.')
    .require(end !== null, 'end', 'Enter a valid end.')
    .require(reason.length >= 3, 'reason', 'Add a short reason for the audit log.');
  if (start !== null && end !== null) {
    v.require(end > start, 'end', 'The end must be after the start.')
      .require(end > state.now, 'end', 'The end must be in the future.')
      .require(end - start <= 14 * DAY, 'end', 'Temporary access is limited to 14 days.');
  }
  v.ensure();

  const slugBase = name.toLowerCase().split(' ').filter(Boolean)
    .map((part) => [...part].filter((c) => /[\p{L}\p{N}]/u.test(c)).join('')).filter(Boolean).join('-');
  const base = slugBase || 'temporary';
  let id = base;
  for (let n = 2; state.findPerson(id); n++) id = `${slugBase}-${n}`;

  const isUnit = /^\d+$/.test(host);
  const person: Person = {
    id, name, type: type as PersonType,
    role: type === 'vendor' ? `Vendor · ${reason}` : isUnit ? `Guest of Unit ${host}` : `Guest of ${host}`,
    unit: null,
    hostUnit: isUnit ? host : null,
    email: `${id.replaceAll('-', '.')}@example.com`,
    phone: '(850) 555-0199',
    featured: true,
  };
  state.people.push(person);

  const random = new DeterministicRandom(Math.imul(state.people.length, 7919) >>> 0);
  const credential = new Credential(state.nextId('tmp'), person.id, null, 'pinAndQr', String(random.next(100000, 1000000)), null, start!, end!, null, pointIds);
  credential.markProvisioned(state.now, null);
  state.credentials.push(credential);

  state.audit('manual', 'Temporary access created', 'success', DemoClock.managerName, {
    person, detail: `${monthDayTime(start!)} → ${monthDayTime(end!)} · ${pointIds.length} location${pointIds.length === 1 ? '' : 's'} · ${reason}`,
  });
  return { personId: person.id, person: projectPerson(state, person) };
}

export const peopleRoutes: Route[] = [
  { method: 'GET', path: /^people$/, handle: ({ state, query }) => listPeople(state, query) },
  { method: 'POST', path: /^people\/temporary-access$/, latency: 0.8, status: 201, handle: ({ state, body }) => createTemporaryAccess(state, body) },
  {
    method: 'GET',
    path: /^people\/([^/]+)\/message$/,
    handle: ({ state, params }) => messagePreview(state, ...requirePerson(state, params[0])),
  },
  { method: 'POST', path: /^people\/([^/]+)\/message\/resend$/, latency: 0.6, handle: ({ state, params, body }) => resendMessage(state, params[0], body) },
  { method: 'POST', path: /^people\/([^/]+)\/extend$/, handle: ({ state, params, body }) => extendAccess(state, params[0], body) },
  { method: 'POST', path: /^people\/([^/]+)\/revoke$/, handle: ({ state, params, body }) => revokeAccess(state, params[0], body) },
  {
    method: 'GET',
    path: /^people\/([^/]+)$/,
    handle: ({ state, params }) => {
      const person = state.findPerson(params[0]);
      if (!person) throw new NotFoundError();
      return projectPerson(state, person);
    },
  },
];
