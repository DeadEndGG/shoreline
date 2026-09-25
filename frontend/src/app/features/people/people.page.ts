import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { api, queryParams } from '../../core/api/api-url';
import { CredentialStatus, PersonType, methodLabels, personTypeLabels } from '../../core/api/models';
import { liveResource } from '../../core/demo/live-resource';
import { PropertyTimePipe } from '../../core/time/time.pipes';
import { Panels } from '../../core/ui/panels';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { Icon, IconName } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusBadge } from '../../shared/ui/status-badge';
import { PeopleResponse, Segment } from './people.models';

const PAGE_SIZE = 25;

const segmentLabels: Record<Segment, string> = {
  activeStays: 'Active guest stays',
  arrivalsToday: 'Arriving today',
  departuresToday: 'Departing today',
};

/** Directory of sample occupants. Filters live in the URL so metric tiles can deep-link. */
@Component({
  selector: 'app-people-page',
  imports: [Avatar, StatusBadge, Icon, EmptyState, Skeleton, PropertyTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people.page.html',
  styleUrl: './people.page.scss',
})
export class PeoplePage {
  readonly type = input<PersonType | undefined>(undefined);
  readonly segment = input<Segment | undefined>(undefined);
  readonly q = input<string | undefined>(undefined);
  readonly status = input<CredentialStatus | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);

  protected readonly panels = inject(Panels);
  private readonly router = inject(Router);

  protected readonly typeLabels = personTypeLabels;
  protected readonly methodLabels = methodLabels;
  protected readonly segmentLabels = segmentLabels;
  protected readonly pluralLabels: Record<PersonType, string> = {
    owner: 'Owners', strGuest: 'STR guests', midtermRenter: 'Mid-term renters', staff: 'Staff', vendor: 'Vendors', visitor: 'Visitors',
  };
  protected readonly types: PersonType[] = ['owner', 'strGuest', 'midtermRenter', 'staff', 'vendor', 'visitor'];

  /** Jon's access rules per user type, shown read-only; rules live on each person's credential. */
  protected readonly rules: { type: PersonType; icon: IconName; window: string; where: string }[] = [
    { type: 'owner', icon: 'house', window: 'Permanent access', where: 'All amenities · NFC fob or PIN' },
    { type: 'strGuest', icon: 'calendar', window: 'Reservation dates', where: '4 PM check-in → 10 AM checkout · PIN + QR' },
    { type: 'midtermRenter', icon: 'key', window: 'Lease dates', where: 'Guest amenities + mailroom' },
    { type: 'staff', icon: 'shield', window: 'Role & shift schedule', where: 'Back of house during shifts' },
    { type: 'vendor', icon: 'wrench', window: 'Limited locations & hours', where: 'Service entry · approved window' },
    { type: 'visitor', icon: 'user', window: 'Temporary, host approved', where: 'Lobby & pool · single visit' },
  ];

  protected readonly searchText = linkedSignal(() => this.q() ?? '');
  private readonly debounced = toSignal(toObservable(this.searchText).pipe(debounceTime(200)), { initialValue: this.q() ?? '' });
  protected readonly pageIndex = computed(() => Math.max(0, Number(this.page() ?? 0) || 0));

  protected readonly people = liveResource<PeopleResponse>(() => ({
    url: api('people'),
    params: queryParams({
      type: this.type(),
      segment: this.segment(),
      status: this.status(),
      q: this.q(),
      skip: this.pageIndex() * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  }));

  protected readonly totalForPopulation = computed(() => {
    const counts = this.people.value()?.typeCounts;
    return counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  });
  protected readonly hasFilters = computed(() => !!(this.type() || this.segment() || this.q() || this.status()));
  protected readonly rangeLabel = computed(() => {
    const r = this.people.value();
    if (!r || !r.matching) return '';
    const from = this.pageIndex() * PAGE_SIZE + 1;
    const to = Math.min(r.matching, from + r.items.length - 1);
    return `${from}–${to} of ${r.matching}`;
  });
  protected readonly canPrev = computed(() => this.pageIndex() > 0);
  protected readonly canNext = computed(() => (this.pageIndex() + 1) * PAGE_SIZE < (this.people.value()?.matching ?? 0));

  constructor() {
    toObservable(this.debounced).subscribe((q) => {
      if ((q ?? '') !== (this.q() ?? '')) this.update({ q: q || null, page: null });
    });
  }

  protected setType(type: PersonType | null) {
    this.update({ type, page: null });
  }

  protected setStatus(status: string) {
    this.update({ status: status || null, page: null });
  }

  protected clearSegment() {
    this.update({ segment: null, page: null });
  }

  protected clearAll() {
    this.searchText.set('');
    void this.router.navigate(['/people']);
  }

  protected goPage(delta: number) {
    const next = this.pageIndex() + delta;
    this.update({ page: next > 0 ? String(next) : null });
  }

  private update(params: Record<string, string | null>) {
    void this.router.navigate(['/people'], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
