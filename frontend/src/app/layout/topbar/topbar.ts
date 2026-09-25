import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { DemoSession } from '../../core/auth/demo-session';
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
    <div class="me">
      <button type="button" class="avatar-button" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-haspopup="menu" aria-label="Account menu">
        <app-avatar [initials]="demo.info()?.manager?.initials ?? 'MH'" seed="manager" [size]="32" />
      </button>
      @if (menuOpen()) {
        <div class="account-menu" role="menu">
          <div class="account">
            <strong>{{ demo.info()?.manager?.name ?? 'Morgan Hale' }}</strong>
            <span>{{ demo.info()?.manager?.role ?? 'Property manager' }}</span>
            <span class="email">{{ session.userEmail() }}</span>
          </div>
          <button type="button" role="menuitem" class="menu-item" (click)="signOut()"><app-icon name="log-out" [size]="15" />Sign out</button>
        </div>
      }
    </div>
  `,
  styleUrl: './topbar.scss',
  host: { '(document:mousedown)': 'onOutside($event)', '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class Topbar {
  readonly menu = output<void>();
  protected readonly panels = inject(Panels);
  protected readonly demo = inject(DemoState);
  protected readonly session = inject(DemoSession);
  protected readonly menuOpen = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  protected signOut() {
    this.menuOpen.set(false);
    this.session.signOut();
    void this.router.navigate(['/sign-in']);
  }

  protected onOutside(event: MouseEvent) {
    const me = this.host.nativeElement.querySelector('.me');
    if (this.menuOpen() && me && !me.contains(event.target as Node)) this.menuOpen.set(false);
  }

  protected readonly crumb = computed(() => {
    this.url();
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    return (route.data['breadcrumb'] as string | undefined) ?? 'Overview';
  });
}
