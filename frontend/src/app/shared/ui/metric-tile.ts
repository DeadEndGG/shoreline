import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconName } from './icon';

/** Compact clickable metric that navigates to the records it counts. */
@Component({
  selector: 'app-metric-tile',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="tile" [class.attention]="tone() === 'warning' && value() > 0" [routerLink]="link()" [queryParams]="query()">
      <span class="label"><app-icon [name]="icon()" [size]="15" />{{ label() }}</span>
      <span class="value num">{{ value() }}</span>
      <span class="caption">{{ caption() }}<app-icon class="go" name="arrow-right" [size]="14" /></span>
    </a>
  `,
  styles: `
    .tile { display: flex; flex-direction: column; gap: 6px; padding: 18px 20px; height: 100%;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);
      box-shadow: var(--shadow-card); color: var(--text); text-decoration: none;
      transition: border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease, transform var(--dur-fast) ease; }
    .tile:hover { border-color: #cbd6e6; box-shadow: var(--shadow-raised); text-decoration: none; color: var(--text); }
    .tile:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--text-secondary); }
    .label app-icon { color: var(--text-muted); }
    .value { font-size: 32px; line-height: 38px; font-weight: 600; letter-spacing: -0.025em; }
    .caption { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); }
    .go { opacity: 0; transform: translateX(-4px); transition: all var(--dur-fast) ease; color: var(--primary); }
    .tile:hover .go, .tile:focus-visible .go { opacity: 1; transform: none; }
    .attention .value { color: var(--warning); }
    .attention .label app-icon { color: var(--warning); }
  `,
})
export class MetricTile {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly caption = input('');
  readonly icon = input<IconName>('users');
  readonly link = input.required<string>();
  readonly query = input<Record<string, string>>({});
  readonly tone = input<'default' | 'warning'>('default');
}
