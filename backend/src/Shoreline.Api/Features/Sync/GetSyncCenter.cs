using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

public static class GetSyncCenter
{
    public enum StageHealth { Healthy, Degraded, Down }

    public sealed record Response(
        DemoScenario Scenario,
        IReadOnlyList<Stage> Pipeline,
        Stats Stats,
        IReadOnlyList<Run> Runs,
        IReadOnlyList<Issue> Issues,
        IReadOnlyList<GroupOption> AccessGroups,
        IReadOnlyList<UpcomingArrival> AffectedArrivals);

    public sealed record Stage(string Key, string Name, string Caption, StageHealth Health, string Status);

    public sealed record Stats(DateTimeOffset? LastSuccessfulRun, DateTimeOffset NextScheduledRun, int ProcessedRecords, int UnresolvedFailures, DateTimeOffset FeedLastReceivedAt);

    public sealed record Run(string Id, DateTimeOffset StartedAt, string Source, SyncTrigger Trigger, int Received, int Created, int Updated, int Unchanged, int Failed, int DurationMs, SyncRunResult Result, string? Note);

    public sealed record Issue(
        string Id,
        SyncIssueKind Kind,
        string PersonId,
        string PersonName,
        string Initials,
        string Unit,
        string? ReservationId,
        DateTimeOffset? CheckIn,
        string Summary,
        string NextAction,
        DateTimeOffset CreatedAt,
        DateTimeOffset? ResolvedAt,
        string? Resolution,
        IReadOnlyList<SyncAttempt> Attempts,
        IReadOnlyList<ReservationCandidate> Candidates,
        string Action);

    public sealed record GroupOption(string Id, string Name, string Description, int AccessPoints);

    public sealed record UpcomingArrival(string PersonId, string Name, string Unit, DateTimeOffset CheckIn);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/sync", (DemoStore store) => TypedResults.Ok(store.Read(Project)))
                .WithTags("Sync")
                .WithName(nameof(GetSyncCenter));
    }

    internal static Response Project(DemoState state)
    {
        var now = state.Now;
        var open = state.SyncIssues.Where(i => !i.IsResolved).ToList();
        var online = state.AccessPoints.Count(a => a.Online);
        var outage = state.Scenario == DemoScenario.FeedUnavailable;
        var interrupted = state.Scenario == DemoScenario.ProvisioningInterrupted;

        var pipeline = new List<Stage>
        {
            new("source", "Track Hospitality", "Demo reservation feed · CSV fallback scenario",
                outage ? StageHealth.Down : StageHealth.Healthy,
                outage ? "No response · last received " + PropertyTime.Clock(state.FeedLastReceivedAt) : "Receiving"),
            new("shoreline", "Shoreline Access", "Identity → unit → user type → access group",
                open.Count > 0 ? StageHealth.Degraded : StageHealth.Healthy,
                open.Count > 0 ? $"{open.Count} item{(open.Count == 1 ? "" : "s")} need review" : "All records matched"),
            new("unifi", "UniFi Access", "Credential provisioning (simulated)",
                interrupted ? StageHealth.Down : online < state.AccessPoints.Count ? StageHealth.Degraded : StageHealth.Healthy,
                interrupted ? "Writes interrupted" : $"{online} of {state.AccessPoints.Count} access points online"),
        };

        var runs = state.SyncRuns.Where(r => r.StartedAt <= now).OrderByDescending(r => r.StartedAt).ThenByDescending(r => r.Id).ToList();
        var lastGood = runs.FirstOrDefault(r => r.Result != SyncRunResult.Failed && r.Trigger != SyncTrigger.Retry);
        var nextRun = PropertyTime.At(PropertyTime.DateOf(now), new TimeOnly(PropertyTime.TimeOf(now).Hour, PropertyTime.TimeOf(now).Minute / 15 * 15)).AddMinutes(15);

        var issues = state.SyncIssues
            .OrderBy(i => i.IsResolved ? 1 : 0)
            .ThenByDescending(i => i.ResolvedAt)
            .ThenBy(i => i.CreatedAt)
            .Select(i =>
            {
                var person = state.FindPerson(i.PersonId)!;
                var stay = state.StayFor(person.Id);
                var action = i.Kind switch
                {
                    SyncIssueKind.MissingUnitMapping when !state.UnitMappings.ContainsKey(i.Unit) => "map",
                    SyncIssueKind.DuplicateReservation => "choose",
                    _ => "retry",
                };
                return new Issue(i.Id, i.Kind, person.Id, person.Name, person.Initials, i.Unit, stay?.ReservationId, stay?.CheckIn,
                    i.Summary, i.NextAction, i.CreatedAt, i.ResolvedAt, i.Resolution,
                    i.Attempts.OrderByDescending(a => a.At).ToList(), i.Candidates, action);
            })
            .ToList();

        var affected = outage
            ? GetOverview.UpcomingArrivals(state)
                .OrderBy(s => s.CheckIn)
                .Select(s => new UpcomingArrival(s.PersonId, state.FindPerson(s.PersonId)!.Name, s.Unit, s.CheckIn))
                .ToList()
            : [];

        return new Response(
            state.Scenario,
            pipeline,
            new Stats(lastGood?.StartedAt, nextRun, lastGood?.Received ?? 0, open.Count, state.FeedLastReceivedAt),
            runs.Take(12).Select(r => new Run(r.Id, r.StartedAt, r.Source, r.Trigger, r.Received, r.Created, r.Updated, r.Unchanged, r.Failed, r.DurationMs, r.Result, r.Note)).ToList(),
            issues,
            state.AccessGroups.Where(g => g.AssignableToUnits).Select(g => new GroupOption(g.Id, g.Name, g.Description, g.AccessPointIds.Count)).ToList(),
            affected);
    }
}
