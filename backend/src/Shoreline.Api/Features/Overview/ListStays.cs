using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Shared;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Overview;

/// <summary>The "Today" table on the overview: arrivals, departures, or everyone in house.</summary>
public static class ListStays
{
    public enum View { Arrivals, Departures, InHouse }

    public sealed record Response(View View, int Total, int Matching, IReadOnlyList<PersonSummary> Items);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/overview/stays", (DemoStore store, QueryEnum<View>? view = null, string? q = null, QueryEnum<CredentialStatus>? status = null, int take = 8) =>
                    TypedResults.Ok(store.Read(state => Query(state, view?.Value ?? View.Arrivals, q, status?.Value, take))))
                .WithTags("Overview")
                .WithName(nameof(ListStays));
    }

    internal static Response Query(DemoState state, View view, string? q, CredentialStatus? status, int take)
    {
        var now = state.Now;
        Func<Stay, bool> inView = view switch
        {
            View.Departures => s => StaySegments.DepartsToday(s, now),
            View.InHouse => s => StaySegments.IsActiveGuestStay(s, now),
            _ => s => StaySegments.ArrivesToday(s, now),
        };

        var rows = state.Stays
            .Where(inView)
            .Select(s => state.ToSummary(state.FindPerson(s.PersonId)!))
            .ToList();

        var matching = rows
            .Where(r => status is null || r.Status == status)
            .Where(r => Matches(r, q))
            // Problems first, then by expected arrival, then name.
            .OrderBy(r => r.HasOpenIssue || r.Status == CredentialStatus.NeedsAttention ? 0 : 1)
            .ThenBy(r => view == View.Departures ? r.AccessUntil : r.ExpectedArrival)
            .ThenBy(r => r.Name)
            .ToList();

        return new Response(view, rows.Count, matching.Count, matching.Take(Math.Clamp(take, 1, 500)).ToList());
    }

    internal static bool Matches(PersonSummary row, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return true;
        }

        var term = q.Trim();
        return row.Name.Contains(term, StringComparison.OrdinalIgnoreCase)
            || (row.Unit?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)
            || (row.ReservationId?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)
            || (row.Role?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false);
    }
}
