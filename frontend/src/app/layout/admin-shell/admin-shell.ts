import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DemoState } from '../../core/demo/demo-state';
import { Panels } from '../../core/ui/panels';
import { AccessPointDrawer } from '../../features/access-points/access-point-drawer/access-point-drawer';
import { PersonDrawer } from '../../features/people/person-drawer/person-drawer';
import { TemporaryAccessDialog } from '../../features/people/temporary-access/temporary-access-dialog';
import { Icon } from '../../shared/ui/icon';
import { SearchDialog } from '../search-dialog/search-dialog';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, Sidebar, Topbar, SearchDialog, PersonDrawer, AccessPointDrawer, TemporaryAccessDialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a class="skip" href="#main" (click)="$event.preventDefault(); focusMain()">Skip to content</a>
    <aside class="sidebar" [class.open]="navOpen()">
      <app-sidebar (navigate)="navOpen.set(false)" />
    </aside>
    @if (navOpen()) {
      <div class="scrim" (click)="navOpen.set(false)" aria-hidden="true"></div>
    }
    <div class="main-col">
      <app-topbar class="topbar" (menu)="navOpen.set(true)" />
      @if (demo.unreachable()) {
        <div class="offline" role="alert">
          <app-icon name="wifi-off" [size]="16" />
          <span><strong>Demo API not reachable.</strong> Start the backend (<code>dotnet run</code> in <code>backend/src/Shoreline.Api</code>) or build without the <code>server</code> configuration.</span>
          <button type="button" class="btn sm" (click)="demo.refresh()">Retry</button>
        </div>
      }
      <main id="main" tabindex="-1">
        <router-outlet />
      </main>
    </div>

    <app-search-dialog />
    <app-person-drawer />
    <app-access-point-drawer />
    <app-temporary-access-dialog />
  `,
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  protected readonly demo = inject(DemoState);
  private readonly panels = inject(Panels);
  protected readonly navOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.navOpen.set(false));
  }

  protected onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.panels.search.set(true);
    } else if (event.key === '/' && !typing && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      this.panels.search.set(true);
    } else if (event.key === 'Escape' && this.navOpen()) {
      this.navOpen.set(false);
    }
  }

  protected focusMain() {
    document.getElementById('main')?.focus();
  }
}
