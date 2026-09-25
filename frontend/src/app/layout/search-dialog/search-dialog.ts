import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { api, queryParams } from '../../core/api/api-url';
import { PersonSummary, personTypeLabels } from '../../core/api/models';
import { liveResource } from '../../core/demo/live-resource';
import { Panels } from '../../core/ui/panels';
import { Avatar } from '../../shared/ui/avatar';
import { DialogSurface } from '../../shared/ui/dialog-surface';
import { Icon, IconName } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';

interface SearchResponse {
  query: string;
  people: PersonSummary[];
  units: { unit: string; floor: number; occupants: { personId: string; name: string }[] }[];
  accessPoints: { id: string; name: string; location: string; online: boolean }[];
}

interface Hit {
  key: string;
  group: 'People' | 'Units' | 'Access points';
  label: string;
  sub: string;
  icon?: IconName;
  person?: PersonSummary;
  run: () => void;
}

@Component({
  selector: 'app-search-dialog',
  imports: [DialogSurface, Icon, Avatar, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-dialog.html',
  styleUrl: './search-dialog.scss',
})
export class SearchDialog {
  protected readonly panels = inject(Panels);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  private readonly debounced = toSignal(toObservable(this.query).pipe(debounceTime(120)), { initialValue: '' });
  protected readonly active = signal(0);

  private readonly results = liveResource<SearchResponse>(() =>
    this.panels.search() ? { url: api('search'), params: queryParams({ q: this.debounced() }) } : undefined,
  );
  protected readonly loading = this.results.loading;

  protected readonly hits = computed<Hit[]>(() => {
    const r = this.results.value();
    if (!r) return [];
    const hits: Hit[] = [];
    for (const p of r.people) {
      hits.push({
        key: `p-${p.id}`, group: 'People', label: p.name, person: p,
        sub: [personTypeLabels[p.type], p.unit ? `Unit ${p.unit}` : p.role].filter(Boolean).join(' · '),
        run: () => this.panels.openPerson(p.id),
      });
    }
    for (const u of r.units) {
      hits.push({
        key: `u-${u.unit}`, group: 'Units', label: `Unit ${u.unit}`, icon: 'house',
        sub: `Floor ${u.floor} · ${u.occupants.map((o) => o.name).join(', ')}`,
        run: () => this.go(['/people'], { q: u.unit }),
      });
    }
    for (const a of r.accessPoints) {
      hits.push({
        key: `a-${a.id}`, group: 'Access points', label: a.name, icon: a.online ? 'door' : 'wifi-off',
        sub: `${a.location}${a.online ? '' : ' · Offline'}`,
        run: () => this.panels.openAccessPoint(a.id),
      });
    }
    return hits;
  });

  protected readonly groups = computed(() => {
    const order: Hit['group'][] = ['People', 'Units', 'Access points'];
    return order
      .map((name) => ({ name, hits: this.hits().filter((h) => h.group === name) }))
      .filter((g) => g.hits.length > 0);
  });

  constructor() {
    effect(() => {
      this.hits();
      this.active.set(0);
    });
    effect(() => {
      if (!this.panels.search()) this.query.set('');
    });
  }

  protected indexOf(hit: Hit) {
    return this.hits().indexOf(hit);
  }

  protected onKey(event: KeyboardEvent) {
    const count = this.hits().length;
    if (!count) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.set((this.active() + 1) % count);
      this.scrollActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set((this.active() - 1 + count) % count);
      this.scrollActive();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.choose(this.hits()[this.active()]);
    }
  }

  protected choose(hit: Hit | undefined) {
    if (!hit) return;
    this.panels.search.set(false);
    hit.run();
  }

  private go(commands: string[], queryParams: Record<string, string>) {
    void this.router.navigate(commands, { queryParams });
  }

  private scrollActive() {
    queueMicrotask(() => document.querySelector('.search-hit.active')?.scrollIntoView({ block: 'nearest' }));
  }
}
