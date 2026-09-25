import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { api } from '../../core/api/api-url';
import { ActionResult } from '../../core/api/models';
import { DemoState } from '../../core/demo/demo-state';

@Injectable({ providedIn: 'root' })
export class SyncApi {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoState);

  run() {
    return this.demo.mutate(() => firstValueFrom(this.http.post<ActionResult>(api('sync/runs'), {})));
  }

  retry(issueId: string) {
    return this.demo.mutate(() => firstValueFrom(this.http.post<ActionResult>(api(`sync/issues/${issueId}/retry`), {})));
  }

  mapUnit(issueId: string, accessGroupId: string) {
    return this.demo.mutate(() => firstValueFrom(this.http.post<ActionResult>(api(`sync/issues/${issueId}/map-unit`), { accessGroupId })));
  }

  chooseReservation(issueId: string, reservationId: string) {
    return this.demo.mutate(() =>
      firstValueFrom(this.http.post<ActionResult>(api(`sync/issues/${issueId}/choose-reservation`), { reservationId })),
    );
  }
}
