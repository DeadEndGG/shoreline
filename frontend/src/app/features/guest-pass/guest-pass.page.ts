import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { api } from '../../core/api/api-url';
import { liveResource } from '../../core/demo/live-resource';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { GuestPass } from './guest-pass.models';
import { PassView } from './pass-view';

/** Standalone, mobile-first guest page at #/guest/:id — no admin chrome. */
@Component({
  selector: 'app-guest-pass-page',
  imports: [PassView, RouterLink, Icon, EmptyState, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (from() === 'admin') {
      <a class="back" routerLink="/overview"><app-icon name="chevron-left" [size]="16" />Back to Shoreline Access</a>
    }
    <div class="frame">
      @if (current(); as p) {
        <app-pass-view [pass]="p" />
      } @else if (pass.failed()) {
        <app-empty-state icon="circle-alert" title="We couldn’t find this pass" message="Check the link from your confirmation email, or contact the front desk at (850) 555-0140." />
      } @else {
        <div class="loading"><app-skeleton [rows]="8" /></div>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: #eef3fa; padding: 0 0 24px; }
    .frame { max-width: 440px; margin: 0 auto; background: #fbfcfe; min-height: 100dvh; box-shadow: 0 0 0 1px var(--border); }
    .loading { padding: 32px 20px; }
    .back { position: fixed; top: 12px; left: 12px; z-index: 5; display: inline-flex; align-items: center; gap: 4px; height: 32px;
      padding: 0 12px 0 8px; border-radius: 999px; background: rgb(255 255 255 / 92%); border: 1px solid var(--border);
      box-shadow: var(--shadow-card); font-size: 13px; font-weight: 500; color: var(--text-secondary); }
    .back:hover { text-decoration: none; color: var(--text); }
    @media (min-width: 480px) { :host { padding: 32px 0; } .frame { min-height: auto; border-radius: 28px; overflow: hidden; box-shadow: var(--shadow-overlay); } }
    @media (max-width: 1100px) { .back { position: static; margin: 12px; } }
  `,
})
export class GuestPassPage {
  readonly id = input.required<string>();
  readonly from = input<string | undefined>(undefined);

  protected readonly pass = liveResource<GuestPass>(() => api(`guest-pass/${encodeURIComponent(this.id())}`));
  protected readonly current = computed(() => {
    const p = this.pass.value();
    return p && p.personId === this.id() ? p : undefined;
  });
}
