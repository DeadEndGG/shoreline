import { AccessRules, Credential, Person, firstName } from '../domain';
import { scheduleLabel } from '../projections';
import { NotFoundError, Route } from '../router';
import { DemoState } from '../state';
import { clock, dayOf, iso, isoOrNull, longDate, weekday, weekdayLongDate } from '../time';

/** "Your access begins Saturday at 4:00 PM and ends the following Saturday at 10:00 AM." */
export function accessWindowSentence(credential: Credential): string {
  const begins = `${weekday(credential.validFrom)} at ${clock(credential.validFrom)}`;
  if (credential.validUntil === null) {
    return `Your access began ${longDate(credential.validFrom)} and continues until changed by management.`;
  }
  const until = credential.validUntil;
  const days = dayOf(until) - dayOf(credential.validFrom);
  const ends =
    days === 0 ? `at ${clock(until)}`
    : days === 7 ? `the following ${weekday(until)} at ${clock(until)}`
    : days < 7 ? `${weekday(until)} at ${clock(until)}`
    : `${weekdayLongDate(until)} at ${clock(until)}`;
  return `Your access begins ${begins} and ends ${ends}.`;
}

/**
 * The guest-facing pass. The PIN and QR are only returned while the credential is usable
 * (scheduled or active) — ended, revoked or failed credentials never expose them.
 */
function getGuestPass(state: DemoState, person: Person, credential: Credential) {
  const status = AccessRules.statusOf(credential, state.stayFor(person.id), state.now);
  const pass = status === 'scheduled' ? 'ready' : status === 'active' ? 'active' : status === 'expired' ? 'ended' : status === 'revoked' ? 'revoked' : 'pending';
  const usable = pass === 'ready' || pass === 'active';

  const [statusLabel, headline, note] =
    pass === 'ready' ? ['Ready for your arrival', 'Your pass is ready', accessWindowSentence(credential)]
    : pass === 'active' ? ['Access active', 'Welcome in', accessWindowSentence(credential)]
    : pass === 'ended' ? ['Stay ended', 'Thanks for staying with us',
      `Your access ended ${weekday(credential.validUntil!)} at ${clock(credential.validUntil!)}. We hope to welcome you back to Shoreline Residences.`]
    : pass === 'revoked' ? ['Access revoked', 'This pass is no longer active', 'Please contact the front desk if you need access to the building.']
    : ['Being prepared', "We're finishing your access setup", 'The front desk will confirm your entry details before check-in. No action is needed from you.'];

  return {
    personId: person.id,
    firstName: firstName(person.name),
    name: person.name,
    unit: person.unit ?? person.hostUnit,
    state: pass,
    statusLabel,
    headline,
    note,
    validFrom: iso(credential.validFrom),
    validUntil: isoOrNull(credential.validUntil),
    schedule: credential.schedule ? scheduleLabel(credential.schedule) : null,
    pin: usable ? credential.pin : null,
    qrPayload: usable ? credential.qrPayload : null,
    areas: usable ? state.accessPointsFor(credential).map((a) => ({ id: a.id, name: a.name, category: a.category, kind: a.kind })) : [],
    arrivalInstructions: [
      'Park in any unreserved space on garage level P1, then use the parking pedestrian entry.',
      'At the lobby reader, scan your QR code or enter your PIN followed by the # key.',
      "Your unit's smart lock uses the same PIN. Beach towels are available at the pool gate.",
      'Quiet hours are 10:00 PM to 8:00 AM. Pool and beach gates close at 10:00 PM.',
    ],
    frontDesk: { phone: '(850) 555-0140', hours: 'Daily, 8:00 AM – 10:00 PM', email: 'frontdesk@example.com', location: 'Main lobby, ground floor' },
    now: iso(state.now),
  };
}

export const guestPassRoutes: Route[] = [
  {
    method: 'GET',
    path: /^guest-pass\/([^/]+)$/,
    handle: ({ state, params }) => {
      const person = state.findPerson(params[0]);
      const credential = state.credentialFor(params[0]);
      if (!person || !credential) throw new NotFoundError();
      return getGuestPass(state, person, credential);
    },
  },
];
