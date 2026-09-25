using Microsoft.Extensions.DependencyInjection;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Tests;

/// <summary>End-to-end checks of the three-minute demo script against the HTTP API.</summary>
public class DemoStoryTests
{
    [Fact]
    public async Task Baseline_numbers_are_derived_from_records()
    {
        await using var app = new ShorelineApp();
        var overview = await app.GetJson("/overview");

        Assert.Equal(186, (int)overview["metrics"]!["activeGuestStays"]!);
        Assert.Equal(42, (int)overview["metrics"]!["arrivalsToday"]!);
        Assert.Equal(38, (int)overview["metrics"]!["departuresToday"]!);
        Assert.Equal(3, (int)overview["metrics"]!["needsAttention"]!);
        Assert.Equal(39, (int)overview["readiness"]!["ready"]!);
        Assert.Equal(42, (int)overview["readiness"]!["total"]!);
        Assert.Equal(14, (int)overview["health"]!["accessPointsOnline"]!);

        var directory = await app.GetJson("/people?segment=activeStays");
        Assert.Equal(186, (int)directory["matching"]!);

        var arrivals = await app.GetJson("/overview/stays?view=arrivals&take=100");
        Assert.Equal(42, (int)arrivals["total"]!);
    }

    [Fact]
    public async Task Unit_807_goes_scheduled_active_expired_at_exact_boundaries()
    {
        await using var app = new ShorelineApp();

        var pass = await app.GetJson("/guest-pass/avery-morgan");
        Assert.Equal("ready", (string)pass["state"]!);
        Assert.Equal("Your access begins Saturday at 4:00 PM and ends the following Saturday at 10:00 AM.", (string)pass["note"]!);

        await app.AdvanceTo("checkIn");
        pass = await app.GetJson("/guest-pass/avery-morgan");
        Assert.Equal("active", (string)pass["state"]!);
        Assert.Equal("2026-09-26T16:00:00-05:00", (string)pass["now"]!);

        await app.AdvanceTo("checkout");
        pass = await app.GetJson("/guest-pass/avery-morgan");
        Assert.Equal("ended", (string)pass["state"]!);
        Assert.Null(pass["pin"]);
        Assert.Null(pass["qrPayload"]);

        var activity = await app.GetJson("/activity?q=Avery%20Morgan");
        Assert.Contains(activity["items"]!.AsArray(), i => (string)i!["event"]!["title"]! == "Credential expired");
    }

    [Fact]
    public async Task Fixing_one_arrival_moves_readiness_to_40_of_42_everywhere()
    {
        await using var app = new ShorelineApp();

        var (status, result) = await app.Post("/sync/issues/iss-taylor-reed/retry");
        Assert.Equal(200, status);
        Assert.Equal("succeeded", (string)result!["outcome"]!);

        var overview = await app.GetJson("/overview");
        Assert.Equal(40, (int)overview["readiness"]!["ready"]!);
        Assert.Equal(2, (int)overview["metrics"]!["needsAttention"]!);

        var sync = await app.GetJson("/sync");
        Assert.Equal(2, (int)sync["stats"]!["unresolvedFailures"]!);

        var taylor = await app.GetJson("/people/taylor-reed");
        Assert.Equal("scheduled", (string)taylor["summary"]!["status"]!);
    }

    [Fact]
    public async Task Retrying_a_completed_operation_does_not_duplicate_credentials()
    {
        await using var app = new ShorelineApp();
        var store = app.Services.GetRequiredService<DemoStore>();
        var before = store.Read(s => (People: s.People.Count, Credentials: s.Credentials.Count));

        await app.Post("/sync/issues/iss-taylor-reed/retry");
        var (_, second) = await app.Post("/sync/issues/iss-taylor-reed/retry");
        await app.Post("/sync/runs");

        Assert.Equal("alreadyResolved", (string)second!["outcome"]!);
        var after = store.Read(s => (People: s.People.Count, Credentials: s.Credentials.Count));
        Assert.Equal(before, after);
        Assert.Equal(1, store.Read(s => s.CredentialFor("taylor-reed")!.ControllerWrites));
    }

    [Fact]
    public async Task Invalid_data_is_not_fixed_by_a_magic_retry()
    {
        await using var app = new ShorelineApp();

        var (mappingStatus, _) = await app.Post("/sync/issues/iss-jordan-ellis/retry");
        var (duplicateStatus, _) = await app.Post("/sync/issues/iss-casey-brooks/retry");
        Assert.Equal(400, mappingStatus);
        Assert.Equal(400, duplicateStatus);

        var (mapStatus, mapped) = await app.Post("/sync/issues/iss-jordan-ellis/map-unit", new { accessGroupId = "guest-standard" });
        Assert.Equal(200, mapStatus);
        Assert.Equal("succeeded", (string)mapped!["outcome"]!);

        var sync = await app.GetJson("/sync");
        var casey = sync["issues"]!.AsArray().Single(i => (string)i!["id"]! == "iss-casey-brooks")!;
        var keep = (string)casey["candidates"]![1]!["reservationId"]!;
        var (chooseStatus, _) = await app.Post("/sync/issues/iss-casey-brooks/choose-reservation", new { reservationId = keep });
        Assert.Equal(200, chooseStatus);

        var person = await app.GetJson("/people/casey-brooks");
        Assert.Equal(keep, (string)person["stay"]!["reservationId"]!);
        Assert.Equal("2026-10-01T10:00:00-05:00", (string)person["credential"]!["validUntil"]!);

        var overview = await app.GetJson("/overview");
        Assert.Equal(41, (int)overview["readiness"]!["ready"]!);
    }

