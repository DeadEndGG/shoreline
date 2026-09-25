using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Shared;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Overview;

/// <summary>Everything the hero dashboard needs, computed from one consistent snapshot.</summary>
public static class GetOverview
{
    public sealed record Response(
        Lifecycle Lifecycle,
        string Greeting,
        DateTimeOffset Now,
        Metrics Metrics,
        Readiness Readiness,
        Health Health,
        IReadOnlyList<ActivityItem> RecentActivity);

    /// <summary>Credential lifecycle counts for today, in property time.</summary>
    public sealed record Lifecycle(int Created, int Activated, int Expired, int Revoked, int ManualExceptions, int FailedSyncs);

    public sealed record Metrics(int ActiveGuestStays, int ArrivalsToday, int DeparturesToday, int NeedsAttention);

    public sealed record Readiness(int Ready, int Total, DateTimeOffset? CheckInAt, IReadOnlyList<ReadinessIssue> Issues);

    public sealed record ReadinessIssue(string IssueId, SyncIssueKind Kind, string PersonId, string PersonName, string Initials, string Unit, string Summary);

    public sealed record Health(
        DemoScenario Scenario,
        DateTimeOffset FeedLastReceivedAt,
        bool FeedStale,
        int AccessPointsOnline,
        int AccessPointsTotal,
        IReadOnlyList<OfflinePoint> Offline,
        int UpcomingArrivalsAffected);

    public sealed record OfflinePoint(string Id, string Name, DateTimeOffset Since);

    public sealed record ActivityItem(string Id, DateTimeOffset At, string Title, string? Detail, string? PersonId, string? PersonName, string? Unit, string? AccessPointId, string? AccessPointName, AuditCategory Category, AuditResult Result);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/overview", (DemoStore store) => TypedResults.Ok(store.Read(Project)))
                .WithTags("Overview")
                .WithName(nameof(GetOverview));
    }

    internal static Response Project(DemoState state)
    {
        var now = state.Now;
        var arrivals = state.Stays.Where(s => StaySegments.ArrivesToday(s, now)).ToList();
        var ready = arrivals.Count(s => state.CredentialFor(s.PersonId) is { } c && AccessRules.IsReady(c, s));
        var openIssues = state.SyncIssues.Where(i => !i.IsResolved).ToList();
        var arrivalIds = arrivals.Select(a => a.PersonId).ToHashSet();

        var metrics = new Metrics(
            state.Stays.Count(s => StaySegments.IsActiveGuestStay(s, now)),
            arrivals.Count,
            state.Stays.Count(s => StaySegments.DepartsToday(s, now)),
            openIssues.Count);

        var readiness = new Readiness(
            ready,
            arrivals.Count,
            arrivals.Count == 0 ? null : arrivals.Min(a => a.CheckIn),
            openIssues
                .Where(i => arrivalIds.Contains(i.PersonId))
                .OrderBy(i => i.CreatedAt)
                .Select(i =>
                {
                    var person = state.FindPerson(i.PersonId)!;
                    return new ReadinessIssue(i.Id, i.Kind, person.Id, person.Name, person.Initials, i.Unit, i.Summary);
                })
                .ToList());

        var feedStale = state.Scenario == DemoScenario.FeedUnavailable;
        var health = new Health(
            state.Scenario,
            state.FeedLastReceivedAt,
            feedStale,
            state.AccessPoints.Count(a => a.Online),
            state.AccessPoints.Count,
            state.AccessPoints.Where(a => !a.Online).Select(a => new OfflinePoint(a.Id, a.Name, a.OfflineSince ?? now)).ToList(),
            feedStale ? UpcomingArrivals(state).Count() : 0);

        var hour = PropertyTime.TimeOf(now).Hour;
        var greeting = hour switch
        {
            < 12 => "Good morning",
            < 17 => "Good afternoon",
            _ => "Good evening",
        };

        var activity = state.AuditTimeline()
            .Where(e => e.At <= now)
            .Take(7)
            .Select(ToItem)
            .ToList();

        var today = PropertyTime.DateOf(now);
        bool HappenedToday(DateTimeOffset? at) => at is { } t && t <= now && PropertyTime.DateOf(t) == today;
        var live = state.Credentials.Where(c => c.Provisioning == ProvisioningState.Succeeded && !c.IsRevoked).ToList();
        var lifecycle = new Lifecycle(
            state.Credentials.Count(c => HappenedToday(c.PreparedAt)),
            live.Count(c => HappenedToday(c.ValidFrom)),
            live.Count(c => HappenedToday(c.ValidUntil)),
            state.Credentials.Count(c => HappenedToday(c.RevokedAt)),
            state.AuditEvents.Count(e => e.Category == AuditCategory.Manual && HappenedToday(e.At)),
            openIssues.Count);

        return new Response(lifecycle, $"{greeting}, {DemoClock.ManagerName.Split(' ')[0]}", now, metrics, readiness, health, activity);
    }

    internal static IEnumerable<Stay> UpcomingArrivals(DemoState state) =>
        state.Stays.Where(s => s.IsShortTerm && s.CheckIn > state.Now && s.CheckIn <= state.Now.AddHours(48));

    internal static ActivityItem ToItem(AuditEvent e) =>
        new(e.Id, e.At, e.Title, e.Detail, e.PersonId, e.PersonName, e.Unit, e.AccessPointId, e.AccessPointName, e.Category, e.Result);
}
