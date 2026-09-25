import {
  AccessPointCategory, ActivityItem, CredentialMethod, PersonSummary, PersonType, ProvisioningState, SyncIssueKind,
} from '../../core/api/models';

export type Segment = 'activeStays' | 'arrivalsToday' | 'departuresToday';

export interface PeopleResponse {
  total: number;
  matching: number;
  typeCounts: Record<PersonType, number>;
  items: PersonSummary[];
}

export interface PersonDetail {
  summary: PersonSummary;
  email: string;
  phone: string;
  stay: {
    reservationId: string;
    source: string;
    unit: string;
    checkIn: string;
    checkOut: string;
    expectedArrival: string | null;
    guests: number;
    state: 'confirmed' | 'cancelled';
    isShortTerm: boolean;
  } | null;
  credential: {
    id: string;
    method: CredentialMethod;
    methodLabel: string;
    pin: string;
    qrPayload: string;
    provisioning: ProvisioningState;
    provisioningError: string | null;
    preparedAt: string | null;
    validFrom: string;
    validUntil: string | null;
    schedule: string | null;
    canEnterNow: boolean;
    accessGroup: string | null;
    revokedAt: string | null;
    revokeReason: string | null;
  } | null;
  locations: { id: string; name: string; place: string; category: AccessPointCategory; online: boolean }[];
  lifecycle: { key: string; label: string; state: 'done' | 'current' | 'failed' | 'upcoming'; at: string | null; detail: string | null }[];
  issue: { id: string; kind: SyncIssueKind; summary: string; nextAction: string } | null;
  activity: ActivityItem[];
  actions: { canExtend: boolean; extendDisabledReason: string | null; canRevoke: boolean; revokeDisabledReason: string | null; hasGuestPass: boolean };
}

export interface MessagePreview {
  email: { to: string; from: string; subject: string; preheader: string; paragraphs: string[]; passLink: string };
  sms: { to: string; text: string };
  canResend: boolean;
  resendDisabledReason: string | null;
  lastResentAt: string | null;
}

export interface TemporaryAccessRequest {
  name: string;
  type: 'visitor' | 'vendor';
  host: string;
  accessPointIds: string[];
  start: string;
  end: string;
  reason: string;
}
