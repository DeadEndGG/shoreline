import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { api } from '../../../core/api/api-url';
import { errorMessage, fieldErrors } from '../../../core/api/api-errors';
import { AccessPointCategory, categoryLabels } from '../../../core/api/models';
import { DemoState } from '../../../core/demo/demo-state';
import { liveResource } from '../../../core/demo/live-resource';
import { toPropertyInputValue } from '../../../core/time/property-time';
import { Panels } from '../../../core/ui/panels';
import { ToastService } from '../../../core/ui/toast.service';
import { DialogSurface } from '../../../shared/ui/dialog-surface';
import { Icon } from '../../../shared/ui/icon';
import { PeopleApi } from '../people.api';

interface PointOption { id: string; name: string; category: AccessPointCategory; online: boolean }

const endAfterStart: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('start')?.value as string;
  const end = group.get('end')?.value as string;
  return start && end && end <= start ? { endBeforeStart: true } : null;
};

/** Manual exception: visitor or vendor access with explicit locations and a bounded window. */
@Component({
  selector: 'app-temporary-access-dialog',
  imports: [DialogSurface, ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './temporary-access-dialog.html',
  styleUrl: './temporary-access-dialog.scss',
})
export class TemporaryAccessDialog {
  protected readonly panels = inject(Panels);
  private readonly demo = inject(DemoState);
  private readonly people = inject(PeopleApi);
  private readonly toast = inject(ToastService);

  private readonly points = liveResource<{ items: PointOption[] }>(() => (this.panels.temporaryAccess() ? api('access-points') : undefined));
  protected readonly groupedPoints = computed(() => {
    const items = this.points.value()?.items ?? [];
    return (['building', 'exterior', 'amenity', 'service'] as AccessPointCategory[]).map((c) => ({
      category: c, label: categoryLabels[c], items: items.filter((p) => p.category === c),
    }));
  });

  protected readonly form = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
      type: new FormControl<'visitor' | 'vendor'>('visitor', { nonNullable: true }),
      host: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      accessPointIds: new FormControl<string[]>([], { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
      start: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      end: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    },
    { validators: endAfterStart },
  );

  protected readonly saving = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});
  protected readonly submitted = signal(false);

  constructor() {
    effect(() => {
      if (this.panels.temporaryAccess()) {
        const now = this.demo.now() ?? new Date().toISOString();
        const start = new Date(Math.ceil(new Date(now).getTime() / (15 * 60000)) * 15 * 60000);
        const end = new Date(start.getTime() + 4 * 3600000);
        this.form.reset({
          name: '', type: 'visitor', host: '', accessPointIds: ['main-lobby'],
          start: toPropertyInputValue(start), end: toPropertyInputValue(end), reason: '',
        });
        this.serverErrors.set({});
        this.submitted.set(false);
      }
    });
  }

  protected isSelected(id: string) {
    return this.form.controls.accessPointIds.value.includes(id);
  }

  protected togglePoint(id: string) {
    const current = this.form.controls.accessPointIds.value;
    this.form.controls.accessPointIds.setValue(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    this.form.controls.accessPointIds.markAsTouched();
  }

  protected error(field: string): string | null {
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.get(field);
    const show = this.submitted() || control?.touched;
    if (field === 'end' && show && this.form.hasError('endBeforeStart')) return 'The end must be after the start.';
    if (!control || !show || control.valid) return null;
    return {
      name: 'Enter the visitor or company name.',
      host: 'Enter the host unit or responsible staff member.',
      accessPointIds: 'Choose at least one permitted location.',
      start: 'Choose a start time.',
      end: 'Choose an end time.',
      reason: 'Add a short reason for the audit log.',
    }[field] ?? null;
  }

  protected async submit() {
    this.submitted.set(true);
    this.serverErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const result = await this.people.createTemporaryAccess(this.form.getRawValue());
      this.panels.temporaryAccess.set(false);
      this.toast.success('Temporary access created', `${result.person.summary.name} can use the selected locations during the window.`);
      this.panels.openPerson(result.personId);
    } catch (error) {
      const fields = fieldErrors(error);
      this.serverErrors.set(fields);
      if (!Object.keys(fields).length) this.toast.error('Could not create access', errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
