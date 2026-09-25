import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { errorMessage } from '../../core/api/api-errors';
import { PropertyTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { ToastService } from '../../core/ui/toast.service';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { issueKindLabels } from '../overview/overview.models';
import { SyncApi } from './sync.api';
import { SyncCenter, SyncIssue } from './sync.models';

/**
 * One sync exception with the resolution that fits its cause: retry for transient
 * failures, a mapping selector for unmapped units, a reviewed choice for duplicates.
 */
@Component({
  selector: 'app-issue-card',
  imports: [Avatar, Icon, StatusBadge, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-card.html',
  styleUrl: './issue-card.scss',
  host: { '[class.resolved]': '!!issue().resolvedAt', '[class.highlight]': 'highlight()', '[attr.id]': '"issue-" + issue().id' },
})
export class IssueCard {
  readonly issue = input.required<SyncIssue>();
  readonly groups = input.required<SyncCenter['accessGroups']>();
  readonly highlight = input(false);

  protected readonly panels = inject(Panels);
  private readonly sync = inject(SyncApi);
  private readonly toast = inject(ToastService);

  protected readonly kindLabels = issueKindLabels;
  protected readonly working = signal(false);
  protected readonly showAttempts = signal(false);
  protected readonly groupId = signal<string | null>(null);
  protected readonly reservationId = signal<string | null>(null);
  protected readonly lastAttempt = computed(() => this.issue().attempts[0]);

  protected async act() {
    const issue = this.issue();
    this.working.set(true);
    try {
      const result =
        issue.action === 'map' ? await this.sync.mapUnit(issue.id, this.groupId()!)
        : issue.action === 'choose' ? await this.sync.chooseReservation(issue.id, this.reservationId()!)
        : await this.sync.retry(issue.id);
      if (result.outcome === 'succeeded') this.toast.success('Issue resolved', result.message);
      else if (result.outcome === 'alreadyResolved') this.toast.info('Already resolved', result.message);
      else this.toast.warning('Retry didn’t complete', result.message);
    } catch (error) {
      this.toast.error('Could not resolve', errorMessage(error));
    } finally {
      this.working.set(false);
    }
  }

  protected canAct() {
    const issue = this.issue();
    if (issue.action === 'map') return !!this.groupId();
    if (issue.action === 'choose') return !!this.reservationId();
    return true;
  }
}
