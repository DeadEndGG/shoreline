import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { api, queryParams } from '../../core/api/api-url';
import { AccessPointCategory, categoryLabels } from '../../core/api/models';
import { DemoState } from '../../core/demo/demo-state';
import { liveResource } from '../../core/demo/live-resource';
import { durationBetween } from '../../core/time/property-time';
import { PropertyTimePipe, RelativeTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AccessPointsResponse, accessPointIcon } from './access-points.models';

@Component({
  selector: 'app-access-points-page',
  imports: [Icon, StatusBadge, EmptyState, Skeleton, PropertyTimePipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-points.page.html',
  styleUrl: './access-points.page.scss',
})
export class AccessPointsPage {
  protected readonly panels = inject(Panels);
  protected readonly demo = inject(DemoState);

  protected readonly category = signal<AccessPointCategory | null>(null);
  protected readonly layout = signal<'grid' | 'table'>(this.savedLayout());
  protected readonly categories: AccessPointCategory[] = ['building', 'amenity', 'exterior', 'service'];
  protected readonly categoryLabels = categoryLabels;
  protected readonly icon = accessPointIcon;

  protected readonly points = liveResource<AccessPointsResponse>(() => ({
    url: api('access-points'),
    params: queryParams({ category: this.category() }),
  }));
  protected readonly allCount = computed(() => {
    const c = this.points.value()?.categoryCounts;
    return c ? Object.values(c).reduce((a, b) => a + b, 0) : 0;
  });

  protected setLayout(layout: 'grid' | 'table') {
    this.layout.set(layout);
    try { localStorage.setItem('shoreline.ap-layout', layout); } catch { /* storage unavailable */ }
  }

  protected offlineFor(since: string | null) {
    return durationBetween(since, this.demo.now());
  }

  private savedLayout(): 'grid' | 'table' {
    try { return localStorage.getItem('shoreline.ap-layout') === 'table' ? 'table' : 'grid'; } catch { return 'grid'; }
  }
}
