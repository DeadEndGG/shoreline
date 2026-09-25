import { ActivityItem, DemoScenario, PersonSummary, SyncIssueKind } from '../../core/api/models';

export interface OverviewResponse {
  lifecycle: { created: number; activated: number; expired: number; revoked: number; manualExceptions: number; failedSyncs: number };
  greeting: string;
  now: string;
  metrics: { activeGuestStays: number; arrivalsToday: number; departuresToday: number; needsAttention: number };
  readiness: {
    ready: number;
    total: number;
    checkInAt: string | null;
    issues: { issueId: string; kind: SyncIssueKind; personId: string; personName: string; initials: string; unit: string; summary: string }[];
  };
  health: {
    scenario: DemoScenario;
    feedLastReceivedAt: string;
    feedStale: boolean;
    accessPointsOnline: number;
    accessPointsTotal: number;
    offline: { id: string; name: string; since: string }[];
    upcomingArrivalsAffected: number;
  };
  recentActivity: ActivityItem[];
}

export type StaysView = 'arrivals' | 'departures' | 'inHouse';

export interface StaysResponse {
  view: StaysView;
  total: number;
  matching: number;
  items: PersonSummary[];
}

export const issueKindLabels: Record<SyncIssueKind, string> = {
  provisioningTimeout: 'Provisioning timeout',
  missingUnitMapping: 'Missing unit mapping',
  duplicateReservation: 'Duplicate reservation',
  provisioningInterrupted: 'Provisioning interrupted',
};
