using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>Demo scenario control: normal operation, feed outage, or interrupted provisioning.</summary>
public static class SetScenario
{
    public sealed record Request(DemoScenario Scenario);

    public const string InterruptedGuestId = "riley-chen";

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPut("/sync/scenario", (Request request, DemoStore store) => TypedResults.Ok(store.Write(state => Apply(state, request.Scenario))))
                .WithTags("Sync")
                .WithName(nameof(SetScenario));
    }

    internal static SyncActionResult Apply(DemoState state, DemoScenario next)
    {
        var previous = state.Scenario;
        if (previous == next)
        {
            return new SyncActionResult(SyncActionOutcome.AlreadyResolved, "That scenario is already active.");
        }

        if (previous == DemoScenario.FeedUnavailable)
        {
            RestoreFeed(state);
        }
        else if (previous == DemoScenario.ProvisioningInterrupted)
        {
            state.Audit(AuditCategory.Sync, "Controller connection restored", AuditResult.Success, "UniFi Access",
                detail: "Interrupted writes can now be retried");
        }

        state.Scenario = next;
        return next switch
        {
            DemoScenario.FeedUnavailable => StartOutage(state),
            DemoScenario.ProvisioningInterrupted => Interrupt(state),
            _ => new SyncActionResult(SyncActionOutcome.Succeeded, "Normal operation restored."),
        };
    }

    private static SyncActionResult StartOutage(DemoState state)
    {
        AddFailedRun(state, state.Now, SyncTrigger.Scheduled);
        state.Audit(AuditCategory.Sync, "Reservation feed unavailable", AuditResult.Warning, "Track feed",
            detail: $"No response since {PropertyTime.Clock(state.FeedLastReceivedAt)} · existing access status requires confirmation");
        return new SyncActionResult(SyncActionOutcome.Succeeded, "Feed outage simulated.");
    }

    internal static void AddFailedRun(DemoState state, DateTimeOffset at, SyncTrigger trigger) =>
        state.SyncRuns.Add(new SyncRun
        {
            Id = state.NextId("run"),
            StartedAt = at,
            Trigger = trigger,
            DurationMs = 30000,
            Result = SyncRunResult.Failed,
            Note = "Demo reservation feed did not respond within 30 s",
        });

    private static void RestoreFeed(DemoState state)
    {
        state.FeedLastReceivedAt = state.Now;
        var received = state.Stays.Count(s => s.IsShortTerm);
        var open = state.SyncIssues.Count(i => !i.IsResolved);
        state.SyncRuns.Add(new SyncRun
        {
            Id = state.NextId("run"),
            StartedAt = state.Now,
            Trigger = SyncTrigger.Recovery,
            Received = received,
            Updated = 2,
            Unchanged = received - 2 - open,
            Failed = open,
            DurationMs = 4120,
            Result = open == 0 ? SyncRunResult.Succeeded : SyncRunResult.CompletedWithIssues,
            Note = "Feed restored · caught up on 2 delayed changes",
        });
        state.Audit(AuditCategory.Sync, "Reservation feed restored", AuditResult.Success, "Track feed", detail: "Caught up on 2 delayed changes");
    }

    private static SyncActionResult Interrupt(DemoState state)
    {
        if (state.FindPerson(InterruptedGuestId) is null)
        {
            var person = new Person
            {
                Id = InterruptedGuestId,
                Name = "Riley Chen",
                Type = PersonType.StrGuest,
                Unit = "1008",
                Email = "riley.chen@example.com",
                Phone = "(850) 555-0177",
                Featured = true,
            };
            state.People.Add(person);

            var arrival = PropertyTime.DateOf(state.Now).AddDays(1);
            var stay = new Stay
            {
                Id = state.NextId("stay"),
                PersonId = person.Id,
                ReservationId = "TRK-771204",
                Unit = "1008",
                CheckIn = PropertyTime.At(arrival, new TimeOnly(16, 0)),
                CheckOut = PropertyTime.At(arrival.AddDays(4), new TimeOnly(10, 0)),
                ExpectedArrival = PropertyTime.At(arrival, new TimeOnly(17, 30)),
                Guests = 4,
                ReceivedAt = state.Now.AddMinutes(-1),
            };
            state.Stays.Add(stay);

            var credential = new Credential
            {
                Id = state.NextId("cred"),
                PersonId = person.Id,
                StayId = stay.Id,
                Method = CredentialMethod.PinAndQr,
                Pin = "640297",
                AccessGroupId = state.UnitMappings.GetValueOrDefault("1008"),
                ValidFrom = stay.CheckIn,
                ValidUntil = stay.CheckOut,
            };
            credential.MarkFailed(Provisioning.ControllerUnavailable);
            state.Credentials.Add(credential);

            var issue = new SyncIssue
            {
                Id = "iss-riley-chen",
                Kind = SyncIssueKind.ProvisioningInterrupted,
                PersonId = person.Id,
                StayId = stay.Id,
                Unit = "1008",
                Summary = "Provisioning for Unit 1008 stopped before UniFi Access confirmed the credential.",
                NextAction = "Retry once the controller connection is stable. The credential stays pending until confirmed.",
                CreatedAt = state.Now,
            };
            issue.Attempts.Add(new SyncAttempt(state.Now, false, "Write interrupted after reservation match — credential pending"));
            state.SyncIssues.Add(issue);

            var received = state.Stays.Count(s => s.IsShortTerm);
            var open = state.SyncIssues.Count(i => !i.IsResolved);
            state.SyncRuns.Add(new SyncRun
            {
                Id = state.NextId("run"),
                StartedAt = state.Now,
                Trigger = SyncTrigger.Scheduled,
                Received = received,
                Created = 1,
                Unchanged = received - 1 - open,
                Failed = open,
                DurationMs = 31800,
                Result = SyncRunResult.CompletedWithIssues,
                Note = "Provisioning interrupted for 1 new reservation",
            });

            state.Audit(AuditCategory.Credential, "Reservation received", AuditResult.Info, "Track feed", person,
                detail: $"{stay.ReservationId} · arrives {PropertyTime.Format(stay.CheckIn, "ddd MMM d")}");
            state.Audit(AuditCategory.Sync, "Exception created", AuditResult.Warning, "Shoreline Access", person, detail: "Provisioning interrupted — credential pending");
        }
        else if (state.OpenIssueFor(InterruptedGuestId) is null)
        {
            state.Audit(AuditCategory.Sync, "Controller connection interrupted", AuditResult.Warning, "UniFi Access", detail: "New credential writes will fail until restored");
        }

        return new SyncActionResult(SyncActionOutcome.Succeeded, "Provisioning interruption simulated.");
    }
}
