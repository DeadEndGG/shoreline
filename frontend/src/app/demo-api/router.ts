import { createDemoState } from './fixtures';
import { DemoState } from './state';

/** Owner of the in-browser demo state. Reset restores the deterministic fixtures. */
export class DemoStore {
  state: DemoState = createDemoState();

  reset() {
    this.state = createDemoState();
  }
}

export class NotFoundError extends Error {}

export class ValidationError extends Error {
  constructor(readonly errors: Record<string, string[]>) {
    super('One or more validation errors occurred.');
  }
}

/** Collects field errors the same way as the C# Validator; throws a 400 on `ensure()`. */
export class Validator {
  private readonly errors: Record<string, string[]> = {};

  require(condition: boolean, field: string, message: string): this {
    if (!condition) (this.errors[field] ??= []).push(message);
    return this;
  }

  get isValid() {
    return Object.keys(this.errors).length === 0;
  }

  ensure() {
    if (!this.isValid) throw new ValidationError(this.errors);
  }
}

export interface RequestContext {
  store: DemoStore;
  state: DemoState;
  params: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT';
  path: RegExp;
  /** Multiplier of the simulated controller/feed latency; omitted for plain reads. */
  latency?: number;
  status?: number;
  handle(ctx: RequestContext): unknown;
}

/** Case-insensitive enum query parameter, mirroring QueryEnum<T> in the API. Invalid values → 400. */
export function enumParam<T extends string>(query: URLSearchParams, name: string, values: readonly T[]): T | null {
  const raw = query.get(name);
  if (raw === null || raw === '') return null;
  const match = values.find((v) => v.toLowerCase() === raw.toLowerCase());
  if (!match) throw new ValidationError({ [name]: [`The value '${raw}' is not valid.`] });
  return match;
}

export function intParam(query: URLSearchParams, name: string, fallback: number): number {
  const raw = query.get(name);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
