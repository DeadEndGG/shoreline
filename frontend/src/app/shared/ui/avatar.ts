import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const palettes = [
  ['#e8f0fe', '#1d4ed8'], ['#e7f6ef', '#15703d'], ['#fdf1e3', '#a2510b'], ['#f1ecfd', '#5b3bb5'],
  ['#e6f5f8', '#0e6a7c'], ['#fbe9ef', '#a3264f'], ['#eef1f5', '#3f4d63'],
];

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ initials() }}`,
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
    '[style.background]': 'colors()[0]',
    '[style.color]': 'colors()[1]',
  },
  styles: `:host { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%;
    font-weight: 600; letter-spacing: 0.01em; box-shadow: inset 0 0 0 1px rgb(23 36 59 / 6%); }`,
})
export class Avatar {
  readonly initials = input.required<string>();
  readonly seed = input<string>('');
  readonly size = input(32);

  protected readonly colors = computed(() => {
    const key = this.seed() || this.initials();
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return palettes[hash % palettes.length];
  });
}
