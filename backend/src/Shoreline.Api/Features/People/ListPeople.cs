using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Features.Shared;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>Searchable directory of sample occupants with type and segment filters.</summary>
public static class ListPeople
{
    public enum Segment { ActiveStays, ArrivalsToday, DeparturesToday }

    public sealed record Response(int Total, int Matching, IReadOnlyDictionary<PersonType, int> TypeCounts, IReadOnlyList<PersonSummary> Items);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/people", (DemoStore store, QueryEnum<PersonType>? type = null, QueryEnum<Segment>? segment = null, QueryEnum<CredentialStatus>? status = null, string? q = null, int skip = 0, int take = 25) =>
                    TypedResults.Ok(store.Read(state => Query(state, type?.Value, segment?.Value, status?.Value, q, skip, take))))
                .WithTags("People")
                .WithName(nameof(ListPeople));
    }

    internal static Response Query(DemoState state, PersonType? type, Segment? segment, CredentialStatus? status, string? q, int skip, int take)
    {
        var now = state.Now;
        Func<Stay?, bool> inSegment = segment switch
        {
            Segment.ActiveStays => s => s is not null && StaySegments.IsActiveGuestStay(s, now),
            Segment.ArrivalsToday => s => s is not null && StaySegments.ArrivesToday(s, now),
            Segment.DeparturesToday => s => s is not null && StaySegments.DepartsToday(s, now),
            _ => _ => true,
        };

        // Segment + search narrow the population; type counts reflect that population.
        var population = state.People
            .Where(p => inSegment(state.StayFor(p.Id)))
            .Select(state.ToSummary)
            .Where(r => ListStays.Matches(r, q))
            .Where(r => status is null || r.Status == status)
            .ToList();

        var typeCounts = Enum.GetValues<PersonType>().ToDictionary(t => t, t => population.Count(r => r.Type == t));

        var matching = population
            .Where(r => type is null || r.Type == type)
            .OrderBy(r => r.HasOpenIssue ? 0 : 1)
            .ThenBy(r => r.Type)
            .ThenBy(r => r.Name)
            .ToList();

        return new Response(
            state.People.Count,
            matching.Count,
            typeCounts,
            matching.Skip(Math.Max(0, skip)).Take(Math.Clamp(take, 1, 100)).ToList());
    }
}
