import {
  AccessPointCategory, AccessPointKind, AuditCategory, AuditResult, CredentialMethod, CredentialStatus, DemoScenario,
  PersonType, ProvisioningState, SyncIssueKind,
} from '../core/api/models';
import { minuteOfDay } from './time';

export type ReservationState = 'confirmed' | 'cancelled';
export type SyncTrigger = 'scheduled' | 'manual' | 'retry' | 'recovery';
export type SyncRunResult = 'succeeded' | 'completedWithIssues' | 'failed';
export type { DemoScenario };

export interface Person {
  id: string;
  name: string;
  type: PersonType;
  unit: string | null;
  role: string | null;
  hostUnit: string | null;
  email: string;
  phone: string;
  /** Hero fixtures get individual audit entries; generated records are summarised. */
  featured: boolean;
}

export const initials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const firstName = (name: string) => name.split(' ')[0];

export interface Stay {
  id: string;
  personId: string;
  reservationId: string;
  source: string;
  unit: string;
  checkIn: number;
  checkOut: number;
  expectedArrival: number | null;
  guests: number;
  state: ReservationState;
  receivedAt: number;
  /** Short-term rental stay (as opposed to a mid-term lease). */
  isShortTerm: boolean;
}

/** Daily window in minutes after property midnight. */
export interface DailySchedule { start: number; end: number }

export class Credential {
  provisioning: ProvisioningState = 'pending';
  provisioningError: string | null = null;
  preparedAt: number | null = null;
  /** How many times the controller accepted this credential. Must stay at 1. */
  controllerWrites = 0;
  revokedAt: number | null = null;
  revokeReason: string | null = null;

  constructor(
    readonly id: string,
    readonly personId: string,
    readonly stayId: string | null,
    readonly method: CredentialMethod,
    readonly pin: string,
    public accessGroupId: string | null,
    public validFrom: number,
    public validUntil: number | null,
    readonly schedule: DailySchedule | null = null,
    /** Explicit locations for temporary access; overrides the group when set. */
    readonly accessPointIds: string[] | null = null,
  ) {}

  get qrPayload() {
    return `SHORELINE-DEMO|${this.id}|NOT-VALID-FOR-ENTRY`;
  }

  get isRevoked() {
    return this.revokedAt !== null;
  }

  revoke(at: number, reason: string) {
    if (this.isRevoked) return;
    this.revokedAt = at;
    this.revokeReason = reason;
  }

  /** Idempotent: provisioning an already provisioned credential is a no-op. */
  markProvisioned(at: number, accessGroupId: string | null): boolean {
    if (this.provisioning === 'succeeded') return false;
    this.provisioning = 'succeeded';
    this.provisioningError = null;
    this.preparedAt = at;
    this.accessGroupId ??= accessGroupId;
    this.controllerWrites++;
    return true;
  }

  markFailed(error: string) {
    if (this.provisioning === 'succeeded') return;
    this.provisioning = 'failed';
    this.provisioningError = error;
  }
}

export interface AccessGroup {
  id: string;
  name: string;
  description: string;
  accessPointIds: string[];
  assignableToUnits: boolean;
}

export interface AccessPoint {
  id: string;
  name: string;
  location: string;
  category: AccessPointCategory;
  kind: AccessPointKind;
  online: boolean;
  offlineSince: number | null;
  hasCamera: boolean;
}

export interface SyncAttempt { at: number; succeeded: boolean; detail: string }

export interface ReservationCandidate {
  reservationId: string;
  checkIn: number;
  checkOut: number;
  guests: number;
  receivedAt: number;
  note: string;
}

export class SyncIssue {
  resolvedAt: number | null = null;
  resolution: string | null = null;
  readonly attempts: SyncAttempt[] = [];

  constructor(
    readonly id: string,
    readonly kind: SyncIssueKind,
    readonly personId: string,
    readonly stayId: string,
    readonly unit: string,
    readonly summary: string,
    readonly nextAction: string,
    readonly createdAt: number,
    readonly candidates: ReservationCandidate[] = [],
  ) {}

  get isResolved() {
    return this.resolvedAt !== null;
  }

  resolve(at: number, resolution: string) {
    this.resolvedAt ??= at;
    this.resolution ??= resolution;
  }
}

export interface SyncRun {
  id: string;
  startedAt: number;
  source: string;
  trigger: SyncTrigger;
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  durationMs: number;
  result: SyncRunResult;
  note: string | null;
}

export interface AuditEvent {
  id: string;
  at: number;
  category: AuditCategory;
  title: string;
  detail: string | null;
  personId: string | null;
  personName: string | null;
  unit: string | null;
  accessPointId: string | null;
  accessPointName: string | null;
  source: string;
  result: AuditResult;
  /** Monotonic sequence to keep ordering stable for events with the same timestamp. */
  sequence: number;
}

/**
 * The single source of truth for "does this person have access right now?".
 * Provisioning, reservation and lifecycle states are kept separate and combined only here.
 */
export const AccessRules = {
  statusOf(credential: Credential, stay: Stay | null, now: number): CredentialStatus {
    if (credential.isRevoked || stay?.state === 'cancelled') return 'revoked';
    // Failed or pending provisioning never produces active access.
    if (credential.provisioning !== 'succeeded') return 'needsAttention';
    // Checkout is an exclusive end boundary.
    if (credential.validUntil !== null && now >= credential.validUntil) return 'expired';
    return now < credential.validFrom ? 'scheduled' : 'active';
  },

  /** Active status plus any staff/vendor schedule, evaluated in property time. */
  canEnterNow(credential: Credential, stay: Stay | null, now: number): boolean {
    if (AccessRules.statusOf(credential, stay, now) !== 'active') return false;
    if (!credential.schedule) return true;
    const minute = minuteOfDay(now);
    return minute >= credential.schedule.start && minute < credential.schedule.end;
  },

  /** "Ready" means provisioned and scheduled — not necessarily active yet. */
  isReady(credential: Credential, stay: Stay | null): boolean {
    return credential.provisioning === 'succeeded' && !credential.isRevoked && stay?.state !== 'cancelled';
  },
};
