using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Demo;

public static class GetDemoState
{
    public sealed record Response(
        DateTimeOffset Now,
        string TimeZone,
        string ZoneAbbreviation,
        DemoScenario Scenario,
        ClockStep CheckIn,
        ClockStep Checkout,
        Manager Manager,
        Property Property);

    public sealed record ClockStep(DateTimeOffset At, bool Available, string? UnavailableReason);

    public sealed record Manager(string Name, string Role, string Initials);

    public sealed record Property(string Name, string City, int Units, int Floors, int AccessPoints);

    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapGet("/demo", (DemoStore store) => TypedResults.Ok(store.Read(Project)))
                .WithTags("Demo")
                .WithName(nameof(GetDemoState));
    }

    internal static Response Project(DemoState state)
    {
        var checkInPassed = state.Now >= DemoClock.CheckIn;
        var checkoutPassed = state.Now >= DemoClock.Checkout;
        return new Response(
            state.Now,
            PropertyTime.TimeZoneId,
            PropertyTime.ZoneAbbreviation(state.Now),
            state.Scenario,
            new ClockStep(DemoClock.CheckIn, !checkInPassed, checkInPassed ? "The demo clock is already past 4:00 PM check-in." : null),
            new ClockStep(DemoClock.Checkout, !checkoutPassed, checkoutPassed ? "The demo clock is already at checkout. Reset to replay." : null),
            new Manager(DemoClock.ManagerName, DemoClock.ManagerRole, "MH"),
            new Property("Shoreline Residences", "Panama City Beach", 340, 14, state.AccessPoints.Count));
    }
}
