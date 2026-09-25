using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Features.Overview;
using Shoreline.Api.Features.Shared;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>The person drawer: identity, stay, credential, locations, lifecycle and history.</summary>
public static class GetPerson
{
    public sealed record Response(
        PersonSummary Summary,
        string Email,
        string Phone,
        StayDetail? Stay,
        CredentialDetail? Credential,
        IReadOnlyList<Location> Locations,
        IReadOnlyList<LifecycleStep> Lifecycle,
        OpenIssue? Issue,
        IReadOnlyList<GetOverview.ActivityItem> Activity,
        Actions Actions);

    public sealed record StayDetail(string ReservationId, string Source, string Unit, DateTimeOffset CheckIn, DateTimeOffset CheckOut, DateTimeOffset? ExpectedArrival, int Guests, ReservationState State, bool IsShortTerm);

    public sealed record CredentialDetail(
        string Id,
        CredentialMethod Method,
        string MethodLabel,
        string Pin,
        string QrPayload,
        ProvisioningState Provisioning,
        string? ProvisioningError,
        DateTimeOffset? PreparedAt,
        DateTimeOffset ValidFrom,
        DateTimeOffset? ValidUntil,
        string? Schedule,
        bool CanEnterNow,
        string? AccessGroup,
        DateTimeOffset? RevokedAt,
        string? RevokeReason);

    public sealed record Location(string Id, string Name, string Place, AccessPointCategory Category, bool Online);

    public enum StepState { Done, Current, Failed, Upcoming }

    public sealed record LifecycleStep(string Key, string Label, StepState State, DateTimeOffset? At, string? Detail);

    public sealed record OpenIssue(string Id, SyncIssueKind Kind, string Summary, string NextAction);

