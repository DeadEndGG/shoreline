import { AuditCategory, AuditResult, DemoScenario } from '../core/api/models';
import {
  AccessGroup, AccessPoint, AuditEvent, Credential, Person, Stay, SyncIssue, SyncRun,
} from './domain';
import { at } from './time';

/** The fixed story timeline. The demo never reads the machine clock. */
export const DemoClock = {
  /** Saturday, September 26, 2026, 3:45 PM CDT. */
  start: at(2026, 9, 26, 15, 45),
  /** Standard check-in for today's arrivals. */
  checkIn: at(2026, 9, 26, 16, 0),
  /** Avery Morgan's checkout, exactly one week later. */
  checkout: at(2026, 10, 3, 10, 0),
  managerName: 'Morgan Hale',
  managerRole: 'Property manager',
};

/**
 * The entire in-memory "database" for the demo. There is no persistence:
 * reloading the page or choosing Reset demo restores the deterministic fixtures.
 */
export class DemoState {
  private sequence = 0;
  private readonly idCounters = new Map<string, number>();

  scenario: DemoScenario = 'normal';

  readonly people: Person[] = [];
  readonly stays: Stay[] = [];
  readonly credentials: Credential[] = [];
  readonly accessGroups: AccessGroup[] = [];
  readonly accessPoints: AccessPoint[] = [];
  readonly syncRuns: SyncRun[] = [];
  readonly syncIssues: SyncIssue[] = [];
  readonly auditEvents: AuditEvent[] = [];

  /** Guest unit → access group. A missing entry is a mapping gap. */
  readonly unitMappings = new Map<string, string>();
  /** Last simulated guest-message resend per person. */
  readonly messagesResent = new Map<string, number>();

  constructor(public now: number, public feedLastReceivedAt: number) {}

  nextId(prefix: string): string {
    const next = (this.idCounters.get(prefix) ?? 0) + 1;
    this.idCounters.set(prefix, next);
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  findPerson(id: string) { return this.people.find((p) => p.id === id) ?? null; }
  stayFor(personId: string) { return this.stays.find((s) => s.personId === personId) ?? null; }
  credentialFor(personId: string) { return this.credentials.find((c) => c.personId === personId) ?? null; }
  findAccessPoint(id: string) { return this.accessPoints.find((a) => a.id === id) ?? null; }
  findGroup(id: string | null | undefined) { return id ? this.accessGroups.find((g) => g.id === id) ?? null : null; }

  accessPointsFor(credential: Credential): AccessPoint[] {
    const ids = credential.accessPointIds ?? this.findGroup(credential.accessGroupId)?.accessPointIds ?? [];
    return this.accessPoints.filter((a) => ids.includes(a.id));
  }

  groupNameFor(credential: Credential): string | null {
    return credential.accessPointIds ? 'Temporary access' : this.findGroup(credential.accessGroupId)?.name ?? null;
  }

  openIssueFor(personId: string) {
    return this.syncIssues.find((i) => i.personId === personId && !i.isResolved) ?? null;
  }

  audit(
    category: AuditCategory,
    title: string,
    result: AuditResult,
    source: string,
    options: { person?: Person | null; accessPoint?: AccessPoint | null; detail?: string | null; at?: number } = {},
  ): AuditEvent {
    const { person, accessPoint } = options;
    const entry: AuditEvent = {
      id: this.nextId('evt'),
      at: options.at ?? this.now,
      category,
      title,
      detail: options.detail ?? null,
      personId: person?.id ?? null,
      personName: person?.name ?? null,
      unit: person?.unit ?? person?.hostUnit ?? null,
      accessPointId: accessPoint?.id ?? null,
      accessPointName: accessPoint?.name ?? null,
      source,
      result,
      sequence: ++this.sequence,
    };
    this.auditEvents.push(entry);
    return entry;
  }

  /** Newest first, stable for identical timestamps. */
  auditTimeline(): AuditEvent[] {
    return [...this.auditEvents].sort((a, b) => b.at - a.at || b.sequence - a.sequence);
  }
}
