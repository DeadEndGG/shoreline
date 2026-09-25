import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { api, queryParams } from '../../core/api/api-url';
import { ActivityItem, AuditCategory, AuditResult } from '../../core/api/models';
import { liveResource } from '../../core/demo/live-resource';
import { propertyDateKey } from '../../core/time/property-time';
import { PropertyTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { activityIcon } from '../../shared/ui/activity-timeline';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon, IconName } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusBadge } from '../../shared/ui/status-badge';

interface ActivityResponse {
  total: number;
  matching: number;
  categoryCounts: Record<AuditCategory, number>;
  items: { event: ActivityItem; source: string }[];
}

@Component({
  selector: 'app-activity-page',
  imports: [Icon, StatusBadge, EmptyState, Skeleton, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity.page.html',
  styleUrl: './activity.page.scss',
})
export class ActivityPage {
  protected readonly panels = inject(Panels);

  protected readonly category = signal<AuditCategory | null>(null);
  protected readonly deniedOnly = signal(false);
  protected readonly search = signal('');
  protected readonly limit = signal(60);
  private readonly debounced = toSignal(toObservable(this.search).pipe(debounceTime(180)), { initialValue: '' });

  protected readonly activity = liveResource<ActivityResponse>(() => ({
    url: api('activity'),
    params: queryParams({
      category: this.category(),
      result: this.deniedOnly() ? 'denied' : null,
      q: this.debounced(),
      take: this.limit(),
    }),
  }));

  protected readonly categories: { key: AuditCategory; label: string; icon: IconName }[] = [
    { key: 'access', label: 'Access events', icon: 'door' },
    { key: 'credential', label: 'Credential lifecycle', icon: 'key' },
    { key: 'sync', label: 'Sync', icon: 'refresh' },
    { key: 'manual', label: 'Manual exceptions', icon: 'user' },
  ];

  protected readonly resultMeta: Record<AuditResult, { label: string; tone: 'success' | 'danger' | 'warning' | 'info'; icon: IconName }> = {
    success: { label: 'Success', tone: 'success', icon: 'circle-check' },
    denied: { label: 'Denied', tone: 'danger', icon: 'ban' },
    warning: { label: 'Warning', tone: 'warning', icon: 'warning' },
    info: { label: 'Info', tone: 'info', icon: 'info' },
  };

  /** Groups rows by property-time day while preserving newest-first order. */
  protected readonly days = computed(() => {
    const items = this.activity.value()?.items ?? [];
    const groups: { key: string; label: string; rows: typeof items }[] = [];
    for (const row of items) {
      const key = propertyDateKey(row.event.at);
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        group = { key, label: row.event.at, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  });

  protected readonly filtered = computed(() => !!this.category() || this.deniedOnly() || !!this.search().trim());
  protected readonly icon = activityIcon;

  protected open(item: ActivityItem) {
    if (item.personId) this.panels.openPerson(item.personId);
    else if (item.accessPointId) this.panels.openAccessPoint(item.accessPointId);
  }

  protected clear() {
    this.category.set(null);
    this.deniedOnly.set(false);
    this.search.set('');
  }
}
