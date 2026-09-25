import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { DemoState } from '../../core/demo/demo-state';
import { PropertyTimePipe } from '../../core/time/time.pipes';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/ui/icon';
import { errorMessage } from '../../core/api/api-errors';

/** Compact demo clock + story controls. Disabled options explain why. */
@Component({
  selector: 'app-demo-controls',
  imports: [Icon, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:mousedown)': 'onOutside($event)', '(keydown.escape)': 'close(true)' },
  template: `
    <button #trigger type="button" class="clock" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu"
      [attr.aria-label]="'Demo clock ' + (now() | ptime: 'weekdayDate') + ' ' + (now() | ptime: 'time') + '. Open demo controls'">
      <app-icon name="clock" [size]="15" />
      <span class="when num"><span class="day">{{ now() | ptime: 'weekdayDate' }} · </span>{{ now() | ptime: 'time' }}</span>
      <span class="zone">{{ demo.info()?.zoneAbbreviation ?? 'CDT' }}</span>
      <app-icon name="chevron-down" [size]="14" />
    </button>
    @if (open()) {
      <div class="menu" role="menu" aria-label="Demo controls">
        <div class="menu-head">
          <strong>Demo clock</strong>
          <span>Property time · America/Chicago</span>
        </div>
        <button type="button" role="menuitem" class="item" [disabled]="!checkIn()?.available || demo.busy()" (click)="advance('checkIn')">
          <app-icon name="fast-forward" [size]="16" />
          <span class="text">
            <strong>Advance to check-in</strong>
            <span>{{ checkIn()?.available ? (checkIn()?.at | ptime: 'weekdayDate') + ' · ' + (checkIn()?.at | ptime: 'time') : checkIn()?.unavailableReason }}</span>
          </span>
        </button>
        <button type="button" role="menuitem" class="item" [disabled]="!checkout()?.available || demo.busy()" (click)="advance('checkout')">
          <app-icon name="log-out" [size]="16" />
          <span class="text">
            <strong>Advance to checkout</strong>
            <span>{{ checkout()?.available ? (checkout()?.at | ptime: 'weekdayDate') + ' · ' + (checkout()?.at | ptime: 'time') : checkout()?.unavailableReason }}</span>
          </span>
        </button>
        <hr class="divider" />
        <button type="button" role="menuitem" class="item" [disabled]="demo.busy()" (click)="reset()">
          <app-icon name="reset" [size]="16" />
          <span class="text">
            <strong>Reset demo</strong>
            <span>Restore the original clock, records and scenario</span>
          </span>
        </button>
      </div>
    }
  `,
  styleUrl: './demo-controls.scss',
})
export class DemoControls {
  protected readonly demo = inject(DemoState);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly now = this.demo.now;
  protected readonly checkIn = computed(() => this.demo.info()?.checkIn);
  protected readonly checkout = computed(() => this.demo.info()?.checkout);

  protected async advance(target: 'checkIn' | 'checkout') {
    this.close(true);
    try {
      await this.demo.advance(target);
      this.toast.info(
        target === 'checkIn' ? 'Clock advanced to 4:00 PM check-in' : 'Clock advanced to Saturday 10:00 AM checkout',
        'Statuses were recalculated and transitions recorded in Activity.',
      );
    } catch (error) {
      this.toast.error('Could not move the clock', errorMessage(error));
    }
  }

  protected async reset() {
    this.close(true);
    try {
      await this.demo.reset();
      this.toast.success('Demo reset', 'Clock, records and scenario restored to Saturday 3:45 PM.');
    } catch (error) {
      this.toast.error('Could not reset the demo', errorMessage(error));
    }
  }

  protected close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.clock')?.focus();
  }

  protected onOutside(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
