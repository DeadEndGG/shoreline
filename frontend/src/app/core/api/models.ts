// Shared API contracts. Feature-specific response shapes live next to their feature.

export type PersonType = 'owner' | 'strGuest' | 'midtermRenter' | 'staff' | 'vendor' | 'visitor';
export type CredentialStatus = 'scheduled' | 'active' | 'needsAttention' | 'expired' | 'revoked';
export type CredentialMethod = 'pinAndQr' | 'keyCard' | 'pin';
export type ProvisioningState = 'pending' | 'succeeded' | 'failed';
export type AccessPointCategory = 'building' | 'amenity' | 'exterior' | 'service';
export type AccessPointKind = 'door' | 'gate' | 'room';
export type AuditCategory = 'access' | 'credential' | 'sync' | 'manual';
export type AuditResult = 'success' | 'denied' | 'warning' | 'info';
export type SyncIssueKind = 'provisioningTimeout' | 'missingUnitMapping' | 'duplicateReservation' | 'provisioningInterrupted';
export type DemoScenario = 'normal' | 'feedUnavailable' | 'provisioningInterrupted';

export interface PersonSummary {
  id: string;
  name: string;
  initials: string;
  type: PersonType;
  unit: string | null;
  role: string | null;
  reservationId: string | null;
  accessFrom: string | null;
  accessUntil: string | null;
  schedule: string | null;
  expectedArrival: string | null;
  method: CredentialMethod | null;
  status: CredentialStatus;
  accessGroup: string | null;
  hasOpenIssue: boolean;
}

export interface ActivityItem {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  personId: string | null;
  personName: string | null;
  unit: string | null;
  accessPointId: string | null;
  accessPointName: string | null;
  category: AuditCategory;
  result: AuditResult;
}

export interface ActionResult {
  outcome: 'succeeded' | 'failed' | 'alreadyResolved';
  message: string;
}

export interface ValidationProblem {
  title?: string;
  errors?: Record<string, string[]>;
}

export const personTypeLabels: Record<PersonType, string> = {
  owner: 'Owner',
  strGuest: 'STR guest',
  midtermRenter: 'Mid-term renter',
  staff: 'Staff',
  vendor: 'Vendor',
  visitor: 'Visitor',
};

export const methodLabels: Record<CredentialMethod, string> = {
  pinAndQr: 'PIN + QR',
  keyCard: 'NFC fob / card',
  pin: 'PIN',
};

export const categoryLabels: Record<AccessPointCategory, string> = {
  building: 'Building',
  amenity: 'Amenities',
  exterior: 'Exterior',
  service: 'Service',
};
