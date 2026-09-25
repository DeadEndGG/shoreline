using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>Result of any sync resolution action.</summary>
public sealed record SyncActionResult(SyncActionOutcome Outcome, string Message);

public enum SyncActionOutcome { Succeeded, Failed, AlreadyResolved }

/// <summary>
/// Behaviour shared by the Sync slices: finishing a credential write for an issue.
/// Idempotent by construction — a credential is written at most once, and a resolved
/// issue is never processed again.
/// </summary>
internal static class Provisioning
{
    public const string ControllerUnavailable = "UniFi Access controller did not acknowledge the write (simulated interruption).";

    public static SyncActionResult Complete(DemoState state, SyncIssue issue, string resolution)
    {
        var person = state.FindPerson(issue.PersonId)!;
        var credential = state.CredentialFor(person.Id)!;

        if (state.Scenario == DemoScenario.ProvisioningInterrupted)
        {
            credential.MarkFailed(ControllerUnavailable);
            issue.Attempts.Add(new SyncAttempt(state.Now, false, "Controller connection interrupted — nothing was written"));
            state.Audit(AuditCategory.Sync, "Retry failed", AuditResult.Warning, "Shoreline Access", person, detail: "Controller connection interrupted");
            return new SyncActionResult(SyncActionOutcome.Failed, "The controller connection is still interrupted. Nothing was written; try again once it's restored.");
        }

        var group = credential.AccessGroupId ?? state.UnitMappings.GetValueOrDefault(issue.Unit);
        var wrote = credential.MarkProvisioned(state.Now, group);
        issue.Attempts.Add(new SyncAttempt(state.Now, true, wrote ? "Credential written and confirmed" : "Credential already present — no new write"));
        issue.Resolve(state.Now, resolution);

        state.SyncRuns.Add(new SyncRun
        {
            Id = state.NextId("run"),
            StartedAt = state.Now,
            Trigger = SyncTrigger.Retry,
            Received = 1,
            Created = wrote ? 1 : 0,
            Unchanged = wrote ? 0 : 1,
            DurationMs = 1240,
            Result = SyncRunResult.Succeeded,
            Note = $"{person.Name} · Unit {issue.Unit}",
        });

        state.Audit(AuditCategory.Sync, "Exception resolved", AuditResult.Success, "Shoreline Access", person, detail: resolution);
        if (wrote)
        {
            var window = credential.ValidUntil is { } until
                ? $"Scheduled for {PropertyTime.Format(credential.ValidFrom, "MMM d, h:mm tt")} → {PropertyTime.Format(until, "MMM d, h:mm tt")}"
                : "Scheduled";
            state.Audit(AuditCategory.Credential, "Credential prepared", AuditResult.Success, "Shoreline Access", person, detail: window);
        }

        return new SyncActionResult(SyncActionOutcome.Succeeded, $"{person.Name}'s credential is prepared and scheduled.");
    }

    public static SyncActionResult AlreadyResolved(SyncIssue issue) =>
        new(SyncActionOutcome.AlreadyResolved, $"This issue was already resolved{(issue.Resolution is null ? "" : $": {issue.Resolution}")}. No changes were made.");
}
