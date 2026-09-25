import { Injectable, computed, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

/** Pre-filled on the sign-in page. Purely cosmetic — a static site cannot enforce a password. */
export const DEMO_CREDENTIALS = { email: 'morgan.hale@example.com', password: 'shoreline-demo' };

const STORAGE_KEY = 'shoreline.demo-session';

/**
 * Fake session for presentation realism. Stored per browser tab; nothing is verified or sent anywhere.
 */
@Injectable({ providedIn: 'root' })
export class DemoSession {
  private readonly email = signal<string | null>(this.restore());
  readonly signedIn = computed(() => this.email() !== null);
  readonly userEmail = this.email.asReadonly();

  signIn(email: string) {
    this.email.set(email);
    try { sessionStorage.setItem(STORAGE_KEY, email); } catch { /* storage unavailable: keep in memory */ }
  }

  signOut() {
    this.email.set(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  private restore(): string | null {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
}

/** Sends visitors to the sign-in page first, then back to where they were going. */
export const requireDemoSession: CanActivateFn = (_route, state) => {
  if (inject(DemoSession).signedIn()) return true;
  const redirect = state.url && state.url !== '/' ? state.url : undefined;
  return inject(Router).createUrlTree(['/sign-in'], { queryParams: redirect ? { redirect } : {} });
};
