using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>Simulated resend: records an audit entry, never contacts anyone.</summary>
public static class ResendMessage
{
    public enum Channel { Email, Sms }

    public sealed record Request(Channel Channel);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/people/{id}/message/resend", Handle)
                .WithTags("People")
                .WithName(nameof(ResendMessage));
    }

    internal static async Task<Results<Ok<GetMessagePreview.Response>, NotFound, ValidationProblem>> Handle(
        string id, Request request, DemoStore store, SimulatedLatency latency, CancellationToken ct)
    {
        await latency.WaitAsync(ct, 0.6);
        return store.Write<Results<Ok<GetMessagePreview.Response>, NotFound, ValidationProblem>>(state =>
        {
            if (state.FindPerson(id) is not { } person || state.CredentialFor(id) is not { } credential)
            {
                return TypedResults.NotFound();
            }

            var preview = GetMessagePreview.Project(state, person, credential);
            if (!preview.CanResend)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["channel"] = [preview.ResendDisabledReason!] });
            }

            state.MessagesResent[id] = state.Now;
            var target = request.Channel == Channel.Email ? person.Email : person.Phone;
            state.Audit(AuditCategory.Manual, "Guest message resent (simulated)", AuditResult.Info, DemoClock.ManagerName, person,
                detail: $"{(request.Channel == Channel.Email ? "Email" : "SMS")} to {target} · not actually sent");
            return TypedResults.Ok(GetMessagePreview.Project(state, person, credential));
        });
    }
}
