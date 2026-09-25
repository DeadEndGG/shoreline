using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.AccessPoints;

/// <summary>Access point drawer. Deliberately read-only: door unlock controls are out of scope.</summary>
public static class GetAccessPoint
{
    public sealed record Response(ListAccessPoints.Item Point, IReadOnlyList<Group> Groups, IReadOnlyList<GetOverview.ActivityItem> RecentEntries, Camera? Camera);

    public sealed record Group(string Id, string Name, string Description);

    public sealed record Camera(string Label, string Note);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/access-points/{id}", (string id, DemoStore store) =>
                    store.Read<Results<Ok<Response>, NotFound>>(state =>
                    {
                        if (state.FindAccessPoint(id) is not { } point)
                        {
                            return TypedResults.NotFound();
                        }

                        var groups = state.AccessGroups.Where(g => g.AccessPointIds.Contains(point.Id)).Select(g => new Group(g.Id, g.Name, g.Description)).ToList();
                        var entries = state.AuditTimeline().Where(e => e.AccessPointId == point.Id && e.At <= state.Now).Take(8).Select(GetOverview.ToItem).ToList();
                        var camera = point.HasCamera
                            ? new Camera("Camera preview · Demo still", point.Online ? "Illustrative still image — not a live feed." : "Reader offline. Still image shown for illustration only.")
                            : null;
                        return TypedResults.Ok(new Response(ListAccessPoints.ToItem(state, point), groups, entries, camera));
                    }))
                .WithTags("Access points")
                .WithName(nameof(GetAccessPoint));
    }
}
