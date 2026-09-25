import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { OWNERSHIP } from '../../core/ownership';
import { PropertyTimePipe } from '../../core/time/time.pipes';
import { BrandMark } from '../../shared/ui/brand-mark';
import { CredentialCard } from '../../shared/ui/credential-card';
import { Icon, IconName } from '../../shared/ui/icon';
import { GuestPass } from './guest-pass.models';

const areaIcons: Record<string, IconName> = {
  'main-lobby': 'building', 'east-lobby': 'building', 'west-lobby': 'building', 'parking-entry': 'car',
  'beach-gate-east': 'umbrella', 'beach-gate-west': 'umbrella', 'pool-gate': 'waves', 'boardwalk-gate': 'fence',
  'fitness-center': 'dumbbell', 'owners-lounge': 'sofa', mailroom: 'mailbox', 'package-room': 'package',
  'service-entry': 'door', 'staff-entrance': 'door', 'maintenance-room': 'wrench',
};

/**
 * The guest-facing pass, shared by the standalone /guest/:id page and the
 * phone-sized preview inside the admin drawer.
 */
@Component({
  selector: 'app-pass-view',
  imports: [BrandMark, CredentialCard, Icon, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pass-view.html',
  styleUrl: './pass-view.scss',
  host: { '[class]': 'pass().state' },
})
export class PassView {
  readonly pass = input.required<GuestPass>();

  protected readonly ownership = OWNERSHIP;
  protected readonly openSection = signal<'arrival' | 'desk' | null>(null);
  protected readonly usable = computed(() => ['ready', 'active'].includes(this.pass().state));
  protected readonly statusIcon = computed<IconName>(() => {
    switch (this.pass().state) {
      case 'active': return 'circle-check';
      case 'ready': return 'clock';
      case 'ended': return 'circle-pause';
      case 'revoked': return 'ban';
      default: return 'loader';
    }
  });

  protected icon(id: string): IconName {
    return areaIcons[id] ?? 'door';
  }

  protected toggle(section: 'arrival' | 'desk') {
    this.openSection.set(this.openSection() === section ? null : section);
  }
}