    [Fact]
    public async Task Revoked_access_stays_revoked_when_the_clock_advances()
    {
        await using var app = new ShorelineApp();

        var (missingReason, _) = await app.Post("/people/avery-morgan/revoke", new { reason = "" });
        Assert.Equal(400, missingReason);

        var (status, _) = await app.Post("/people/avery-morgan/revoke", new { reason = "Reservation cancelled by owner" });
        Assert.Equal(200, status);

        await app.AdvanceTo("checkIn");
        var pass = await app.GetJson("/guest-pass/avery-morgan");
        Assert.Equal("revoked", (string)pass["state"]!);
        Assert.Null(pass["pin"]);

        var overview = await app.GetJson("/overview");
        Assert.Equal(38, (int)overview["readiness"]!["ready"]!);
    }

    [Fact]
    public async Task Failed_provisioning_never_renders_an_active_pass()
    {
        await using var app = new ShorelineApp();
        await app.AdvanceTo("checkIn");

        var pass = await app.GetJson("/guest-pass/jordan-ellis");
        Assert.Equal("pending", (string)pass["state"]!);
        Assert.Null(pass["pin"]);
        Assert.Null(pass["qrPayload"]);
    }

    [Fact]
    public async Task Extending_access_validates_and_updates_the_stay()
    {
        await using var app = new ShorelineApp();

        var (early, _) = await app.Post("/people/avery-morgan/extend", new { until = "2026-10-02T10:00" });
        Assert.Equal(400, early);

        var (ok, person) = await app.Post("/people/avery-morgan/extend", new { until = "2026-10-04T10:00" });
        Assert.Equal(200, ok);
        Assert.Equal("2026-10-04T10:00:00-05:00", (string)person!["stay"]!["checkOut"]!);

        await app.AdvanceTo("checkout");
        var pass = await app.GetJson("/guest-pass/avery-morgan");
        Assert.Equal("active", (string)pass["state"]!);
    }

    [Fact]
    public async Task Temporary_access_validates_window_and_locations()
    {
        await using var app = new ShorelineApp();

        var (bad, problem) = await app.Post("/people/temporary-access", new
        {
            name = "Harbor Glass", type = "vendor", host = "Maintenance", accessPointIds = Array.Empty<string>(),
            start = "2026-09-26T17:00", end = "2026-09-26T16:00", reason = "Window repair",
        });
        Assert.Equal(400, bad);
        Assert.NotNull(problem!["errors"]!["end"]);
        Assert.NotNull(problem["errors"]!["accessPointIds"]);

        var (created, body) = await app.Post("/people/temporary-access", new
        {
            name = "Harbor Glass", type = "vendor", host = "Maintenance", accessPointIds = new[] { "service-entry" },
            start = "2026-09-26T16:00", end = "2026-09-26T18:00", reason = "Window repair",
        });
        Assert.Equal(201, created);
        Assert.Equal("scheduled", (string)body!["person"]!["summary"]!["status"]!);

        var vendors = await app.GetJson("/people?type=vendor&q=Harbor");
        Assert.Equal(1, (int)vendors["matching"]!);

        var activity = await app.GetJson("/activity?category=manual");
        Assert.Equal("Temporary access created", (string)activity["items"]![0]!["event"]!["title"]!);
    }

    [Fact]
    public async Task Interrupted_provisioning_keeps_the_reservation_pending_until_retried()
    {
        await using var app = new ShorelineApp();
        await app.Send(HttpMethod.Put, "/sync/scenario", new { scenario = "provisioningInterrupted" });

        var (_, failed) = await app.Post("/sync/issues/iss-riley-chen/retry");
        Assert.Equal("failed", (string)failed!["outcome"]!);
        Assert.Equal("pending", (string)(await app.GetJson("/guest-pass/riley-chen"))["state"]!);

        await app.Send(HttpMethod.Put, "/sync/scenario", new { scenario = "normal" });
        var (_, ok) = await app.Post("/sync/issues/iss-riley-chen/retry");
        Assert.Equal("succeeded", (string)ok!["outcome"]!);
        Assert.Equal("ready", (string)(await app.GetJson("/guest-pass/riley-chen"))["state"]!);
    }

    [Fact]
    public async Task Feed_outage_flags_upcoming_arrivals_and_recovers()
    {
        await using var app = new ShorelineApp();
        await app.Send(HttpMethod.Put, "/sync/scenario", new { scenario = "feedUnavailable" });

        var overview = await app.GetJson("/overview");
        Assert.True((bool)overview["health"]!["feedStale"]!);
        Assert.True((int)overview["health"]!["upcomingArrivalsAffected"]! > 0);

        var (_, run) = await app.Post("/sync/runs");
        Assert.Equal("failed", (string)run!["outcome"]!);

        await app.Send(HttpMethod.Put, "/sync/scenario", new { scenario = "normal" });
        overview = await app.GetJson("/overview");
        Assert.False((bool)overview["health"]!["feedStale"]!);
    }

    [Fact]
    public async Task Reset_restores_the_original_clock_and_records()
    {
        await using var app = new ShorelineApp();
        await app.Post("/sync/issues/iss-taylor-reed/retry");
        await app.AdvanceTo("checkout");

        await app.Post("/demo/reset");

        var overview = await app.GetJson("/overview");
        Assert.Equal("2026-09-26T15:45:00-05:00", (string)overview["now"]!);
        Assert.Equal(39, (int)overview["readiness"]!["ready"]!);
    }
}
