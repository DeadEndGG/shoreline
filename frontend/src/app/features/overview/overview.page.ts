import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { api, queryParams } from '../../core/api/api-url';
import { ActivityItem, CredentialStatus, PersonSummary } from '../../core/api/models';
import { DemoState } from '../../core/demo/demo-state';
import { liveResource } from '../../core/demo/live-resource';
import { durationBetween } from '../../core/time/property-time';
import { PropertyTimePipe, RelativeTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { ActivityTimeline } from '../../shared/ui/activity-timeline';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon } from '../../shared/ui/icon';
import { MetricTile } from '../../shared/ui/metric-tile';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OverviewResponse, StaysResponse, StaysView, issueKindLabels } from './overview.models';

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink, MetricTile, Icon, Avatar, StatusBadge, ActivityTimeline, EmptyState, Skeleton, PropertyTimePipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.scss',
})
export class OverviewPage {
  protected readonly demo = inject(DemoState);
  protected readonly panels = inject(Panels);
  private readonly router = inject(Router);

  protected readonly overview = liveResource<OverviewResponse>(() => api('overview'));
  protected readonly data = this.overview.value;

  protected readonly view = signal<StaysView>('arrivals');
  protected readonly search = signal('');
  protected readonly status = signal<CredentialStatus | ''>('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(150)), { initialValue: '' });

  protected readonly stays = liveResource<StaysResponse>(() => ({
    url: api('overview/stays'),
    params: queryParams({ view: this.view(), q: this.debouncedSearch(), take: 8, status: this.status() }),
  }));

  protected readonly issueKindLabels = issueKindLabels;
  protected readonly readyPercent = computed(() => {
    const r = this.data()?.readiness;
    return r && r.total > 0 ? (r.ready / r.total) * 100 : 0;
  });
  protected readonly issuePercent = computed(() => {
    const r = this.data()?.readiness;
    return r && r.total > 0 ? (r.issues.length / r.total) * 100 : 0;
  });

  protected readonly tabs = computed(() => {
    const m = this.data()?.metrics;
    return [
      { key: 'arrivals' as const, label: 'Arrivals', count: m?.arrivalsToday },
      { key: 'departures' as const, label: 'Departures', count: m?.departuresToday },
      { key: 'inHouse' as const, label: 'In house', count: m?.activeGuestStays },
    ];
  });

  protected readonly viewAllLink = computed(() => {
    const segment = { arrivals: 'arrivalsToday', departures: 'departuresToday', inHouse: 'activeStays' }[this.view()];
    return { segment };
  });

  protected readonly viewAllLabel = computed(() => {
    const total = this.stays.value()?.total ?? 0;
    return { arrivals: `View all ${total} arrivals`, departures: `View all ${total} departures`, inHouse: `View all ${total} stays` }[this.view()];
  });

  protected readonly filtered = computed(() => !!this.search().trim() || !!this.status());

  protected offlineFor(since: string) {
    return durationBetween(since, this.demo.now());
  }

  protected setView(view: StaysView) {
    this.view.set(view);
  }

  protected clearFilters() {
    this.search.set('');
    this.status.set('');
  }

  protected open(row: PersonSummary) {
    this.panels.openPerson(row.id);
  }

  protected openActivity(item: ActivityItem) {
    if (item.personId) this.panels.openPerson(item.personId);
    else if (item.accessPointId) this.panels.openAccessPoint(item.accessPointId);
  }

  protected resolve(issueId: string) {
    void this.router.navigate(['/sync'], { queryParams: { issue: issueId } });
  }
}
