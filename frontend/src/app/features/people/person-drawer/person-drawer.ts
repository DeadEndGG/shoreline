import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { api } from '../../../core/api/api-url';
import { errorMessage, fieldErrors } from '../../../core/api/api-errors';
import { ActivityItem, categoryLabels, personTypeLabels } from '../../../core/api/models';
import { DemoState } from '../../../core/demo/demo-state';
import { liveResource } from '../../../core/demo/live-resource';
import { toPropertyInputValue } from '../../../core/time/property-time';
import { PropertyTimePipe, RelativeTimePipe } from '../../../core/time/time.pipes';
import { Panels } from '../../../core/ui/panels';
import { ToastService } from '../../../core/ui/toast.service';
import { ActivityTimeline } from '../../../shared/ui/activity-timeline';
import { Avatar } from '../../../shared/ui/avatar';
import { CredentialCard } from '../../../shared/ui/credential-card';
import { DialogSurface } from '../../../shared/ui/dialog-surface';
import { Icon, IconName } from '../../../shared/ui/icon';
import { Skeleton } from '../../../shared/ui/skeleton';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { GuestPass } from '../../guest-pass/guest-pass.models';
import { PassView } from '../../guest-pass/pass-view';
import { issueKindLabels } from '../../overview/overview.models';
import { PeopleApi } from '../people.api';
import { MessagePreview, PersonDetail } from '../people.models';

type SubDialog = 'pass' | 'message' | 'extend' | 'revoke' | null;

@Component({
  selector: 'app-person-drawer',
  imports: [
    DialogSurface, Avatar, StatusBadge, Icon, CredentialCard, ActivityTimeline, Skeleton, PassView,
    PropertyTimePipe, RelativeTimePipe, ReactiveFormsModule, RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-drawer.html',
  styleUrl: './person-drawer.scss',
})
export class PersonDrawer {
  protected readonly panels = inject(Panels);
  protected readonly demo = inject(DemoState);
  private readonly people = inject(PeopleApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly typeLabels = personTypeLabels;
  protected readonly categoryLabels = categoryLabels;
  protected readonly issueKindLabels = issueKindLabels;

  private readonly detail = liveResource<PersonDetail>(() => {
    const id = this.panels.personId();
    return id ? api(`people/${encodeURIComponent(id)}`) : undefined;
  });
  protected readonly person = computed(() => {
    const d = this.detail.value();
    return d && d.summary.id === this.panels.personId() ? d : undefined;
  });
  protected readonly failed = this.detail.failed;

  protected readonly sub = signal<SubDialog>(null);
  protected readonly saving = signal(false);

  private readonly pass = liveResource<GuestPass>(() =>
    this.sub() === 'pass' && this.panels.personId() ? api(`guest-pass/${this.panels.personId()}`) : undefined,
  );
  protected readonly passValue = computed(() => (this.pass.value()?.personId === this.panels.personId() ? this.pass.value() : undefined));

  private readonly message = liveResource<MessagePreview>(() =>
    this.sub() === 'message' && this.panels.personId() ? api(`people/${this.panels.personId()}/message`) : undefined,
  );
  protected readonly messageValue = this.message.value;
  protected readonly channel = signal<'email' | 'sms'>('email');

  protected readonly extendForm = new FormGroup({
    until: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true }),
  });
  protected readonly extendError = signal<string | null>(null);

  protected readonly revokeForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    confirm: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  protected readonly revokeError = signal<string | null>(null);
  protected readonly revokeReasons = ['Reservation cancelled', 'Guest checked out early', 'Lost or shared credential', 'Policy violation'];

  constructor() {
    // Closing the drawer (or switching person) closes any nested dialog.
    effect(() => {
      this.panels.personId();
      this.sub.set(null);
    });
  }

  protected close() {
    this.panels.personId.set(null);
  }

  protected openSub(dialog: SubDialog) {
    const p = this.person();
    if (dialog === 'extend' && p?.credential?.validUntil) {
      const current = new Date(p.credential.validUntil);
      const next = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      this.extendForm.reset({ until: toPropertyInputValue(next), note: '' });
      this.extendError.set(null);
    }
    if (dialog === 'revoke') {
      this.revokeForm.reset({ reason: '', confirm: false });
      this.revokeError.set(null);
    }
    if (dialog === 'message') this.channel.set('email');
    this.sub.set(dialog);
  }

  protected async submitExtend() {
    const p = this.person();
    if (!p || this.extendForm.invalid) {
      this.extendForm.markAllAsTouched();
      return;
    }
    const until = this.extendForm.controls.until.value;
    if (p.credential?.validUntil && until <= toPropertyInputValue(p.credential.validUntil)) {
      this.extendError.set('The new end must be later than the current end.');
      return;
    }
    this.saving.set(true);
    try {
      await this.people.extend(p.summary.id, until, this.extendForm.controls.note.value || undefined);
      this.toast.success('Access extended', `${p.summary.name}'s access and stay were updated everywhere.`);
      this.sub.set(null);
    } catch (error) {
      this.extendError.set(fieldErrors(error)['until'] ?? errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async submitRevoke() {
    const p = this.person();
    if (!p || this.revokeForm.invalid) {
      this.revokeForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.people.revoke(p.summary.id, this.revokeForm.controls.reason.value.trim());
      this.toast.warning('Access revoked', `${p.summary.name}'s credential stopped working immediately (simulated).`);
      this.sub.set(null);
    } catch (error) {
      this.revokeError.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async resend() {
    const p = this.person();
    if (!p) return;
    this.saving.set(true);
    try {
      await this.people.resend(p.summary.id, this.channel());
      this.toast.info('Resend simulated', 'Nothing was sent. An audit entry was recorded.');
    } catch (error) {
      this.toast.error('Could not simulate resend', errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected openFullPass() {
    const id = this.panels.personId();
    if (!id) return;
    this.close();
    void this.router.navigate(['/guest', id], { queryParams: { from: 'admin' } });
  }

  protected openActivity(item: ActivityItem) {
    if (item.accessPointId) this.panels.openAccessPoint(item.accessPointId);
  }

  protected stepIcon(state: string): IconName {
    return ({ done: 'check', current: 'circle-dot', failed: 'x', upcoming: 'clock' } as Record<string, IconName>)[state] ?? 'clock';
  }

  protected unusableIcon(status: string): IconName {
    return status === 'revoked' ? 'ban' : status === 'expired' ? 'circle-pause' : 'warning';
  }
}
