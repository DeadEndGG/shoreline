import { beforeEach, describe, expect, it } from 'vitest';
import { AccessRules, Credential } from './domain';
import { DemoStore } from './router';
import { DemoApi } from './demo-api';
import { at } from './time';

// These mirror backend/tests: the same demo-script guarantees, now for the browser-only build.

type Json = Record<string, any>;

let api: DemoApi;
const call = (method: string, path: string, body?: unknown) => {
  const [route, qs] = path.split('?');
  return api.execute(method, route, new URLSearchParams(qs ?? ''), body);
};
const get = (path: string) => {
  const result = call('GET', path);
  expect(result.status).toBe(200);
  return result.body as Json;
};
const post = (path: string, body: unknown = {}) => call('POST', path, body) as { status: number; body: Json };
const advance = (target: 'checkIn' | 'checkout') => post('demo/clock/advance', { target });

beforeEach(() => {
  api = new DemoApi();
});

describe('AccessRules', () => {
  const checkIn = at(2026, 9, 26, 16);
  const checkOut = at(2026, 10, 3, 10);
  const provisioned = () => {
    const c = new Credential('c', 'p', null, 'pinAndQr', '123456', null, checkIn, checkOut);
    c.markProvisioned(checkIn - 4 * 3600_000, 'guest-standard');
    return c;
  };

  it('treats check-in as inclusive and checkout as exclusive', () => {
    const c = provisioned();
    expect(AccessRules.statusOf(c, null, checkIn - 1)).toBe('scheduled');
    expect(AccessRules.statusOf(c, null, checkIn)).toBe('active');
    expect(AccessRules.statusOf(c, null, checkOut - 1)).toBe('active');
    expect(AccessRules.statusOf(c, null, checkOut)).toBe('expired');
  });

  it('never gives active access to failed provisioning', () => {
    const c = new Credential('c', 'p', null, 'pinAndQr', '1', null, checkIn, checkOut);
    c.markFailed('timeout');
    expect(AccessRules.statusOf(c, null, checkIn + 1)).toBe('needsAttention');
    expect(AccessRules.canEnterNow(c, null, checkIn + 1)).toBe(false);
  });

  it('evaluates staff schedules in property time', () => {
    const c = new Credential('c', 'p', null, 'keyCard', '1', null, at(2025, 1, 1), null, { start: 8 * 60, end: 16 * 60 });
    c.markProvisioned(at(2025, 1, 1), 'staff-housekeeping');
    expect(AccessRules.canEnterNow(c, null, at(2026, 9, 26, 15, 59))).toBe(true);
    expect(AccessRules.canEnterNow(c, null, at(2026, 9, 26, 16, 0))).toBe(false);
  });
});

