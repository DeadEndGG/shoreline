import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { DemoApi } from './demo-api';

/** App-wide instance of the in-browser demo API. */
@Injectable({ providedIn: 'root' })
export class InBrowserApi extends DemoApi {}

const API_PREFIX = /^(?:\.?\/)?api\/([^?#]*)(?:\?([^#]*))?/;

function queryOf(req: HttpRequest<unknown>, inline: string | undefined): URLSearchParams {
  const query = new URLSearchParams(inline ?? '');
  for (const key of req.params.keys()) {
    for (const value of req.params.getAll(key) ?? []) query.append(key, value);
  }
  return query;
}

/** Routes `api/...` requests to {@link InBrowserApi} instead of the network. */
export const inBrowserApiInterceptor: HttpInterceptorFn = (req, next) => {
  const match = API_PREFIX.exec(req.url);
  if (!match) return next(req);

  const api = inject(InBrowserApi);
  const found = api.find(req.method, match[1]);
  const delay = found?.route.latency ? environment.simulatedLatencyMs * found.route.latency : 40;

  return timer(delay).pipe(
    map(() => {
      const result = api.execute(req.method, match[1], queryOf(req, match[2]), req.body);
      if (result.status >= 400) {
        throw new HttpErrorResponse({ status: result.status, statusText: result.status === 400 ? 'Bad Request' : 'Not Found', error: result.body, url: req.url });
      }
      return new HttpResponse({ status: result.status, body: result.body, url: req.url });
    }),
  ) as Observable<HttpResponse<unknown>>;
};
