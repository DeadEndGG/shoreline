import { HttpResourceRequest, httpResource } from '@angular/common/http';
import { Signal, computed, inject, linkedSignal } from '@angular/core';
import { DemoState } from './demo-state';

export interface LiveResource<T> {
  /** Latest successful value; kept while a refresh is in flight to avoid flicker. */
  readonly value: Signal<T | undefined>;
  /** True only for the very first load (no value yet). */
  readonly initialLoading: Signal<boolean>;
  readonly loading: Signal<boolean>;
  readonly failed: Signal<boolean>;
  reload(): void;
}

/**
 * httpResource that re-runs whenever the shared demo state changes.
 * Must be called in an injection context (component field initialisers).
 */
export function liveResource<T>(request: () => string | HttpResourceRequest | undefined): LiveResource<T> {
  const demo = inject(DemoState);
  const resource = httpResource<T>(() => {
    demo.revision();
    const r = request();
    return typeof r === 'string' ? { url: r } : r;
  });

  const value = linkedSignal<T | undefined, T | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (next, previous) => next ?? (resource.isLoading() ? previous?.value : undefined),
  });

  return {
    value,
    initialLoading: computed(() => resource.isLoading() && value() === undefined),
    loading: resource.isLoading,
    failed: computed(() => resource.status() === 'error'),
    reload: () => resource.reload(),
  };
}