    public sealed record Actions(bool CanExtend, string? ExtendDisabledReason, bool CanRevoke, string? RevokeDisabledReason, bool HasGuestPass);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/people/{id}", (string id, DemoStore store) =>
                    store.Read<Results<Ok<Response>, NotFound>>(state =>
                        state.FindPerson(id) is { } person ? TypedResults.Ok(Project(state, person)) : TypedResults.NotFound()))
                .WithTags("People")
                .WithName(nameof(GetPerson));
    }

    internal static Response Project(DemoState state, Person person)
    {
        var stay = state.StayFor(person.Id);
        var credential = state.CredentialFor(person.Id);
        var summary = state.ToSummary(person);
        var issue = state.OpenIssueFor(person.Id);

        var credentialDetail = credential is null
            ? null
            : new CredentialDetail(
                credential.Id,
                credential.Method,
                PersonProjection.MethodLabel(credential.Method),
                credential.Pin,
                credential.QrPayload,
                credential.Provisioning,
                credential.ProvisioningError,
                credential.PreparedAt,
                credential.ValidFrom,
                credential.ValidUntil,
                credential.Schedule is { } s ? PersonProjection.ScheduleLabel(s) : null,
                AccessRules.CanEnterNow(credential, stay, state.Now),
                state.GroupNameFor(credential),
                credential.RevokedAt,
                credential.RevokeReason);

        var locations = credential is null
            ? []
            : state.AccessPointsFor(credential).Select(a => new Location(a.Id, a.Name, a.Location, a.Category, a.Online)).ToList();

        var activity = state.AuditTimeline()
            .Where(e => e.PersonId == person.Id && e.At <= state.Now)
            .Take(8)
            .Select(GetOverview.ToItem)
            .ToList();

        var status = summary.Status;
        var ended = status is CredentialStatus.Revoked or CredentialStatus.Expired;
        var actions = new Actions(
            CanExtend: credential is not null && !credential.IsRevoked && credential.ValidUntil is not null,
            ExtendDisabledReason: credential switch
            {
                null => "No credential exists for this person.",
                { IsRevoked: true } => "Revoked access can't be extended. Create temporary access instead.",
                { ValidUntil: null } => "This access has no end date.",
                _ => null,
            },
            CanRevoke: credential is not null && !ended,
            RevokeDisabledReason: ended ? $"Access is already {status.ToString().ToLowerInvariant()}." : null,
            HasGuestPass: credential is not null && person.Type is PersonType.StrGuest or PersonType.MidtermRenter or PersonType.Visitor);

        return new Response(
            summary,
            person.Email,
            person.Phone,
            stay is null ? null : new StayDetail(stay.ReservationId, stay.Source, stay.Unit, stay.CheckIn, stay.CheckOut, stay.ExpectedArrival, stay.Guests, stay.State, stay.IsShortTerm),
            credentialDetail,
            locations,
            BuildLifecycle(state, person, stay, credential, issue),
            issue is null ? null : new OpenIssue(issue.Id, issue.Kind, issue.Summary, issue.NextAction),
            activity,
            actions);
    }

    /// <summary>received → identity matched → permissions assigned → credential prepared → scheduled/active → expired/revoked.</summary>
    internal static IReadOnlyList<LifecycleStep> BuildLifecycle(DemoState state, Person person, Stay? stay, Credential? credential, SyncIssue? issue)
    {
        var now = state.Now;
        var steps = new List<LifecycleStep>();
        var received = stay?.ReceivedAt ?? credential?.PreparedAt ?? credential?.ValidFrom;
        var receivedLabel = stay is null
            ? person.Type switch
            {
                PersonType.Owner => "Owner record created",
                PersonType.Staff => "Staff profile created",
                PersonType.Vendor => "Vendor approved",
                _ => "Access requested",
            }
            : stay.IsShortTerm ? "Reservation received" : "Lease received";

        steps.Add(new LifecycleStep("received", receivedLabel, StepState.Done, received, stay is null ? null : $"{stay.Source} · {stay.ReservationId}"));

        var duplicate = issue?.Kind == SyncIssueKind.DuplicateReservation;
        steps.Add(duplicate
            ? new LifecycleStep("identity", "Identity matched", StepState.Failed, issue!.CreatedAt, "Two overlapping reservations — review needed")
            : new LifecycleStep("identity", "Identity matched", StepState.Done, received?.AddSeconds(2), person.Email));

        var mappingGap = issue?.Kind == SyncIssueKind.MissingUnitMapping;
        var groupName = credential is null ? null : state.GroupNameFor(credential);
        steps.Add(mappingGap
            ? new LifecycleStep("permissions", "Permissions assigned", StepState.Failed, issue!.CreatedAt, issue.Summary)
            : duplicate
                ? new LifecycleStep("permissions", "Permissions assigned", StepState.Upcoming, null, "Waiting for reservation review")
                : new LifecycleStep("permissions", "Permissions assigned", StepState.Done, credential?.PreparedAt ?? received, groupName));

        var provisioning = credential?.Provisioning ?? ProvisioningState.Pending;
        steps.Add(provisioning switch
        {
            ProvisioningState.Succeeded => new LifecycleStep("prepared", "Credential prepared", StepState.Done, credential!.PreparedAt, "Written to UniFi Access (simulated)"),
            ProvisioningState.Failed when !mappingGap => new LifecycleStep("prepared", "Credential prepared", StepState.Failed, issue?.Attempts.LastOrDefault()?.At, credential!.ProvisioningError),
            _ => new LifecycleStep("prepared", "Credential prepared", StepState.Upcoming, null, "Not yet created"),
        });

        if (credential is null)
        {
            return steps;
        }

        var status = AccessRules.StatusOf(credential, stay, now);
        var activeLabel = credential.ValidFrom > now ? "Scheduled" : "Active";
        var activeState = status switch
        {
            CredentialStatus.Scheduled => StepState.Current,
            CredentialStatus.Active => StepState.Current,
            CredentialStatus.Expired => StepState.Done,
            CredentialStatus.Revoked when credential.RevokedAt >= credential.ValidFrom => StepState.Done,
            _ => StepState.Upcoming,
        };
        steps.Add(new LifecycleStep("active", status == CredentialStatus.Scheduled ? "Scheduled" : activeLabel, activeState, credential.ValidFrom,
            status == CredentialStatus.Scheduled ? "Becomes active at check-in" : credential.Schedule is { } sch ? PersonProjection.ScheduleLabel(sch) : "Access window open"));

        steps.Add(status switch
        {
            CredentialStatus.Revoked => new LifecycleStep("ended", "Revoked", StepState.Done, credential.RevokedAt, credential.RevokeReason),
            CredentialStatus.Expired => new LifecycleStep("ended", "Expired", StepState.Done, credential.ValidUntil, "Access window closed at checkout"),
            _ when credential.ValidUntil is { } until => new LifecycleStep("ended", "Expires", StepState.Upcoming, until, "Ends automatically at checkout"),
            _ => new LifecycleStep("ended", "No end date", StepState.Upcoming, null, "Continues until revoked"),
        });

        return steps;
    }
}
