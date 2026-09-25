using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>Immediate, permanent revocation. Advancing the clock never reactivates it.</summary>
public static class RevokeAccess
{
    public sealed record Request(string? Reason);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/people/{id}/revoke", Handle)
                .WithTags("People")
                .WithName(nameof(RevokeAccess));
    }

    internal static Results<Ok<GetPerson.Response>, NotFound, ValidationProblem> Handle(string id, Request request, DemoStore store) =>
        store.Write<Results<Ok<GetPerson.Response>, NotFound, ValidationProblem>>(state =>
        {
            if (state.FindPerson(id) is not { } person || state.CredentialFor(id) is not { } credential)
            {
                return TypedResults.NotFound();
            }

            var status = AccessRules.StatusOf(credential, state.StayFor(id), state.Now);
            var reason = request.Reason?.Trim() ?? "";
            var validator = new Validator()
                .Require(reason.Length >= 3, "reason", "Add a short reason for the audit log.")
                .Require(status is not (CredentialStatus.Revoked or CredentialStatus.Expired), "reason", $"Access is already {status.ToString().ToLowerInvariant()}.");
            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            credential.Revoke(state.Now, reason);
            if (state.OpenIssueFor(id) is { } issue)
            {
                issue.Resolve(state.Now, "Access revoked by manager");
            }

            state.Audit(AuditCategory.Manual, "Access revoked", AuditResult.Warning, DemoClock.ManagerName, person, detail: reason);
            return TypedResults.Ok(GetPerson.Project(state, person));
        });
}
