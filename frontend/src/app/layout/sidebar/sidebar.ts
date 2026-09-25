import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { api } from '../../core/api/api-url';
import { DemoState } from '../../core/demo/demo-state';
import { liveResource } from '../../core/demo/live-resource';
import { BrandMark } from '../../shared/ui/brand-mark';
import { Icon, IconName } from '../../shared/ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly navigate = output<void>();

  private readonly demo = inject(DemoState);
  protected readonly property = computed(() => this.demo.info()?.property);
  protected readonly propertyMenu = signal(false);

  private readonly overview = liveResource<{ metrics: { needsAttention: number } }>(() => api('overview'));
  protected readonly attention = computed(() => this.overview.value()?.metrics.needsAttention ?? 0);

  protected readonly demoNote = environment.api === 'browser'
    ? 'Demo environment. All data is simulated in your browser and resets when you reload or reset the demo.'
    : 'Demo environment. All data is simulated and resets when the API restarts or you reset the demo.';

  protected readonly items: NavItem[] = [
    { path: '/overview', label: 'Overview', icon: 'dashboard' },
    { path: '/people', label: 'Guests & residents', icon: 'users' },
    { path: '/sync', label: 'Sync center', icon: 'refresh' },
    { path: '/access-points', label: 'Access points', icon: 'door' },
    { path: '/activity', label: 'Activity', icon: 'activity' },
  ];
}
