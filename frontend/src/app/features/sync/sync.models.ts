import { DemoScenario, SyncIssueKind } from '../../core/api/models';

export type StageHealth = 'healthy' | 'degraded' | 'down';
export type SyncTrigger = 'scheduled' | 'manual' | 'retry' | 'recovery';
export type SyncRunResult = 'succeeded' | 'completedWithIssues' | 'failed';

export interface SyncIssue {
  id: string;
  kind: SyncIssueKind;
  personId: string;
  personName: string;
  initials: string;
  unit: string;
  reservationId: string | null;
  checkIn: string | null;
  summary: string;
  nextAction: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  attempts: { at: string; succeeded: boolean; detail: string }[];
  candidates: { reservationId: string; checkIn: string; checkOut: string; guests: number; receivedAt: string; note: string }[];
  action: 'retry' | 'map' | 'choose';
}

export interface SyncCenter {
  scenario: DemoScenario;
  pipeline: { key: string; name: string; caption: string; health: StageHealth; status: string }[];
  stats: { lastSuccessfulRun: string | null; nextScheduledRun: string; processedRecords: number; unresolvedFailures: number; feedLastReceivedAt: string };
  runs: {
    id: string; startedAt: string; source: string; trigger: SyncTrigger; received: number; created: number; updated: number;
    unchanged: number; failed: number; durationMs: number; result: SyncRunResult; note: string | null;
  }[];
  issues: SyncIssue[];
  accessGroups: { id: string; name: string; description: string; accessPoints: number }[];
  affectedArrivals: { personId: string; name: string; unit: string; checkIn: string }[];
}
