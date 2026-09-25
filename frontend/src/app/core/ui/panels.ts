import { Injectable, signal } from '@angular/core';

/**
 * App-wide overlays that any screen can open: the person drawer, the access point
 * drawer, the temporary-access form and global search.
 */
@Injectable({ providedIn: 'root' })
export class Panels {
  readonly personId = signal<string | null>(null);
  readonly accessPointId = signal<string | null>(null);
  readonly temporaryAccess = signal(false);
  readonly search = signal(false);

  openPerson(id: string) {
    this.accessPointId.set(null);
    this.search.set(false);
    this.personId.set(id);
  }

  openAccessPoint(id: string) {
    this.personId.set(null);
    this.search.set(false);
    this.accessPointId.set(id);
  }

  closeDrawers() {
    this.personId.set(null);
    this.accessPointId.set(null);
  }
}
