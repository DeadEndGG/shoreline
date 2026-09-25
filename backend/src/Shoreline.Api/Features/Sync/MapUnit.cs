using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>Resolves a missing unit mapping by assigning an access group, then provisions.</summary>
public static class MapUnit
{
    public sealed record Request(string? AccessGroupId);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/sync/issues/{id}/map-unit", Handle)
                .WithTags("Sync")
                .WithName(nameof(MapUnit));
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

            var group = state.FindGroup(request.AccessGroupId);
            var validator = new Validator()
                .Require(issue.Kind == SyncIssueKind.MissingUnitMapping, "accessGroupId", "This issue isn't a unit mapping problem.")
                .Require(group is { AssignableToUnits: true }, "accessGroupId", "Choose a guest access group.");
            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            var person = state.FindPerson(issue.PersonId)!;
            state.UnitMappings[issue.Unit] = group!.Id;
            state.CredentialFor(person.Id)!.AccessGroupId = group.Id;
            state.Audit(AuditCategory.Manual, "Unit mapping assigned", AuditResult.Success, DemoClock.ManagerName, person,
                detail: $"Unit {issue.Unit} → {group.Name}");

            return TypedResults.Ok(Provisioning.Complete(state, issue, $"Unit {issue.Unit} mapped to {group.Name}"));
        });
    }
}
