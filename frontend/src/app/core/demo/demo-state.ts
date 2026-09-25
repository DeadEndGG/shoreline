import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { api } from '../api/api-url';
import { ActionResult, DemoScenario } from '../api/models';

export interface DemoInfo {
  now: string;
  timeZone: string;
  zoneAbbreviation: string;
  scenario: DemoScenario;
  checkIn: ClockStep;
  checkout: ClockStep;
  manager: { name: string; role: string; initials: string };
  property: { name: string; city: string; units: number; floors: number; accessPoints: number };
}

export interface ClockStep {
  at: string;
  available: boolean;
  unavailableReason: string | null;
}

/**
 * Single client-side owner of "the demo changed". Every read resource depends on
 * {@link revision}; any mutation bumps it so every visible surface refetches from the
 * one server-side state and stays in agreement.
 */
@Injectable({ providedIn: 'root' })
export class DemoState {
  private readonly http = inject(HttpClient);

  readonly revision = signal(0);
  readonly busy = signal(false);

  private readonly resource = httpResource<DemoInfo>(() => {
    this.revision();
    return api('demo');
  });

  readonly info = computed(() => (this.resource.hasValue() ? this.resource.value() : undefined));
  readonly now = computed(() => this.info()?.now ?? null);
  readonly scenario = computed<DemoScenario>(() => this.info()?.scenario ?? 'normal');
  readonly unreachable = computed(() => this.resource.status() === 'error' && !this.info());

  refresh() {
    this.revision.update((v) => v + 1);
  }

  /** Runs a mutation, then refreshes every dependent view. */
  async mutate<T>(request: () => Promise<T>): Promise<T> {
    this.busy.set(true);
    try {
      return await request();
    } finally {
      this.busy.set(false);
      this.refresh();
    }
  }

  advance(target: 'checkIn' | 'checkout') {
    return this.mutate(() => firstValueFrom(this.http.post<DemoInfo>(api('demo/clock/advance'), { target })));
  }

  reset() {
    return this.mutate(() => firstValueFrom(this.http.post<DemoInfo>(api('demo/reset'), {})));
  }

  setScenario(scenario: DemoScenario) {
    return this.mutate(() => firstValueFrom(this.http.put<ActionResult>(api('sync/scenario'), { scenario })));
  }
}
