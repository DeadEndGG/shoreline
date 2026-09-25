import { matchesSummary, toSummary } from '../projections';
import { Route } from '../router';

/** Command-palette search across people, units and access points. */
export const searchRoutes: Route[] = [
  {
    method: 'GET',
    path: /^search$/,
    handle: ({ state, query }) => {
      const term = query.get('q')?.trim() ?? '';
      if (!term) {
        return { query: term, people: state.people.filter((p) => p.featured).slice(0, 6).map((p) => toSummary(state, p)), units: [], accessPoints: [] };
      }
      const lower = term.toLowerCase();

      const people = state.people
        .map((p) => toSummary(state, p))
        .filter((r) => matchesSummary(r, term))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(lower)) - Number(!b.name.toLowerCase().startsWith(lower)) || a.name.localeCompare(b.name))
        .slice(0, 6);

      const byUnit = new Map<string, { personId: string; name: string }[]>();
      for (const p of state.people) {
        if (p.unit && p.unit.toLowerCase().startsWith(lower)) byUnit.set(p.unit, [...(byUnit.get(p.unit) ?? []), { personId: p.id, name: p.name }]);
      }
      const units = [...byUnit.entries()]
        .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))
        .slice(0, 4)
        .map(([unit, occupants]) => ({ unit, floor: Number(unit.slice(0, -2)), occupants }));

      const accessPoints = state.accessPoints
        .filter((a) => a.name.toLowerCase().includes(lower) || a.location.toLowerCase().includes(lower))
        .slice(0, 5)
        .map((a) => ({ id: a.id, name: a.name, location: a.location, online: a.online }));

      return { query: term, people, units, accessPoints };
    },
  },
];
