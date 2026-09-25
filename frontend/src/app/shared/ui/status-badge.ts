import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CredentialStatus } from '../../core/api/models';
import { Icon, IconName } from './icon';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const statusMap: Record<CredentialStatus, { label: string; tone: BadgeTone; icon: IconName }> = {
  scheduled: { label: 'Scheduled', tone: 'info', icon: 'clock' },
  active: { label: 'Active', tone: 'success', icon: 'circle-check' },
  needsAttention: { label: 'Needs attention', tone: 'warning', icon: 'warning' },
  expired: { label: 'Expired', tone: 'neutral', icon: 'circle-pause' },
  revoked: { label: 'Revoked', tone: 'danger', icon: 'ban' },
};

/** Status chip: tinted background + text + icon, so colour never carries meaning alone. */
@Component({
  selector: 'app-status-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-icon [name]="resolved().icon" [size]="13" [stroke]="2" /><span>{{ resolved().label }}</span>`,
  host: { '[class]': '"badge " + resolved().tone' },
  styles: `
    :host {
      display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px 0 7px;
      border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap;
      border: 1px solid transparent;
    }
    :host(.success) { background: var(--success-soft); color: var(--success); border-color: #d1f5dc; }
    :host(.warning) { background: var(--warning-soft); color: var(--warning); border-color: #fbe8b0; }
    :host(.danger) { background: var(--danger-soft); color: var(--danger); border-color: #fbd5d5; }
    :host(.info) { background: var(--surface-blue); color: var(--primary-hover); border-color: #d6e4fd; }
    :host(.neutral) { background: var(--neutral-soft); color: var(--text-secondary); border-color: var(--neutral-line); }
  `,
})
export class StatusBadge {
  readonly status = input<CredentialStatus | null>(null);
  readonly label = input<string | null>(null);
  readonly tone = input<BadgeTone>('neutral');
  readonly icon = input<IconName | null>(null);

  protected readonly resolved = computed(() => {
    const status = this.status();
    if (status) {
      const base = statusMap[status];
      return { ...base, label: this.label() ?? base.label };
    }
    return { label: this.label() ?? '', tone: this.tone(), icon: this.icon() ?? 'circle-dot' };
  });
}
