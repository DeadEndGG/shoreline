import { ChangeDetectionStrategy, Component, afterRenderEffect, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { api } from '../../core/api/api-url';
import { errorMessage } from '../../core/api/api-errors';
import { DemoScenario } from '../../core/api/models';
import { DemoState } from '../../core/demo/demo-state';
import { liveResource } from '../../core/demo/live-resource';
import { PropertyTimePipe, RelativeTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { ToastService } from '../../core/ui/toast.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon, IconName } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusBadge } from '../../shared/ui/status-badge';
import { IssueCard } from './issue-card';
import { SyncApi } from './sync.api';
import { SyncCenter, SyncRunResult, SyncTrigger } from './sync.models';

type IssueFilter = 'open' | 'resolved' | 'all';

@Component({
  selector: 'app-sync-page',
  imports: [IssueCard, Icon, StatusBadge, EmptyState, Skeleton, PropertyTimePipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync.page.html',
  styleUrl: './sync.page.scss',
})
export class SyncPage {
  readonly filter = input<IssueFilter | undefined>(undefined);
  readonly issue = input<string | undefined>(undefined);

  protected readonly demo = inject(DemoState);
  protected readonly panels = inject(Panels);
  private readonly sync = inject(SyncApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly center = liveResource<SyncCenter>(() => api('sync'));
  protected readonly data = this.center.value;
  protected readonly running = signal(false);
  protected readonly switching = signal<DemoScenario | null>(null);

  protected readonly activeFilter = computed<IssueFilter>(() => this.filter() ?? 'open');
  protected readonly openIssues = computed(() => this.data()?.issues.filter((i) => !i.resolvedAt) ?? []);
  protected readonly resolvedIssues = computed(() => this.data()?.issues.filter((i) => i.resolvedAt) ?? []);
  protected readonly visibleIssues = computed(() => {
    const f = this.activeFilter();
    return f === 'open' ? this.openIssues() : f === 'resolved' ? this.resolvedIssues() : this.data()?.issues ?? [];
  });

  protected readonly scenarios: { key: DemoScenario; label: string; description: string; icon: IconName }[] = [
    { key: 'normal', label: 'Normal operation', description: 'Baseline fixtures and three arrival issues.', icon: 'circle-check' },
    { key: 'feedUnavailable', label: 'Track feed unavailable', description: 'Stale feed, failed runs, delayed upcoming provisioning.', icon: 'wifi-off' },
    { key: 'provisioningInterrupted', label: 'Provisioning interrupted', description: 'A new reservation stays pending until retried.', icon: 'circle-pause' },
  ];

  protected readonly triggerLabels: Record<SyncTrigger, string> = { scheduled: 'Scheduled', manual: 'Manual', retry: 'Retry', recovery: 'Recovery' };
  protected readonly resultMeta: Record<SyncRunResult, { label: string; tone: 'success' | 'warning' | 'danger'; icon: IconName }> = {
    succeeded: { label: 'Succeeded', tone: 'success', icon: 'circle-check' },
    completedWithIssues: { label: 'With issues', tone: 'warning', icon: 'warning' },
    failed: { label: 'Failed', tone: 'danger', icon: 'circle-x' },
  };

  constructor() {
    let scrolledTo: string | undefined;
    afterRenderEffect(() => {
      const id = this.issue();
      if (id && this.data() && scrolledTo !== id) {
        scrolledTo = id;
        document.getElementById(`issue-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  protected setFilter(filter: IssueFilter) {
    void this.router.navigate(['/sync'], { queryParams: { filter, issue: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async runSync() {
    this.running.set(true);
    try {
      const result = await this.sync.run();
      if (result.outcome === 'succeeded') this.toast.success('Sync complete', result.message);
      else this.toast.warning(this.demo.scenario() === 'feedUnavailable' ? 'Sync failed' : 'Sync complete with issues', result.message);
    } catch (error) {
      this.toast.error('Sync could not start', errorMessage(error));
    } finally {
      this.running.set(false);
    }
  }

  protected async setScenario(scenario: DemoScenario) {
    if (scenario === this.data()?.scenario) return;
    this.switching.set(scenario);
    try {
      await this.demo.setScenario(scenario);
      const label = this.scenarios.find((s) => s.key === scenario)!.label;
      this.toast.info(`Scenario: ${label}`, scenario === 'normal' ? 'Connections restored. Open issues still need a decision.' : 'Simulated failure applied to the shared demo state.');
    } catch (error) {
      this.toast.error('Could not change scenario', errorMessage(error));
    } finally {
      this.switching.set(null);
    }
  }

  protected duration(ms: number) {
    return ms >= 10000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;
  }

  protected stageIcon(health: string): IconName {
    return health === 'healthy' ? 'circle-check' : health === 'degraded' ? 'warning' : 'circle-x';
  }
}
