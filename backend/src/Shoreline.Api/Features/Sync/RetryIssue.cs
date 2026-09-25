using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Sync;

/// <summary>
/// Retries a transient provisioning failure. Invalid data (unmapped units, duplicate
/// reservations) is never "fixed" by retrying — those need their own reviewed action.
/// </summary>
public static class RetryIssue
{
    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/sync/issues/{id}/retry", Handle)
                .WithTags("Sync")
                .WithName(nameof(RetryIssue));
    }

    internal static async Task<Results<Ok<SyncActionResult>, NotFound, ValidationProblem>> Handle(string id, DemoStore store, SimulatedLatency latency, CancellationToken ct)
    {
        await latency.WaitAsync(ct, 1.4);
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

            var retryable = issue.Kind switch
            {
                SyncIssueKind.ProvisioningTimeout or SyncIssueKind.ProvisioningInterrupted => null,
                SyncIssueKind.MissingUnitMapping when state.UnitMappings.ContainsKey(issue.Unit) => null,
                SyncIssueKind.MissingUnitMapping => $"Unit {issue.Unit} still has no access group. Assign one first.",
                _ => "Choose which reservation to keep before provisioning.",
            };
            if (retryable is not null)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["issue"] = [retryable] });
            }

            return TypedResults.Ok(Provisioning.Complete(state, issue, "Provisioning retried successfully"));
        });
    }
}