describe('demo script', () => {
  it('derives the baseline numbers from records', () => {
    const overview = get('overview');
    expect(overview['metrics']).toEqual({ activeGuestStays: 186, arrivalsToday: 42, departuresToday: 38, needsAttention: 3 });
    expect(overview['readiness']['ready']).toBe(39);
    expect(overview['readiness']['total']).toBe(42);
    expect(overview['health']['accessPointsOnline']).toBe(14);
    expect(get('people?segment=activeStays')['matching']).toBe(186);
    expect(get('overview/stays?view=arrivals&take=100')['total']).toBe(42);
  });

  it('takes Unit 807 from scheduled to active to expired at exact boundaries', () => {
    let pass = get('guest-pass/avery-morgan');
    expect(pass['state']).toBe('ready');
    expect(pass['note']).toBe('Your access begins Saturday at 4:00 PM and ends the following Saturday at 10:00 AM.');

    advance('checkIn');
    pass = get('guest-pass/avery-morgan');
    expect(pass['state']).toBe('active');
    expect(pass['now']).toBe('2026-09-26T21:00:00.000Z');

    advance('checkout');
    pass = get('guest-pass/avery-morgan');
    expect(pass['state']).toBe('ended');
    expect(pass['pin']).toBeNull();
    expect(pass['qrPayload']).toBeNull();
    expect(get('activity?q=Avery%20Morgan')['items'].some((i: Json) => i['event']['title'] === 'Credential expired')).toBe(true);
  });

  it('moves readiness to 40 of 42 everywhere after one fix', () => {
    const { status, body } = post('sync/issues/iss-taylor-reed/retry');
    expect(status).toBe(200);
    expect(body['outcome']).toBe('succeeded');
    expect(get('overview')['readiness']['ready']).toBe(40);
    expect(get('overview')['metrics']['needsAttention']).toBe(2);
    expect(get('sync')['stats']['unresolvedFailures']).toBe(2);
    expect(get('people/taylor-reed')['summary']['status']).toBe('scheduled');
  });

  it('does not duplicate identities or credentials on retry', () => {
    const state = api.store.state;
    const before = [state.people.length, state.credentials.length];
    post('sync/issues/iss-taylor-reed/retry');
    const second = post('sync/issues/iss-taylor-reed/retry');
    post('sync/runs');
    expect(second.body['outcome']).toBe('alreadyResolved');
    expect([state.people.length, state.credentials.length]).toEqual(before);
    expect(state.credentialFor('taylor-reed')!.controllerWrites).toBe(1);
  });

  it('does not fix invalid data with a magic retry', () => {
    expect(post('sync/issues/iss-jordan-ellis/retry').status).toBe(400);
    expect(post('sync/issues/iss-casey-brooks/retry').status).toBe(400);
    expect(post('sync/issues/iss-jordan-ellis/map-unit', { accessGroupId: 'guest-standard' }).body['outcome']).toBe('succeeded');

    const casey = get('sync')['issues'].find((i: Json) => i['id'] === 'iss-casey-brooks');
    const keep = casey['candidates'][1]['reservationId'];
    expect(post('sync/issues/iss-casey-brooks/choose-reservation', { reservationId: keep }).status).toBe(200);
    const person = get('people/casey-brooks');
    expect(person['stay']['reservationId']).toBe(keep);
    expect(person['credential']['validUntil']).toBe('2026-10-01T15:00:00.000Z');
    expect(get('overview')['readiness']['ready']).toBe(41);
  });

  it('keeps revoked access revoked when the clock advances', () => {
    expect(post('people/avery-morgan/revoke', { reason: '' }).status).toBe(400);
    expect(post('people/avery-morgan/revoke', { reason: 'Reservation cancelled by owner' }).status).toBe(200);
    advance('checkIn');
    const pass = get('guest-pass/avery-morgan');
    expect(pass['state']).toBe('revoked');
    expect(pass['pin']).toBeNull();
    expect(get('overview')['readiness']['ready']).toBe(38);
  });

  it('never renders an active pass for failed provisioning', () => {
    advance('checkIn');
    const pass = get('guest-pass/jordan-ellis');
    expect(pass['state']).toBe('pending');
    expect(pass['pin']).toBeNull();
  });

  it('validates and applies access extensions', () => {
    expect(post('people/avery-morgan/extend', { until: '2026-10-02T10:00' }).status).toBe(400);
    const ok = post('people/avery-morgan/extend', { until: '2026-10-04T10:00' });
    expect(ok.status).toBe(200);
    expect(ok.body['stay']['checkOut']).toBe('2026-10-04T15:00:00.000Z');
    advance('checkout');
    expect(get('guest-pass/avery-morgan')['state']).toBe('active');
  });

  it('validates temporary access windows and locations', () => {
    const bad = post('people/temporary-access', {
      name: 'Harbor Glass', type: 'vendor', host: 'Maintenance', accessPointIds: [],
      start: '2026-09-26T17:00', end: '2026-09-26T16:00', reason: 'Window repair',
    });
    expect(bad.status).toBe(400);
    expect(bad.body['errors']['end']).toBeTruthy();
    expect(bad.body['errors']['accessPointIds']).toBeTruthy();

    const created = post('people/temporary-access', {
      name: 'Harbor Glass', type: 'vendor', host: 'Maintenance', accessPointIds: ['service-entry'],
      start: '2026-09-26T16:00', end: '2026-09-26T18:00', reason: 'Window repair',
    });
    expect(created.status).toBe(201);
    expect(created.body['person']['summary']['status']).toBe('scheduled');
    expect(get('people?type=vendor&q=Harbor')['matching']).toBe(1);
    expect(get('activity?category=manual')['items'][0]['event']['title']).toBe('Temporary access created');
  });

  it('keeps interrupted provisioning pending until retried after recovery', () => {
    call('PUT', 'sync/scenario', { scenario: 'provisioningInterrupted' });
    expect(post('sync/issues/iss-riley-chen/retry').body['outcome']).toBe('failed');
    expect(get('guest-pass/riley-chen')['state']).toBe('pending');
    call('PUT', 'sync/scenario', { scenario: 'normal' });
    expect(post('sync/issues/iss-riley-chen/retry').body['outcome']).toBe('succeeded');
    expect(get('guest-pass/riley-chen')['state']).toBe('ready');
  });

  it('flags upcoming arrivals during a feed outage and recovers', () => {
    call('PUT', 'sync/scenario', { scenario: 'feedUnavailable' });
    const health = get('overview')['health'];
    expect(health['feedStale']).toBe(true);
    expect(health['upcomingArrivalsAffected']).toBeGreaterThan(0);
    expect(post('sync/runs').body['outcome']).toBe('failed');
    call('PUT', 'sync/scenario', { scenario: 'normal' });
    expect(get('overview')['health']['feedStale']).toBe(false);
  });

  it('restores the original clock and records on reset', () => {
    post('sync/issues/iss-taylor-reed/retry');
    advance('checkout');
    post('demo/reset');
    const overview = get('overview');
    expect(overview['now']).toBe('2026-09-26T20:45:00.000Z');
    expect(overview['readiness']['ready']).toBe(39);
  });

  it('reports the credential lifecycle Jon asked for', () => {
    let lifecycle = get('overview')['lifecycle'];
    expect(lifecycle['expired']).toBe(38);
    expect(lifecycle['revoked']).toBe(0);
    expect(lifecycle['failedSyncs']).toBe(3);
    post('people/avery-morgan/revoke', { reason: 'Owner cancelled' });
    advance('checkIn');
    lifecycle = get('overview')['lifecycle'];
    expect(lifecycle['revoked']).toBe(1);
    expect(lifecycle['manualExceptions']).toBe(1);
    expect(lifecycle['activated']).toBeGreaterThanOrEqual(38);
  });

  it('only moves the clock forward', () => {
    advance('checkIn');
    expect(advance('checkIn').status).toBe(400);
  });

  it('rejects unknown enum query values like the server', () => {
    expect(call('GET', 'people?segment=nope', undefined).status).toBe(400);
    expect(new DemoStore().state.people.length).toBeGreaterThan(300);
  });
});
