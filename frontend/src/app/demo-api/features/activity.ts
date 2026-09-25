import { AuditCategory, AuditResult } from '../../core/api/models';
import { toActivityItem } from '../projections';
import { Route, clamp, enumParam, intParam } from '../router';

const CATEGORIES: readonly AuditCategory[] = ['access', 'credential', 'sync', 'manual'];
const RESULTS: readonly AuditResult[] = ['success', 'denied', 'warning', 'info'];

/** The audit trail, newest first. Events "in the future" of the demo clock are hidden. */
export const activityRoutes: Route[] = [
  {
    method: 'GET',
    path: /^activity$/,
    handle: ({ state, query }) => {
      const category = enumParam(query, 'category', CATEGORIES);
      const result = enumParam(query, 'result', RESULTS);
      const term = query.get('q')?.trim().toLowerCase() ?? '';
      const take = clamp(intParam(query, 'take', 60), 1, 500);

      const visible = state.auditTimeline().filter((e) => e.at <= state.now);
      const searched = visible.filter((e) => !term || [e.title, e.detail, e.personName, e.unit, e.accessPointName, e.source].some((v) => v?.toLowerCase().includes(term)));
      const matching = searched.filter((e) => category === null || e.category === category).filter((e) => result === null || e.result === result);

      return {
        total: visible.length,
        matching: matching.length,
        categoryCounts: Object.fromEntries(CATEGORIES.map((c) => [c, searched.filter((e) => e.category === c).length])),
        items: matching.slice(0, take).map((e) => ({ event: toActivityItem(e), source: e.source })),
      };
    },
  },
];
