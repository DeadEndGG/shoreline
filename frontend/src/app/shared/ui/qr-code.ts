import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import qrcode from 'qrcode-generator';

/**
 * Renders an inert demo string as a QR code (SVG, generated locally).
 * The payload is never an access token.
 */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + matrix().size + ' ' + matrix().size" shape-rendering="crispEdges" role="img" [attr.aria-label]="label()">
      <path [attr.d]="matrix().path" fill="currentColor" />
    </svg>
  `,
  styles: `:host { display: block; color: var(--text); } svg { display: block; width: 100%; height: 100%; }`,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly label = input('Sample QR code (demo — not valid for entry)');

  protected readonly matrix = computed(() => {
    const qr = qrcode(0, 'M');
    qr.addData(this.value());
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 2;
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    return { size: count + quiet * 2, path };
  });
}
