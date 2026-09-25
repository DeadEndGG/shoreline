import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { api } from '../../../core/api/api-url';
import { ActivityItem, categoryLabels } from '../../../core/api/models';
import { DemoState } from '../../../core/demo/demo-state';
import { liveResource } from '../../../core/demo/live-resource';
import { durationBetween } from '../../../core/time/property-time';
import { Panels } from '../../../core/ui/panels';
import { ActivityTimeline } from '../../../shared/ui/activity-timeline';
import { DialogSurface } from '../../../shared/ui/dialog-surface';
import { EmptyState } from '../../../shared/ui/empty-state';
import { Icon } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { AccessPointDetail, accessPointIcon } from '../access-points.models';
import { CameraStill } from './camera-still';

/** Read-only access point detail. Unlock controls are deliberately out of scope. */
@Component({
  selector: 'app-access-point-drawer',
  imports: [DialogSurface, Icon, StatusBadge, ActivityTimeline, Skeleton, EmptyState, CameraStill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-point-drawer.html',
  styleUrl: './access-point-drawer.scss',
})
export class AccessPointDrawer {
  protected readonly panels = inject(Panels);
  protected readonly demo = inject(DemoState);
  protected readonly categoryLabels = categoryLabels;
  protected readonly icon = accessPointIcon;

  private readonly detail = liveResource<AccessPointDetail>(() => {
    const id = this.panels.accessPointId();
    return id ? api(`access-points/${encodeURIComponent(id)}`) : undefined;
  });
  protected readonly data = computed(() => {
    const d = this.detail.value();
    return d && d.point.id === this.panels.accessPointId() ? d : undefined;
  });

  protected offlineFor(since: string | null) {
    return durationBetween(since, this.demo.now());
  }

  protected openEntry(item: ActivityItem) {
    if (item.personId) this.panels.openPerson(item.personId);
  }
}
