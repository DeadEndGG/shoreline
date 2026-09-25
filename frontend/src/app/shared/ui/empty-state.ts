import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from './icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glyph"><app-icon [name]="icon()" [size]="20" /></div>
    <h3>{{ title() }}</h3>
    @if (message()) { <p>{{ message() }}</p> }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 48px 24px; }
    .glyph { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 6px; border-radius: 12px;
      background: var(--surface-muted); border: 1px solid var(--border); color: var(--text-muted); }
    p { max-width: 360px; color: var(--text-muted); font-size: 13px; }
    .actions { margin-top: 10px; display: flex; gap: 8px; }
    .actions:empty { display: none; }
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('search');
  readonly title = input.required<string>();
  readonly message = input<string>('');
}
