using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Demo;

/// <summary>
/// Moves the demo clock forward to a story boundary and records every credential
/// lifecycle transition that the jump crossed, at the instant it happened.
/// </summary>
public static class AdvanceClock
{
    public enum Target { CheckIn, Checkout }

    public sealed record Request(Target Target);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/demo/clock/advance", Handle)
                .WithTags("Demo")
                .WithName(nameof(AdvanceClock));
    }

    internal static Results<Ok<GetDemoState.Response>, ValidationProblem> Handle(Request request, DemoStore store) =>
        store.Write<Results<Ok<GetDemoState.Response>, ValidationProblem>>(state =>
        {
            var target = request.Target == Target.CheckIn ? DemoClock.CheckIn : DemoClock.Checkout;
            var validator = new Validator()
                .Require(target > state.Now, "target", "The demo clock only moves forward. Reset the demo to replay.");
            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            MoveTo(state, target);
            return TypedResults.Ok(GetDemoState.Project(state));
        });

    internal static void MoveTo(DemoState state, DateTimeOffset target)
    {
        var from = state.Now;
        var activated = new List<(Person Person, DateTimeOffset At)>();
        var expired = new List<(Person Person, DateTimeOffset At)>();

        foreach (var credential in state.Credentials)
        {
            var person = state.FindPerson(credential.PersonId)!;
            var stay = credential.StayId is null ? null : state.StayFor(person.Id);
            var before = AccessRules.StatusOf(credential, stay, from);
            var after = AccessRules.StatusOf(credential, stay, target);

            if (before == CredentialStatus.Scheduled && after is CredentialStatus.Active or CredentialStatus.Expired)
            {
                activated.Add((person, credential.ValidFrom));
            }

            if (before is CredentialStatus.Scheduled or CredentialStatus.Active && after == CredentialStatus.Expired)
            {
                expired.Add((person, credential.ValidUntil!.Value));
            }
        }

        state.Now = target;
        if (state.Scenario == DemoScenario.FeedUnavailable)
        {
            // The outage continues: the scheduled run at the new time fails too.
            Sync.SetScenario.AddFailedRun(state, target, SyncTrigger.Scheduled);
        }
        else
        {
            state.FeedLastReceivedAt = target.AddMinutes(-2);
        }

        Record(state, activated, "Access activated", "Credential is now active", "credentials became active");
        Record(state, expired, "Credential expired", "Stay ended at checkout", "credentials ended");
    }

    private static void Record(DemoState state, List<(Person Person, DateTimeOffset At)> transitions, string title, string detail, string summary)
    {
        foreach (var group in transitions.GroupBy(t => t.At).OrderBy(g => g.Key))
        {
            var generated = 0;
            foreach (var (person, at) in group)
            {
                if (person.Featured)
                {
                    state.Audit(AuditCategory.Credential, title, AuditResult.Info, "Shoreline Access", person, detail: $"{detail} · {PropertyTime.Clock(at)}", at: at);
                }
                else
                {
                    generated++;
                }
            }

            if (generated > 0)
            {
                state.Audit(AuditCategory.Credential, title, AuditResult.Info, "Shoreline Access",
                    detail: $"{generated} {(group.Any(t => t.Person.Featured) ? "more " : "")}{summary} at {PropertyTime.Clock(group.Key)}", at: group.Key);
            }
        }
    }
}
