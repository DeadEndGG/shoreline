import { AccessPointCategory, AccessPointKind, ActivityItem, AuditResult } from '../../core/api/models';
import { IconName } from '../../shared/ui/icon';

export interface AccessPointItem {
  id: string;
  name: string;
  location: string;
  category: AccessPointCategory;
  kind: AccessPointKind;
  online: boolean;
  offlineSince: string | null;
  hasCamera: boolean;
  groups: string[];
  lastActivity: { at: string; title: string; personName: string | null; result: AuditResult } | null;
  entriesToday: number;
}

export interface AccessPointsResponse {
  total: number;
  online: number;
  categoryCounts: Record<AccessPointCategory, number>;
  items: AccessPointItem[];
}

export interface AccessPointDetail {
  point: AccessPointItem;
  groups: { id: string; name: string; description: string }[];
  recentEntries: ActivityItem[];
  camera: { label: string; note: string } | null;
}

const pointIcons: Record<string, IconName> = {
  'parking-entry': 'car', 'beach-gate-east': 'umbrella', 'beach-gate-west': 'umbrella', 'pool-gate': 'waves',
  'boardwalk-gate': 'fence', 'fitness-center': 'dumbbell', 'owners-lounge': 'sofa', mailroom: 'mailbox',
  'package-room': 'package', 'maintenance-room': 'wrench',
};

export function accessPointIcon(id: string): IconName {
  return pointIcons[id] ?? (id.includes('lobby') ? 'building' : 'door');
}
