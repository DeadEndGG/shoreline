using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>Renders the guest-facing email and SMS. Nothing is ever sent.</summary>
public static class GetMessagePreview
{
    public sealed record Response(Email Email, Sms Sms, bool CanResend, string? ResendDisabledReason, DateTimeOffset? LastResentAt);

    public sealed record Email(string To, string From, string Subject, string Preheader, IReadOnlyList<string> Paragraphs, string PassLink);

    public sealed record Sms(string To, string Text);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/people/{id}/message", (string id, DemoStore store) =>
                    store.Read<Results<Ok<Response>, NotFound>>(state =>
                        state.FindPerson(id) is { } person && state.CredentialFor(id) is { } credential
                            ? TypedResults.Ok(Project(state, person, credential))
                            : TypedResults.NotFound()))
                .WithTags("People")
                .WithName(nameof(GetMessagePreview));
    }

    internal static Response Project(DemoState state, Person person, Credential credential)
    {
        var stay = state.StayFor(person.Id);
        var status = AccessRules.StatusOf(credential, stay, state.Now);
        var unit = person.Unit ?? person.HostUnit;
        var from = PropertyTime.Format(credential.ValidFrom, "dddd, MMM d 'at' h:mm tt");
        var until = credential.ValidUntil is { } u ? PropertyTime.Format(u, "dddd, MMM d 'at' h:mm tt") : null;
        var link = $"#/guest/{person.Id}";

        List<string> paragraphs = status switch
        {
            CredentialStatus.Revoked or CredentialStatus.Expired =>
            [
                $"Hi {person.FirstName},",
                "Your access to Shoreline Residences has ended. If you believe this is a mistake, please contact the front desk at (850) 555-0140.",
            ],
            CredentialStatus.NeedsAttention =>
            [
                $"Hi {person.FirstName},",
                "We're finishing the setup of your building access. The front desk will confirm your entry details before check-in.",
            ],
            _ =>
            [
                $"Hi {person.FirstName},",
                $"Your digital pass for Shoreline Residences{(unit is null ? "" : $", Unit {unit}")} is ready.",
                until is null ? $"Access begins {from}." : $"Access begins {from} and ends {until}.",
                "Show the QR code or enter your PIN at the lobby readers and amenity gates listed in your pass.",
            ],
        };

        var smsText = status is CredentialStatus.Scheduled or CredentialStatus.Active
            ? $"Shoreline Residences: your pass{(unit is null ? "" : $" for Unit {unit}")} is ready. Access begins {PropertyTime.Format(credential.ValidFrom, "ddd h:mm tt")}. View: shoreline.example.com/p/{person.Id} (demo)"
            : $"Shoreline Residences: please contact the front desk at (850) 555-0140 about your building access. (demo)";

        var canResend = status is not (CredentialStatus.Revoked or CredentialStatus.Expired);
        return new Response(
            new Email(person.Email, "Shoreline Residences <frontdesk@example.com>", $"Your access for Shoreline Residences{(unit is null ? "" : $", Unit {unit}")}", "Your digital pass, access window and arrival details.", paragraphs, link),
            new Sms(person.Phone, smsText),
            canResend,
            canResend ? null : "Access has ended, so there is nothing to resend.",
            state.MessagesResent.TryGetValue(person.Id, out var at) ? at : null);
    }
}
