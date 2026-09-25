import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (row of rowsArray(); track $index) { <div class="bar" [style.width]="widths[$index % widths.length]"></div> }`,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
    .bar { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #eef2f7 0%, #f6f8fb 50%, #eef2f7 100%);
      background-size: 200% 100%; animation: shimmer 1.3s ease-in-out infinite; }
    @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  `,
})
export class Skeleton {
  readonly rows = input(3);
  protected readonly widths = ['92%', '76%', '84%', '64%', '88%'];
  protected rowsArray() {
    return Array.from({ length: this.rows() });
  }
}
