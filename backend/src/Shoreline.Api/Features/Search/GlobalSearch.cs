using Shoreline.Api.Common;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Features.Shared;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Search;

/// <summary>Command-palette search across people, units and access points.</summary>
public static class GlobalSearch
{
    public sealed record Response(string Query, IReadOnlyList<PersonSummary> People, IReadOnlyList<UnitHit> Units, IReadOnlyList<PointHit> AccessPoints);

    public sealed record UnitHit(string Unit, int Floor, IReadOnlyList<Occupant> Occupants);

    public sealed record Occupant(string PersonId, string Name);

    public sealed record PointHit(string Id, string Name, string Location, bool Online);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/search", (DemoStore store, string? q = null) => TypedResults.Ok(store.Read(state => Query(state, q))))
                .WithTags("Search")
                .WithName(nameof(GlobalSearch));
    }

    internal static Response Query(DemoState state, string? q)
    {
        var term = q?.Trim() ?? "";
        if (term.Length == 0)
        {
            var featured = state.People.Where(p => p.Featured).Take(6).Select(state.ToSummary).ToList();
            return new Response(term, featured, [], []);
        }

        var people = state.People
            .Select(state.ToSummary)
            .Where(r => ListStays.Matches(r, term))
            .OrderBy(r => r.Name.StartsWith(term, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenBy(r => r.Name)
            .Take(6)
            .ToList();

        var units = state.People
            .Where(p => p.Unit is not null && p.Unit.StartsWith(term, StringComparison.OrdinalIgnoreCase))
            .GroupBy(p => p.Unit!)
            .OrderBy(g => g.Key.Length).ThenBy(g => g.Key)
            .Take(4)
            .Select(g => new UnitHit(g.Key, int.Parse(g.Key[..^2]), g.Select(p => new Occupant(p.Id, p.Name)).ToList()))
            .ToList();

        var points = state.AccessPoints
            .Where(a => a.Name.Contains(term, StringComparison.OrdinalIgnoreCase) || a.Location.Contains(term, StringComparison.OrdinalIgnoreCase))
            .Take(5)
            .Select(a => new PointHit(a.Id, a.Name, a.Location, a.Online))
            .ToList();

        return new Response(term, people, units, points);
    }
}
