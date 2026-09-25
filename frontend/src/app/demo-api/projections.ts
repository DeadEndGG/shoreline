import { ActivityItem, CredentialMethod, PersonSummary } from '../core/api/models';
import { AccessRules, AuditEvent, DailySchedule, Person, Stay, initials } from './domain';
import { DemoState } from './state';
import { DAY, HOUR, clockOfMinutes, dayOf, iso, isoOrNull } from './time';

/** Row contract shared by the directory, the overview tables and search. */
export function toSummary(state: DemoState, person: Person): PersonSummary {
  const stay = state.stayFor(person.id);
  const credential = state.credentialFor(person.id);
  return {
    id: person.id,
    name: person.name,
    initials: initials(person.name),
    type: person.type,
    unit: person.unit ?? person.hostUnit,
    role: person.role,
    reservationId: stay?.reservationId ?? null,
    accessFrom: credential ? iso(credential.validFrom) : null,
    accessUntil: isoOrNull(credential?.validUntil),
    schedule: credential?.schedule ? scheduleLabel(credential.schedule) : null,
    expectedArrival: isoOrNull(stay?.expectedArrival),
    method: credential?.method ?? null,
    status: credential ? AccessRules.statusOf(credential, stay, state.now) : 'needsAttention',
    accessGroup: credential ? state.groupNameFor(credential) : null,
    hasOpenIssue: state.openIssueFor(person.id) !== null,
  };
}

export const scheduleLabel = (s: DailySchedule) => `Daily ${clockOfMinutes(s.start)}–${clockOfMinutes(s.end)}`;

export const methodLabel = (method: CredentialMethod) => (method === 'pinAndQr' ? 'PIN + QR' : method === 'keyCard' ? 'NFC fob / card' : 'PIN');

export function toActivityItem(e: AuditEvent): ActivityItem {
  return {
    id: e.id, at: iso(e.at), title: e.title, detail: e.detail, personId: e.personId, personName: e.personName,
    unit: e.unit, accessPointId: e.accessPointId, accessPointName: e.accessPointName, category: e.category, result: e.result,
  };
}

/** Date-based segments shared by overview metrics and the directory filters. */
export const StaySegments = {
  isActiveGuestStay: (stay: Stay, now: number) =>
    stay.isShortTerm && stay.state === 'confirmed' && stay.checkIn <= now && now < stay.checkOut,
  arrivesToday: (stay: Stay, now: number) =>
    stay.isShortTerm && stay.state === 'confirmed' && dayOf(stay.checkIn) === dayOf(now),
  departsToday: (stay: Stay, now: number) =>
    stay.isShortTerm && stay.state === 'confirmed' && dayOf(stay.checkOut) === dayOf(now),
};

export function upcomingArrivals(state: DemoState): Stay[] {
  return state.stays.filter((s) => s.isShortTerm && s.checkIn > state.now && s.checkIn <= state.now + 48 * HOUR);
}

export function matchesSummary(row: PersonSummary, q: string | null): boolean {
  const term = q?.trim().toLowerCase();
  if (!term) return true;
  return [row.name, row.unit, row.reservationId, row.role].some((v) => v?.toLowerCase().includes(term));
}

export const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const DAY_MS = DAY;
