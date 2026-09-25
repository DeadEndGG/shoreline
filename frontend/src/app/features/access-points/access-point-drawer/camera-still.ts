import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccessPointKind } from '../../../core/api/models';

/** Tasteful static illustration standing in for a camera frame. Never a live feed; no timestamp. */
@Component({
  selector: 'app-camera-still',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure [class.offline]="offline()">
      <svg viewBox="0 0 480 270" role="img" [attr.aria-label]="'Illustrative still image of ' + name()">
        <defs>
          <linearGradient id="cam-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8f3" /><stop offset="1" stop-color="#eef2f6" /></linearGradient>
          <linearGradient id="cam-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd8e3" /><stop offset="1" stop-color="#b9c4d2" /></linearGradient>
        </defs>
        <rect width="480" height="270" fill="url(#cam-sky)" />
        @if (kind() === 'gate') {
          <path d="M0 190 C120 176 240 196 480 180 L480 270 L0 270 Z" fill="#efe6d6" />
          <path d="M0 170 C140 160 300 176 480 164" fill="none" stroke="#b7cbe4" stroke-width="2" />
          @for (x of posts; track x) { <rect [attr.x]="x" y="120" width="6" height="90" fill="#94a3b8" /> }
          <rect x="60" y="126" width="360" height="5" fill="#94a3b8" /><rect x="60" y="170" width="360" height="5" fill="#94a3b8" />
          <rect x="200" y="118" width="80" height="94" fill="none" stroke="#64748b" stroke-width="4" />
        } @else {
          <rect x="0" y="200" width="480" height="70" fill="url(#cam-floor)" />
          <path d="M0 200 L140 150 L340 150 L480 200" fill="none" stroke="#aab6c6" stroke-width="2" />
          <rect x="190" y="70" width="100" height="130" rx="3" fill="#c3cddb" stroke="#8e9bb0" stroke-width="3" />
          <rect x="198" y="80" width="84" height="112" fill="#dbe4ef" />
          <circle cx="272" cy="140" r="3.5" fill="#64748b" />
          <rect x="310" y="120" width="16" height="26" rx="3" fill="#475569" /><rect x="314" y="126" width="8" height="6" rx="1" fill="#93c5fd" />
        }
      </svg>
      <figcaption>
        <span class="rec">● Demo still</span>
        <span>{{ name() }}</span>
      </figcaption>
      @if (offline()) { <div class="veil">Reader offline</div> }
    </figure>
  `,
  styles: `
    figure { position: relative; margin: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); filter: saturate(0.7); }
    svg { display: block; width: 100%; height: auto; }
    figcaption { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; padding: 8px 12px;
      background: linear-gradient(0deg, rgb(15 23 42 / 55%), transparent); color: #fff; font-size: 11.5px; font-weight: 500; }
    .rec { opacity: 0.9; }
    .veil { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(15 23 42 / 35%); color: #fff; font-size: 13px; font-weight: 600; }
    .offline svg { filter: grayscale(1); }
  `,
})
export class CameraStill {
  readonly kind = input.required<AccessPointKind>();
  readonly offline = input(false);
  readonly name = input('');
  protected readonly posts = [60, 120, 180, 300, 360, 414];
}
