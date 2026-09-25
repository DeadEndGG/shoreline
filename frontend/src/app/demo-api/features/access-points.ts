import { AccessPointCategory } from '../../core/api/models';
import { AccessPoint } from '../domain';
import { toActivityItem } from '../projections';
import { NotFoundError, Route, enumParam } from '../router';
import { DemoState } from '../state';
import { dayOf, iso, isoOrNull } from '../time';

const CATEGORIES: readonly AccessPointCategory[] = ['building', 'amenity', 'exterior', 'service'];

function toItem(state: DemoState, point: AccessPoint) {
  const today = dayOf(state.now);
  const events = state.auditTimeline().filter((e) => e.accessPointId === point.id && e.at <= state.now);
  const last = events.find((e) => e.category === 'access' && e.result !== 'warning') ?? events[0];
  return {
    id: point.id, name: point.name, location: point.location, category: point.category, kind: point.kind,
    online: point.online, offlineSince: isoOrNull(point.offlineSince), hasCamera: point.hasCamera,
    groups: state.accessGroups.filter((g) => g.accessPointIds.includes(point.id)).map((g) => g.name),
    lastActivity: last ? { at: iso(last.at), title: last.title, personName: last.personName, result: last.result } : null,
    entriesToday: events.filter((e) => e.category === 'access' && e.result === 'success' && dayOf(e.at) === today).length,
  };
}

/** Access point detail is deliberately read-only: door unlock controls are out of scope. */
function getAccessPoint(state: DemoState, id: string) {
  const point = state.findAccessPoint(id);
  if (!point) throw new NotFoundError();
  return {
    point: toItem(state, point),
    groups: state.accessGroups.filter((g) => g.accessPointIds.includes(point.id)).map((g) => ({ id: g.id, name: g.name, description: g.description })),
    recentEntries: state.auditTimeline().filter((e) => e.accessPointId === point.id && e.at <= state.now).slice(0, 8).map(toActivityItem),
    camera: point.hasCamera
      ? {
        label: 'Camera preview · Demo still',
        note: point.online ? 'Illustrative still image — not a live feed.' : 'Reader offline. Still image shown for illustration only.',
      }
      : null,
  };
}

export const accessPointRoutes: Route[] = [
  {
    method: 'GET',
    path: /^access-points$/,
    handle: ({ state, query }) => {
      const category = enumParam(query, 'category', CATEGORIES);
      return {
        total: state.accessPoints.length,
        online: state.accessPoints.filter((a) => a.online).length,
        categoryCounts: Object.fromEntries(CATEGORIES.map((c) => [c, state.accessPoints.filter((a) => a.category === c).length])),
        items: state.accessPoints.filter((a) => category === null || a.category === category).map((a) => toItem(state, a)),
      };
    },
  },
  { method: 'GET', path: /^access-points\/([^/]+)$/, handle: ({ state, params }) => getAccessPoint(state, params[0]) },
];
