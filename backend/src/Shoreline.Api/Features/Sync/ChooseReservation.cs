using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>Resolves a duplicate reservation by keeping the reviewed record, then provisions once.</summary>
public static class ChooseReservation
{
    public sealed record Request(string? ReservationId);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/sync/issues/{id}/choose-reservation", Handle)
                .WithTags("Sync")
                .WithName(nameof(ChooseReservation));
    }

    internal static async Task<Results<Ok<SyncActionResult>, NotFound, ValidationProblem>> Handle(string id, Request request, DemoStore store, SimulatedLatency latency, CancellationToken ct)
    {
        await latency.WaitAsync(ct, 1.2);
        return store.Write<Results<Ok<SyncActionResult>, NotFound, ValidationProblem>>(state =>
        {
            if (state.SyncIssues.Find(i => i.Id == id) is not { } issue)
            {
                return TypedResults.NotFound();
            }

            if (issue.IsResolved)
            {
                return TypedResults.Ok(Provisioning.AlreadyResolved(issue));
            }

            var chosen = issue.Candidates.FirstOrDefault(c => c.ReservationId == request.ReservationId);
            var validator = new Validator()
                .Require(issue.Kind == SyncIssueKind.DuplicateReservation, "reservationId", "This issue isn't a duplicate reservation.")
                .Require(chosen is not null, "reservationId", "Choose one of the reservations under review.");
            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            var person = state.FindPerson(issue.PersonId)!;
            var stay = state.StayFor(person.Id)!;
            var credential = state.CredentialFor(person.Id)!;
            var discarded = issue.Candidates.Where(c => c.ReservationId != chosen!.ReservationId).Select(c => c.ReservationId);

            stay.ReservationId = chosen!.ReservationId;
            stay.CheckIn = chosen.CheckIn;
            stay.CheckOut = chosen.CheckOut;
            stay.Guests = chosen.Guests;
            credential.ValidFrom = chosen.CheckIn;
            credential.ValidUntil = chosen.CheckOut;

            state.Audit(AuditCategory.Manual, "Duplicate reservation reviewed", AuditResult.Success, DemoClock.ManagerName, person,
                detail: $"Kept {chosen.ReservationId} · set aside {string.Join(", ", discarded)}");

            return TypedResults.Ok(Provisioning.Complete(state, issue, $"Kept reservation {chosen.ReservationId}"));
        });
    }
}
