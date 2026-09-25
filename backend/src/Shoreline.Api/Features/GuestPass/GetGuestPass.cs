using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.GuestPass;

/// <summary>
/// The guest-facing pass. The PIN and QR are only returned while the credential is usable
/// (scheduled or active) — ended, revoked or failed credentials never expose them.
/// </summary>
public static class GetGuestPass
{
    public enum PassState { Ready, Active, Ended, Revoked, Pending }

    public sealed record Response(
        string PersonId,
        string FirstName,
        string Name,
        string? Unit,
        PassState State,
        string StatusLabel,
        string Headline,
        string Note,
        DateTimeOffset ValidFrom,
        DateTimeOffset? ValidUntil,
        string? Schedule,
        string? Pin,
        string? QrPayload,
        IReadOnlyList<Area> Areas,
        IReadOnlyList<string> ArrivalInstructions,
        FrontDesk FrontDesk,
        DateTimeOffset Now);

    public sealed record Area(string Id, string Name, AccessPointCategory Category, AccessPointKind Kind);

    public sealed record FrontDesk(string Phone, string Hours, string Email, string Location);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/guest-pass/{id}", (string id, DemoStore store) =>
                    store.Read<Results<Ok<Response>, NotFound>>(state =>
                        state.FindPerson(id) is { } person && state.CredentialFor(id) is { } credential
                            ? TypedResults.Ok(Project(state, person, credential))
                            : TypedResults.NotFound()))
                .WithTags("Guest pass")
                .WithName(nameof(GetGuestPass));
    }

    internal static Response Project(DemoState state, Person person, Credential credential)
    {
        var stay = state.StayFor(person.Id);
        var status = AccessRules.StatusOf(credential, stay, state.Now);
        var pass = status switch
        {
            CredentialStatus.Scheduled => PassState.Ready,
            CredentialStatus.Active => PassState.Active,
            CredentialStatus.Expired => PassState.Ended,
            CredentialStatus.Revoked => PassState.Revoked,
            _ => PassState.Pending,
        };
        var usable = pass is PassState.Ready or PassState.Active;

        var (label, headline, note) = pass switch
        {
            PassState.Ready => ("Ready for your arrival", "Your pass is ready", AccessWindowSentence(credential)),
            PassState.Active => ("Access active", "Welcome in", AccessWindowSentence(credential)),
            PassState.Ended => ("Stay ended", "Thanks for staying with us", $"Your access ended {PropertyTime.Format(credential.ValidUntil!.Value, "dddd 'at' h:mm tt")}. We hope to welcome you back to Shoreline Residences."),
            PassState.Revoked => ("Access revoked", "This pass is no longer active", "Please contact the front desk if you need access to the building."),
            _ => ("Being prepared", "We're finishing your access setup", "The front desk will confirm your entry details before check-in. No action is needed from you."),
        };

        return new Response(
            person.Id,
            person.FirstName,
            person.Name,
            person.Unit ?? person.HostUnit,
            pass,
            label,
            headline,
            note,
            credential.ValidFrom,
            credential.ValidUntil,
            credential.Schedule is { } s ? Shared.PersonProjection.ScheduleLabel(s) : null,
            usable ? credential.Pin : null,
            usable ? credential.QrPayload : null,
            usable ? state.AccessPointsFor(credential).Select(a => new Area(a.Id, a.Name, a.Category, a.Kind)).ToList() : [],
            [
                "Park in any unreserved space on garage level P1, then use the parking pedestrian entry.",
                "At the lobby reader, scan your QR code or enter your PIN followed by the # key.",
                "Your unit's smart lock uses the same PIN. Beach towels are available at the pool gate.",
                "Quiet hours are 10:00 PM to 8:00 AM. Pool and beach gates close at 10:00 PM.",
            ],
            new FrontDesk("(850) 555-0140", "Daily, 8:00 AM – 10:00 PM", "frontdesk@example.com", "Main lobby, ground floor"),
            state.Now);
    }

    /// <summary>"Your access begins Saturday at 4:00 PM and ends the following Saturday at 10:00 AM."</summary>
    internal static string AccessWindowSentence(Credential credential)
    {
        var begins = $"{PropertyTime.Format(credential.ValidFrom, "dddd")} at {PropertyTime.Clock(credential.ValidFrom)}";
        if (credential.ValidUntil is not { } until)
        {
            return $"Your access began {PropertyTime.Format(credential.ValidFrom, "MMMM d, yyyy")} and continues until changed by management.";
        }

        var fromDate = PropertyTime.DateOf(credential.ValidFrom);
        var untilDate = PropertyTime.DateOf(until);
        var days = untilDate.DayNumber - fromDate.DayNumber;
        var ends = days switch
        {
            0 => $"at {PropertyTime.Clock(until)}",
            7 => $"the following {PropertyTime.Format(until, "dddd")} at {PropertyTime.Clock(until)}",
            < 7 => $"{PropertyTime.Format(until, "dddd")} at {PropertyTime.Clock(until)}",
            _ => $"{PropertyTime.Format(until, "dddd, MMMM d")} at {PropertyTime.Clock(until)}",
        };
        return $"Your access begins {begins} and ends {ends}.";
    }
}
