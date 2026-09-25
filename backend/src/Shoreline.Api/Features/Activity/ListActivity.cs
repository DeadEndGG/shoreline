using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Activity;

/// <summary>The audit trail, newest first. Events "in the future" of the demo clock are hidden.</summary>
public static class ListActivity
{
    public sealed record Response(int Total, int Matching, IReadOnlyDictionary<AuditCategory, int> CategoryCounts, IReadOnlyList<Item> Items);

    public sealed record Item(GetOverview.ActivityItem Event, string Source);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/activity", (DemoStore store, QueryEnum<AuditCategory>? category = null, QueryEnum<AuditResult>? result = null, string? q = null, int take = 60) =>
                    TypedResults.Ok(store.Read(state => Query(state, category?.Value, result?.Value, q, take))))
                .WithTags("Activity")
                .WithName(nameof(ListActivity));
    }

    internal static Response Query(DemoState state, AuditCategory? category, AuditResult? result, string? q, int take)
    {
        var visible = state.AuditTimeline().Where(e => e.At <= state.Now).ToList();
        var searched = visible.Where(e => Matches(e, q)).ToList();
        var counts = Enum.GetValues<AuditCategory>().ToDictionary(c => c, c => searched.Count(e => e.Category == c));
        var matching = searched
            .Where(e => category is null || e.Category == category)
            .Where(e => result is null || e.Result == result)
            .ToList();

        return new Response(
            visible.Count,
            matching.Count,
            counts,
            matching.Take(Math.Clamp(take, 1, 500)).Select(e => new Item(GetOverview.ToItem(e), e.Source)).ToList());
    }

    private static bool Matches(AuditEvent e, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return true;
        }

        var term = q.Trim();
        return new[] { e.Title, e.Detail, e.PersonName, e.Unit, e.AccessPointName, e.Source }
            .Any(v => v?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false);
    }
}
