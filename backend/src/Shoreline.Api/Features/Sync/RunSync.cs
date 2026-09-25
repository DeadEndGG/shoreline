using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>
/// Simulates one reservation feed pull. It reports what it saw; it never silently fixes
/// open issues — those need a retry or a reviewed decision.
/// </summary>
public static class RunSync
{
    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/sync/runs", Handle)
                .WithTags("Sync")
                .WithName(nameof(RunSync));
    }

    internal static async Task<SyncActionResult> Handle(DemoStore store, SimulatedLatency latency, CancellationToken ct)
    {
        await latency.WaitAsync(ct, 1.8);
        return store.Write(Run);
    }

    internal static SyncActionResult Run(DemoState state)
    {
        if (state.Scenario == DemoScenario.FeedUnavailable)
        {
            SetScenario.AddFailedRun(state, state.Now, SyncTrigger.Manual);
            state.Audit(AuditCategory.Sync, "Sync run failed", AuditResult.Warning, "Track feed", detail: "Reservation feed unavailable · existing credentials unchanged");
            return new SyncActionResult(SyncActionOutcome.Failed, "The reservation feed didn't respond. Existing credentials were left unchanged.");
        }

        var received = state.Stays.Count(s => s.IsShortTerm);
        var failed = state.SyncIssues.Count(i => !i.IsResolved);
        state.SyncRuns.Add(new SyncRun
        {
            Id = state.NextId("run"),
            StartedAt = state.Now,
            Trigger = SyncTrigger.Manual,
            Received = received,
            Unchanged = received - failed,
            Failed = failed,
            DurationMs = 2380,
            Result = failed == 0 ? SyncRunResult.Succeeded : SyncRunResult.CompletedWithIssues,
            Note = failed == 0 ? "All reservations in sync" : $"{failed} open issue{(failed == 1 ? "" : "s")} still need review",
        });
        state.FeedLastReceivedAt = state.Now;
        state.Audit(AuditCategory.Sync, failed == 0 ? "Sync run completed" : "Sync run completed with issues",
            failed == 0 ? AuditResult.Success : AuditResult.Warning, "Track feed",
            detail: $"{received} reservations checked · {failed} open issue{(failed == 1 ? "" : "s")}");

        return new SyncActionResult(
            failed == 0 ? SyncActionOutcome.Succeeded : SyncActionOutcome.Failed,
            failed == 0 ? $"Sync complete. {received} reservations checked, no changes." : $"Sync complete. {failed} issue{(failed == 1 ? "" : "s")} still need{(failed == 1 ? "s" : "")} a decision.");
    }
}
