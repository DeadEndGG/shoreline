import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '../../core/ui/toast.service';
import { Icon, IconName } from './icon';
import { QrCode } from './qr-code';

/**
 * Credential presentation reused by the person drawer and the guest pass.
 * Shows a masked sample PIN with reveal/copy, and an inert sample QR.
 */
@Component({
  selector: 'app-credential-card',
  imports: [Icon, QrCode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'variant()' },
  template: `
    <div class="qr" [class.muted]="!usable()">
      @if (usable() && qrPayload()) {
        <app-qr-code [value]="qrPayload()!" />
      } @else {
        <div class="qr-placeholder"><app-icon [name]="placeholderIcon()" [size]="22" /></div>
      }
    </div>
    <div class="details">
      <span class="label">{{ usable() ? 'Sample PIN' : 'PIN' }}</span>
      <div class="pin-row">
        <span class="pin num" [class.hidden]="!revealed() && masked()" [attr.aria-label]="revealed() || !masked() ? 'PIN ' + pin() : 'PIN hidden'">{{ display() }}</span>
        @if (usable()) {
          @if (masked()) {
            <button type="button" class="btn ghost icon-only sm" (click)="revealed.set(!revealed())" [attr.aria-label]="revealed() ? 'Hide PIN' : 'Reveal PIN'" [attr.aria-pressed]="revealed()">
              <app-icon [name]="revealed() ? 'eye-off' : 'eye'" [size]="16" />
            </button>
          }
          <button type="button" class="btn ghost icon-only sm" (click)="copy()" aria-label="Copy sample PIN">
            <app-icon [name]="copied() ? 'copy-check' : 'copy'" [size]="16" />
          </button>
        }
      </div>
      <span class="method">{{ method() }}</span>
      <ng-content />
      @if (demoLabel()) {
        <span class="demo-label"><app-icon name="info" [size]="12" />Demo pass — not valid for entry</span>
      }
    </div>
  `,
  styleUrl: './credential-card.scss',
})
export class CredentialCard {
  readonly pin = input<string | null>(null);
  readonly qrPayload = input<string | null>(null);
  readonly method = input('PIN + QR');
  readonly usable = input(true);
  readonly masked = input(true);
  readonly demoLabel = input(true);
  readonly unusableIcon = input<IconName>('lock');
  readonly variant = input<'compact' | 'pass'>('compact');
  readonly copiedPin = output<void>();

  private readonly toast = inject(ToastService);
  protected readonly revealed = signal(false);
  protected readonly copied = signal(false);

  protected readonly placeholderIcon = this.unusableIcon;
  protected readonly display = computed(() => {
    const pin = this.pin();
    if (!this.usable() || !pin) return '— — —  — — —';
    if (this.masked() && !this.revealed()) return '•••  •••';
    return `${pin.slice(0, 3)} ${pin.slice(3)}`;
  });

  protected async copy() {
    const pin = this.pin();
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
      this.toast.success('Sample PIN copied', 'Demo value only — not valid for entry.');
      this.copiedPin.emit();
    } catch {
      this.toast.warning('Copy unavailable', 'Your browser blocked clipboard access.');
    }
  }
}
