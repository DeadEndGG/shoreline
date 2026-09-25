import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shoreline Access mark: an open doorway with waves rolling in at its threshold. */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 32 32" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <path d="M10.2 17.2V3.6l13.4 4.6v19.6" fill="none" [attr.stroke]="inverse() ? '#ffffff' : '#10203D'"
        stroke-width="2.6" stroke-linejoin="miter" stroke-miterlimit="8" />
      <path d="M1.5 27.4c4.6-.7 7.4-5.6 12.3-6.3 3-.4 5.1.7 6.3 2.3-1.6-.8-3.6-.6-5.1.6-2.9 2.3-7.4 3.9-13.5 3.4z" fill="#1D63ED" />
      <path d="M15.4 21.9c1.5-.6 3.2-.3 4.1.8-1.4-.3-2.7-.3-4.1-.8z" fill="#8DBBF8" />
      <path d="M8.8 28.2c3.9-2.5 8.2-3 12.3-1.4 2 .8 3.5 1.6 5.2 1.3-2.9 1.9-6.5 1.8-9.6.8-2.6-.8-5.3-1.2-7.9-.7z" fill="#1D63ED" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class BrandMark {
  readonly size = input(28);
  readonly inverse = input(false);
}
