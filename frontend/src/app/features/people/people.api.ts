import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { api } from '../../core/api/api-url';
import { DemoState } from '../../core/demo/demo-state';
import { MessagePreview, PersonDetail, TemporaryAccessRequest } from './people.models';

/** Commands for the People slice. Every mutation refreshes all live views. */
@Injectable({ providedIn: 'root' })
export class PeopleApi {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoState);

  extend(id: string, until: string, note?: string) {
    return this.demo.mutate(() => firstValueFrom(this.http.post<PersonDetail>(api(`people/${id}/extend`), { until, note })));
  }

  revoke(id: string, reason: string) {
    return this.demo.mutate(() => firstValueFrom(this.http.post<PersonDetail>(api(`people/${id}/revoke`), { reason })));
  }

  resend(id: string, channel: 'email' | 'sms') {
    return this.demo.mutate(() => firstValueFrom(this.http.post<MessagePreview>(api(`people/${id}/message/resend`), { channel })));
  }

  createTemporaryAccess(request: TemporaryAccessRequest) {
    return this.demo.mutate(() =>
      firstValueFrom(this.http.post<{ personId: string; person: PersonDetail }>(api('people/temporary-access'), request)),
    );
  }
}
