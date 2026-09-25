import {
  ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, output, viewChild,
} from '@angular/core';
import { Icon } from './icon';

/**
 * Accessible modal surface built on the native <dialog> element: the browser provides the
 * focus trap (inert background), Escape handling and top-layer stacking; we restore focus
 * to the invoking element on close.
 */
@Component({
  selector: 'app-dialog-surface',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [class]="variant()"
      [style.--dialog-width]="width()"
      [attr.aria-labelledby]="titleId"
      (cancel)="$event.preventDefault(); closed.emit()"
      (mousedown)="onBackdrop($event)"
    >
      @if (open()) {
        <div class="shell">
          <header class="head">
            <div class="titles">
              <h2 [id]="titleId">{{ heading() }}</h2>
              @if (subheading()) { <p class="sub">{{ subheading() }}</p> }
            </div>
            <ng-content select="[dialog-header-extra]" />
            <button type="button" class="btn ghost icon-only sm close" (click)="closed.emit()" aria-label="Close">
              <app-icon name="x" [size]="18" />
            </button>
          </header>
          <div class="body"><ng-content /></div>
          <ng-content select="[dialog-footer]" />
        </div>
      }
    </dialog>
  `,
  styleUrl: './dialog-surface.scss',
})
export class DialogSurface {
  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly subheading = input<string | null>(null);
  readonly variant = input<'drawer' | 'modal'>('modal');
  readonly width = input('480px');
  readonly closed = output<void>();

  private static nextId = 0;
  protected readonly titleId = `dialog-title-${DialogSurface.nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private returnFocus: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) {
        this.returnFocus = document.activeElement as HTMLElement | null;
        el.showModal();
        const preferred = el.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
        (preferred ?? el.querySelector<HTMLElement>('.body'))?.focus({ preventScroll: true });
      } else if (!this.open() && el.open) {
        el.close();
        if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
        this.returnFocus = null;
      }
    });
  }

  protected onBackdrop(event: MouseEvent) {
    // A press directly on the <dialog> element (not its content) is a backdrop click.
    if (event.target === this.dialog().nativeElement) {
      this.closed.emit();
    }
  }
}
