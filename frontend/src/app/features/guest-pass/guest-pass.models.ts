import { AccessPointCategory, AccessPointKind } from '../../core/api/models';

export type PassState = 'ready' | 'active' | 'ended' | 'revoked' | 'pending';

export interface GuestPass {
  personId: string;
  firstName: string;
  name: string;
  unit: string | null;
  state: PassState;
  statusLabel: string;
  headline: string;
  note: string;
  validFrom: string;
  validUntil: string | null;
  schedule: string | null;
  pin: string | null;
  qrPayload: string | null;
  areas: { id: string; name: string; category: AccessPointCategory; kind: AccessPointKind }[];
  arrivalInstructions: string[];
  frontDesk: { phone: string; hours: string; email: string; location: string };
  now: string;
}
