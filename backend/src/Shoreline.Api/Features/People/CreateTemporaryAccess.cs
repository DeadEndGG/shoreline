using Microsoft.AspNetCore.Http.HttpResults;
using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.People;

/// <summary>Manual exception: a visitor or vendor with explicit locations and a bounded window.</summary>
public static class CreateTemporaryAccess
{
    public sealed record Request(
        string? Name,
        PersonType? Type,
        string? Host,
        IReadOnlyList<string>? AccessPointIds,
        string? Start,
        string? End,
        string? Reason);

    public sealed record Response(string PersonId, GetPerson.Response Person);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/people/temporary-access", Handle)
                .WithTags("People")
                .WithName(nameof(CreateTemporaryAccess));
    }

    internal static async Task<Results<Created<Response>, ValidationProblem>> Handle(Request request, DemoStore store, SimulatedLatency latency, CancellationToken ct)
    {
        await latency.WaitAsync(ct, 0.8);
        return store.Write<Results<Created<Response>, ValidationProblem>>(state =>
        {
            var name = request.Name?.Trim() ?? "";
            var host = request.Host?.Trim() ?? "";
            var reason = request.Reason?.Trim() ?? "";
            var pointIds = request.AccessPointIds?.Distinct().ToList() ?? [];
            var hasStart = PropertyTime.TryParseLocal(request.Start, out var start);
            var hasEnd = PropertyTime.TryParseLocal(request.End, out var end);

            var validator = new Validator()
                .Require(name.Length >= 2, "name", "Enter the visitor or company name.")
                .Require(request.Type is PersonType.Visitor or PersonType.Vendor, "type", "Choose visitor or vendor.")
                .Require(host.Length > 0, "host", "Enter the host unit or responsible staff member.")
                .Require(pointIds.Count > 0, "accessPointIds", "Choose at least one permitted location.")
                .Require(pointIds.All(pid => state.FindAccessPoint(pid) is not null), "accessPointIds", "One or more locations are unknown.")
                .Require(hasStart, "start", "Enter a valid start.")
                .Require(hasEnd, "end", "Enter a valid end.")
                .Require(reason.Length >= 3, "reason", "Add a short reason for the audit log.");
            if (hasStart && hasEnd)
            {
                validator
                    .Require(end > start, "end", "The end must be after the start.")
                    .Require(end > state.Now, "end", "The end must be in the future.")
                    .Require(end - start <= TimeSpan.FromDays(14), "end", "Temporary access is limited to 14 days.");
            }

            if (!validator.IsValid)
            {
                return TypedResults.ValidationProblem(validator.Errors);
            }

            var slug = string.Join('-', name.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Select(part => new string(part.Where(char.IsLetterOrDigit).ToArray())).Where(p => p.Length > 0));
            var id = slug.Length == 0 ? "temporary" : slug;
            for (var n = 2; state.FindPerson(id) is not null; n++)
            {
                id = $"{slug}-{n}";
            }

            var isUnit = host.All(char.IsDigit);
            var person = new Person
            {
                Id = id,
                Name = name,
                Type = request.Type!.Value,
                Role = request.Type == PersonType.Vendor ? $"Vendor · {reason}" : isUnit ? $"Guest of Unit {host}" : $"Guest of {host}",
                HostUnit = isUnit ? host : null,
                Email = $"{id.Replace('-', '.')}@example.com",
                Phone = "(850) 555-0199",
                Featured = true,
            };
            state.People.Add(person);

            var random = new DeterministicRandom((uint)state.People.Count * 7919);
            var credential = new Credential
            {
                Id = state.NextId("tmp"),
                PersonId = person.Id,
                Method = CredentialMethod.PinAndQr,
                Pin = random.Next(100000, 1000000).ToString(),
                AccessPointIds = pointIds,
                ValidFrom = start,
                ValidUntil = end,
            };
            credential.MarkProvisioned(state.Now, null);
            state.Credentials.Add(credential);

            var window = $"{PropertyTime.Format(start, "MMM d, h:mm tt")} → {PropertyTime.Format(end, "MMM d, h:mm tt")}";
            state.Audit(AuditCategory.Manual, "Temporary access created", AuditResult.Success, DemoClock.ManagerName, person,
                detail: $"{window} · {pointIds.Count} location{(pointIds.Count == 1 ? "" : "s")} · {reason}");

            return TypedResults.Created($"/api/people/{person.Id}", new Response(person.Id, GetPerson.Project(state, person)));
        });
    }
}
