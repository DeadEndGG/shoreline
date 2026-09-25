import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject } from '@angular/core';
import { ToastService } from '../../core/ui/toast.service';
import { Icon, IconName } from './icon';

const icons: Record<string, IconName> = { success: 'circle-check', info: 'info', warning: 'warning', error: 'circle-alert' };

/** Rendered as a manual popover so toasts stay above open dialogs (top layer). */
@Component({
  selector: 'app-toast-outlet',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { popover: 'manual', role: 'status', 'aria-live': 'polite' },
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [class]="toast.kind">
        <app-icon [name]="icons[toast.kind]" [size]="18" />
        <div class="text">
          <strong>{{ toast.title }}</strong>
          @if (toast.message) { <span>{{ toast.message }}</span> }
        </div>
        <button type="button" class="btn ghost icon-only sm" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss notification">
          <app-icon name="x" [size]="14" />
        </button>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; inset: auto 20px 20px auto; margin: 0; padding: 0; border: 0; background: transparent;
      overflow: visible; display: flex; flex-direction: column; gap: 8px; width: min(380px, calc(100vw - 32px)); }
    :host(:not(:popover-open)) { display: none; }
    .toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-overlay);
      animation: toast-in 200ms var(--ease-out); }
    .text { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 13px; padding-top: 1px; }
    .text span { color: var(--text-secondary); }
    .success app-icon:first-child { color: var(--success); }
    .info app-icon:first-child { color: var(--primary); }
    .warning app-icon:first-child { color: var(--warning); }
    .error app-icon:first-child { color: var(--danger); }
    button { margin: -4px -4px 0 0; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } }
    @media (max-width: 640px) { :host { inset: auto 16px 16px 16px; width: auto; } }
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = icons;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      const el = this.host.nativeElement;
      const hasToasts = this.toasts.toasts().length > 0;
      // Re-show so the popover moves to the top of the top layer, above any open dialog.
      if (el.matches(':popover-open')) el.hidePopover();
      if (hasToasts) el.showPopover();
    });
  }
}
