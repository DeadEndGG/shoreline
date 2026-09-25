using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

public static class ExtendAccess
{
    /// <param name="Until">Property wall-clock time, e.g. "2026-10-04T10:00".</param>
    public sealed record Request(string? Until, string? Note);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/people/{id}/extend", Handle)
                .WithTags("People")
                .WithName(nameof(ExtendAccess));
    }

    internal static Results<Ok<GetPerson.Response>, NotFound, ValidationProblem> Handle(string id, Request request, DemoStore store) =>
        store.Write<Results<Ok<GetPerson.Response>, NotFound, ValidationProblem>>(state =>
        {
            if (state.FindPerson(id) is not { } person || state.CredentialFor(id) is not { } credential)
            {
                return TypedResults.NotFound();
            }

            var parsed = PropertyTime.TryParseLocal(request.Until, out var until);
            var validator = new Validator()
                .Require(!credential.IsRevoked, "until", "Revoked access can't be extended.")
                .Require(credential.ValidUntil is not null, "until", "This access has no end date to extend.")
                .Require(parsed, "until", "Enter a valid end date and time.");
            if (parsed)
            {
                validator
                    .Require(until > credential.ValidFrom, "until", "The new end must be after the access start.")
                    .Require(until > state.Now, "until", "The new end must be in the future.")
                    .Require(credential.ValidUntil is null || until > credential.ValidUntil, "until", "The new end must be later than the current end.");
            }

            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            var previous = credential.ValidUntil!.Value;
            credential.ValidUntil = until;
            if (state.StayFor(id) is { } stay && credential.StayId == stay.Id)
            {
                stay.CheckOut = until;
            }

            var detail = $"{PropertyTime.Format(previous, "MMM d, h:mm tt")} → {PropertyTime.Format(until, "MMM d, h:mm tt")}";
            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                detail += $" · {request.Note.Trim()}";
            }

            state.Audit(AuditCategory.Manual, "Access extended", AuditResult.Success, DemoClock.ManagerName, person, detail: detail);
            return TypedResults.Ok(GetPerson.Project(state, person));
        });
}
