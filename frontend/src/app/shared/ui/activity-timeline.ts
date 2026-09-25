import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActivityItem, AuditCategory, AuditResult } from '../../core/api/models';
import { PropertyTimePipe, RelativeTimePipe } from '../../core/time/time.pipes';
import { Icon, IconName } from './icon';

export function activityIcon(item: Pick<ActivityItem, 'category' | 'result' | 'title'>): IconName {
  if (item.result === 'denied') return 'ban';
  if (item.result === 'warning') return 'warning';
  const byCategory: Record<AuditCategory, IconName> = {
    access: 'door', credential: 'key', sync: 'refresh', manual: 'user',
  };
  if (item.title.toLowerCase().includes('expired')) return 'circle-pause';
  if (item.title.toLowerCase().includes('activated')) return 'circle-check';
  return byCategory[item.category];
}

export function activityTone(result: AuditResult): string {
  return result;
}

/** Compact vertical timeline used on the overview and in drawers. */
@Component({
  selector: 'app-activity-timeline',
  imports: [Icon, RelativeTimePipe, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol>
      @for (item of items(); track item.id) {
        <li [class]="item.result">
          <span class="dot"><app-icon [name]="icon(item)" [size]="13" [stroke]="2" /></span>
          <button type="button" class="row" (click)="select.emit(item)" [disabled]="!item.personId && !item.accessPointId">
            <span class="line">
              <strong>{{ item.title }}</strong>
              <time class="num" [attr.datetime]="item.at" [title]="item.at | ptime: 'dateTime'">{{ absolute() ? (item.at | ptime: 'dateTime') : (item.at | relative: now()) }}</time>
            </span>
            <span class="who">
              @if (item.personName) { {{ item.personName }}@if (item.unit) { · Unit {{ item.unit }} } }
              @if (item.personName && item.accessPointName) { · }
              @if (item.accessPointName) { {{ item.accessPointName }} }
              @if (!item.personName && !item.accessPointName && item.detail) { {{ item.detail }} }
            </span>
            @if (showDetail() && item.detail && (item.personName || item.accessPointName)) {
              <span class="detail">{{ item.detail }}</span>
            }
          </button>
        </li>
      }
    </ol>
  `,
  styles: `
    ol { list-style: none; margin: 0; padding: 0; position: relative; }
    li { position: relative; display: flex; gap: 12px; padding-bottom: 4px; }
    li:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 28px; bottom: -2px; width: 1px; background: var(--border); }
    .dot { flex: none; display: grid; place-items: center; width: 23px; height: 23px; margin-top: 7px; border-radius: 50%;
      background: var(--surface); border: 1px solid var(--border); color: var(--text-secondary); }
    .success .dot { color: var(--success); border-color: #cdebd6; background: var(--success-soft); }
    .warning .dot { color: var(--warning); border-color: #f6dfa4; background: var(--warning-soft); }
    .denied .dot { color: var(--danger); border-color: #f7cccc; background: var(--danger-soft); }
    .info .dot { color: var(--primary); border-color: #d6e4fd; background: var(--surface-blue); }
    .row { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; margin: 0 -8px 0 0;
      border: 0; border-radius: 8px; background: none; text-align: left; cursor: pointer; }
    .row:hover:not(:disabled) { background: var(--surface-muted); }
    .row:disabled { cursor: default; }
    .line { display: flex; justify-content: space-between; gap: 12px; }
    .line strong { font-weight: 500; font-size: 13px; }
    time { flex: none; font-size: 12px; color: var(--text-muted); }
    .who { font-size: 12.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .detail { font-size: 12px; color: var(--text-muted); }
  `,
})
export class ActivityTimeline {
  readonly items = input.required<ActivityItem[]>();
  readonly now = input<string | null>(null);
  readonly absolute = input(false);
  readonly showDetail = input(false);
  readonly select = output<ActivityItem>();

  protected icon = activityIcon;
}
