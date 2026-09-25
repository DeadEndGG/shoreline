import { accessPointRoutes } from './features/access-points';
import { activityRoutes } from './features/activity';
import { demoRoutes } from './features/demo';
import { guestPassRoutes } from './features/guest-pass';
import { overviewRoutes } from './features/overview';
import { peopleRoutes } from './features/people';
import { searchRoutes } from './features/search';
import { syncRoutes } from './features/sync';
import { DemoStore, NotFoundError, Route, ValidationError } from './router';

export interface ApiResult {
  status: number;
  body: unknown;
}

/**
 * The Shoreline demo API, running in the browser. Same routes, contracts and rules as the
 * ASP.NET Core API — organised as the same vertical slices — so the app needs no server.
 * State lives in memory: reloading the page restores the fixtures.
 */
export class DemoApi {
  readonly store = new DemoStore();

  private readonly routes: Route[] = [
    ...demoRoutes, ...overviewRoutes, ...peopleRoutes, ...syncRoutes,
    ...accessPointRoutes, ...activityRoutes, ...guestPassRoutes, ...searchRoutes,
  ];

  find(method: string, path: string): { route: Route; params: string[] } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.path.exec(path);
      if (match) return { route, params: match.slice(1).map(decodeURIComponent) };
    }
    return null;
  }

  /** Executes one request synchronously against the in-memory state. */
  execute(method: string, path: string, query: URLSearchParams, body: unknown): ApiResult {
    const found = this.find(method, path);
    if (!found) return { status: 404, body: { title: 'Not Found', status: 404 } };
    try {
      const result = found.route.handle({
        store: this.store,
        state: this.store.state,
        params: found.params,
        query,
        body: (body && typeof body === 'object' ? body : {}) as Record<string, unknown>,
      });
      // Serialise like a real API so callers never share references with the store.
      return { status: found.route.status ?? 200, body: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { status: 400, body: { title: 'One or more validation errors occurred.', status: 400, errors: error.errors } };
      }
      if (error instanceof NotFoundError) return { status: 404, body: { title: 'Not Found', status: 404 } };
      throw error;
    }
  }
}

