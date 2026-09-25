import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { DemoState } from '../../core/demo/demo-state';
import { Panels } from '../../core/ui/panels';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { DemoControls } from '../demo-controls/demo-controls';

@Component({
  selector: 'app-topbar',
  imports: [Icon, Avatar, DemoControls, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn ghost icon-only menu" (click)="menu.emit()" aria-label="Open navigation">
      <app-icon name="menu" [size]="20" />
    </button>
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><a routerLink="/overview">Shoreline Residences</a></li>
        <li aria-current="page"><app-icon name="chevron-right" [size]="14" /><span>{{ crumb() }}</span></li>
      </ol>
    </nav>
    <div class="spacer"></div>
    <button type="button" class="search" (click)="panels.search.set(true)" aria-keyshortcuts="Control+K Meta+K">
      <app-icon name="search" [size]="15" />
      <span class="placeholder">Search guests, units, doors…</span>
      <span class="kbd">⌘K</span>
    </button>
    <span class="demo-chip" title="All data and actions are simulated"><app-icon name="circle-dot" [size]="12" />Demo</span>
    <app-demo-controls />
    <div class="me" [title]="(demo.info()?.manager?.name ?? '') + ' · ' + (demo.info()?.manager?.role ?? '')">
      <app-avatar [initials]="demo.info()?.manager?.initials ?? 'MH'" seed="manager" [size]="32" />
    </div>
  `,
  styleUrl: './topbar.scss',
})
export class Topbar {
  readonly menu = output<void>();
  protected readonly panels = inject(Panels);
  protected readonly demo = inject(DemoState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  protected readonly crumb = computed(() => {
    this.url();
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    return (route.data['breadcrumb'] as string | undefined) ?? 'Overview';
  });
}
