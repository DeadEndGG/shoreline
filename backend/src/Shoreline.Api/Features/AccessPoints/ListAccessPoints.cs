using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.AccessPoints;

public static class ListAccessPoints
{
    public sealed record Response(int Total, int Online, IReadOnlyDictionary<AccessPointCategory, int> CategoryCounts, IReadOnlyList<Item> Items);

    public sealed record Item(
        string Id,
        string Name,
        string Location,
        AccessPointCategory Category,
        AccessPointKind Kind,
        bool Online,
        DateTimeOffset? OfflineSince,
        bool HasCamera,
        IReadOnlyList<string> Groups,
        LastActivity? LastActivity,
        int EntriesToday);

    public sealed record LastActivity(DateTimeOffset At, string Title, string? PersonName, AuditResult Result);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/access-points", (DemoStore store, QueryEnum<AccessPointCategory>? category = null) =>
                    TypedResults.Ok(store.Read(state => Query(state, category?.Value))))
                .WithTags("Access points")
                .WithName(nameof(ListAccessPoints));
    }

    internal static Response Query(DemoState state, AccessPointCategory? category)
    {
        var counts = Enum.GetValues<AccessPointCategory>().ToDictionary(c => c, c => state.AccessPoints.Count(a => a.Category == c));
        var items = state.AccessPoints
            .Where(a => category is null || a.Category == category)
            .Select(a => ToItem(state, a))
            .ToList();
        return new Response(state.AccessPoints.Count, state.AccessPoints.Count(a => a.Online), counts, items);
    }

    internal static Item ToItem(DemoState state, AccessPoint point)
    {
        var today = PropertyTime.DateOf(state.Now);
        var events = state.AuditTimeline().Where(e => e.AccessPointId == point.Id && e.At <= state.Now).ToList();
        var last = events.FirstOrDefault(e => e.Category == AuditCategory.Access && e.Result != AuditResult.Warning) ?? events.FirstOrDefault();
        return new Item(
            point.Id,
            point.Name,
            point.Location,
            point.Category,
            point.Kind,
            point.Online,
            point.OfflineSince,
            point.HasCamera,
            state.AccessGroups.Where(g => g.AccessPointIds.Contains(point.Id)).Select(g => g.Name).ToList(),
            last is null ? null : new LastActivity(last.At, last.Title, last.PersonName, last.Result),
            events.Count(e => e.Category == AuditCategory.Access && e.Result == AuditResult.Success && PropertyTime.DateOf(e.At) == today));
    }
}
