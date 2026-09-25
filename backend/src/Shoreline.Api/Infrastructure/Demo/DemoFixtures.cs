using Shoreline.Api.Common;
using Shoreline.Api.Domain;

namespace Shoreline.Api.Infrastructure.Demo;

/// <summary>
/// Deterministic seed data. Every name, unit, and number here is invented demo content.
/// The generator uses its own PRNG so fixtures are identical across runtimes and restarts.
/// </summary>
public static class DemoFixtures
{
    public const int ActiveStayCount = 186;
    public const int DepartedTodayCount = 38;
    public const int ArrivalsTodayCount = 42;

    private static readonly string[] FirstNames =
    [
        "Olivia", "Liam", "Harper", "Noah", "Amelia", "Ethan", "Sofia", "Mason", "Isla", "Lucas", "Chloe", "Owen",
        "Nora", "Caleb", "Grace", "Wyatt", "Hazel", "Julian", "Violet", "Miles", "Aurora", "Rowan", "Stella", "Ezra",
        "Lila", "Silas", "Ruby", "Declan", "Ivy", "Theo", "Maya", "Gavin", "Clara", "Reid", "Eliza", "Beckett", "Naomi",
        "Asher", "Lucy", "Graham", "Wren", "Hudson", "Tessa", "Adrian", "June", "Carter", "Leah", "Parker", "Iris",
        "Bennett", "Sadie", "Dylan", "Margo", "Felix", "Quinn", "Nolan", "Paige", "Emmett", "Vera", "Rhett", "Alma",
    ];

    private static readonly string[] LastNames =
    [
        "Whitaker", "Castillo", "Donovan", "Nguyen", "Holloway", "Patel", "Sinclair", "Brennan", "Okafor", "Lindqvist",
        "Marsh", "Delgado", "Fairbanks", "Kowalski", "Ashford", "Moreau", "Calloway", "Yamada", "Pruitt", "Ramsey",
        "Harlow", "Vance", "Cortez", "Beaumont", "Kline", "Abernathy", "Soto", "Merritt", "Langford", "Tran", "Gallagher",
        "Hendricks", "Oyelaran", "Pierce", "Bishop", "Easton", "Mercer", "Figueroa", "Halvorsen", "Whitfield", "Ashby",
        "Crane", "Novak", "Sterling", "Dunmore", "Quintero", "Rasmussen", "Talbot", "Wexler", "Iverson", "Hayward",
    ];

    private static readonly DateOnly Today = new(2026, 9, 26);
    private static readonly TimeOnly CheckInTime = new(16, 0);
    private static readonly TimeOnly CheckOutTime = new(10, 0);

    public static DemoState Create()
    {
        var state = new DemoState
        {
            Now = DemoClock.Start,
            FeedLastReceivedAt = DemoClock.Start.AddMinutes(-2),
        };

        var ctx = new Context(state);
        SeedAccessPoints(state);
        SeedAccessGroups(state);
        SeedUnitMappings(state);
        SeedPeople(ctx);
        SeedSyncHistory(ctx);
        SeedActivity(ctx);
        return state;
    }

    // ── Access points & groups ────────────────────────────────────────────────

    private static void SeedAccessPoints(DemoState state)
    {
        void Add(string id, string name, string location, AccessPointCategory category, AccessPointKind kind, bool camera) =>
            state.AccessPoints.Add(new AccessPoint
            {
                Id = id, Name = name, Location = location, Category = category, Kind = kind, HasCamera = camera,
            });

        Add("main-lobby", "Main lobby", "Ground floor · North entrance", AccessPointCategory.Building, AccessPointKind.Door, true);
        Add("east-lobby", "East lobby", "Ground floor · East tower", AccessPointCategory.Building, AccessPointKind.Door, true);
        Add("west-lobby", "West lobby", "Ground floor · West tower", AccessPointCategory.Building, AccessPointKind.Door, true);
        Add("parking-entry", "Parking pedestrian entry", "Garage level P1", AccessPointCategory.Building, AccessPointKind.Door, true);
        Add("beach-gate-east", "Beach gate east", "Dune walkover · East", AccessPointCategory.Exterior, AccessPointKind.Gate, true);
        Add("beach-gate-west", "Beach gate west", "Dune walkover · West", AccessPointCategory.Exterior, AccessPointKind.Gate, true);
        Add("pool-gate", "Pool gate", "Pool deck · South", AccessPointCategory.Exterior, AccessPointKind.Gate, true);
        Add("boardwalk-gate", "Boardwalk gate", "Front Beach Road boardwalk", AccessPointCategory.Exterior, AccessPointKind.Gate, true);
        Add("fitness-center", "Fitness center", "Level 2 · Amenity deck", AccessPointCategory.Amenity, AccessPointKind.Room, false);
        Add("owners-lounge", "Owners lounge", "Level 2 · Amenity deck", AccessPointCategory.Amenity, AccessPointKind.Room, false);
        Add("mailroom", "Mailroom", "Ground floor · Main lobby", AccessPointCategory.Amenity, AccessPointKind.Room, false);
        Add("package-room", "Package room", "Ground floor · Main lobby", AccessPointCategory.Amenity, AccessPointKind.Room, true);
        Add("service-entry", "Service entry", "Loading dock · North", AccessPointCategory.Service, AccessPointKind.Door, true);
        Add("staff-entrance", "Staff entrance", "Back of house · West", AccessPointCategory.Service, AccessPointKind.Door, true);
        Add("maintenance-room", "Maintenance room", "Garage level P1", AccessPointCategory.Service, AccessPointKind.Room, false);

        var serviceEntry = state.FindAccessPoint("service-entry")!;
        serviceEntry.Online = false;
        serviceEntry.OfflineSince = DemoClock.Start.AddMinutes(-8);
    }

    private static void SeedAccessGroups(DemoState state)
    {
        string[] lobbies = ["main-lobby", "east-lobby", "west-lobby", "parking-entry"];
        string[] exterior = ["beach-gate-east", "beach-gate-west", "pool-gate", "boardwalk-gate"];

        state.AccessGroups.AddRange(
        [
            new AccessGroup
            {
                Id = "guest-standard", Name = "Guest · Standard stay", AssignableToUnits = true,
                Description = "Lobbies, parking, beach and pool gates, fitness center, package room.",
                AccessPointIds = [.. lobbies, .. exterior, "fitness-center", "package-room"],
            },
            new AccessGroup
            {
                Id = "guest-oceanfront", Name = "Guest · Oceanfront suites", AssignableToUnits = true,
                Description = "Standard stay access plus the owners lounge for premium suites.",
                AccessPointIds = [.. lobbies, .. exterior, "fitness-center", "package-room", "owners-lounge"],
            },
            new AccessGroup
            {
                Id = "owner-full", Name = "Owner · Full amenities",
                Description = "All residential and amenity spaces, including the owners lounge and mailroom.",
                AccessPointIds = [.. lobbies, .. exterior, "fitness-center", "owners-lounge", "mailroom", "package-room"],
            },
            new AccessGroup
            {
                Id = "resident-midterm", Name = "Resident · Lease term",
                Description = "Guest amenities plus mailroom for lease-term residents.",
                AccessPointIds = [.. lobbies, .. exterior, "fitness-center", "mailroom", "package-room"],
            },
            new AccessGroup
            {
                Id = "staff-housekeeping", Name = "Staff · Housekeeping",
                Description = "Back-of-house routes, lobbies and package room during scheduled shifts.",
                AccessPointIds = ["staff-entrance", "service-entry", .. lobbies, "package-room", "pool-gate"],
            },
            new AccessGroup
            {
                Id = "staff-maintenance", Name = "Staff · Maintenance",
                Description = "All common areas and service spaces during scheduled shifts.",
                AccessPointIds = ["staff-entrance", "service-entry", "maintenance-room", .. lobbies, .. exterior, "fitness-center"],
            },
            new AccessGroup
            {
                Id = "vendor-service", Name = "Vendor · Service only",
                Description = "Service entry and maintenance room during the approved window.",
                AccessPointIds = ["service-entry", "maintenance-room"],
            },
            new AccessGroup
            {
                Id = "visitor-day", Name = "Visitor · Day pass",
                Description = "Main lobby and pool gate while accompanied by a host.",
                AccessPointIds = ["main-lobby", "pool-gate"],
            },
        ]);
    }

    private static IEnumerable<string> AllUnits()
    {
        for (var floor = 2; floor <= 14; floor++)
        {
            for (var n = 1; n <= 26; n++)
            {
                yield return $"{floor}{n:D2}";
            }
        }
    }

    private static void SeedUnitMappings(DemoState state)
    {
        foreach (var unit in AllUnits())
        {
            // Unit 1104 was recently renumbered after a renovation and never mapped: the arrival blocker.
            if (unit == "1104")
            {
                continue;
            }

            var number = int.Parse(unit[^2..]);
            state.UnitMappings[unit] = number <= 4 ? "guest-oceanfront" : "guest-standard";
        }
    }

    // ── People ────────────────────────────────────────────────────────────────

    private static void SeedPeople(Context ctx)
    {
        var s = ctx.State;
        var arrivalPrepared = PropertyTime.At(Today, new TimeOnly(12, 2));

        // Hero fixtures -------------------------------------------------------
        var avery = ctx.AddPerson("Avery Morgan", PersonType.StrGuest, "807", featured: true);
        ctx.AddGuestStay(avery, Today, new DateOnly(2026, 10, 3), receivedDaysBefore: 21, eta: new TimeOnly(16, 30), pin: "482915", guests: 3, preparedAt: arrivalPrepared);

        var jordan = ctx.AddPerson("Jordan Ellis", PersonType.StrGuest, "1104", featured: true);
        var jordanStay = ctx.AddGuestStay(jordan, Today, new DateOnly(2026, 9, 30), receivedDaysBefore: 9, eta: new TimeOnly(17, 15), pin: "730641", provisioned: false);
        s.CredentialFor(jordan.Id)!.MarkFailed("No access group is mapped to Unit 1104.");

        var taylor = ctx.AddPerson("Taylor Reed", PersonType.StrGuest, "612", featured: true);
        var taylorStay = ctx.AddGuestStay(taylor, Today, new DateOnly(2026, 10, 1), receivedDaysBefore: 14, eta: new TimeOnly(18, 0), pin: "915372", provisioned: false);
        var taylorCredential = s.CredentialFor(taylor.Id)!;
        taylorCredential.AccessGroupId = s.UnitMappings["612"];
        taylorCredential.MarkFailed("UniFi Access did not confirm the credential within 30 seconds.");

        var casey = ctx.AddPerson("Casey Brooks", PersonType.StrGuest, "905", featured: true);
        var caseyStay = ctx.AddGuestStay(casey, Today, new DateOnly(2026, 9, 30), receivedDaysBefore: 14, eta: new TimeOnly(19, 45), pin: "268054", provisioned: false);

        var morgan = ctx.AddPerson("Morgan Lane", PersonType.Owner, "1201", featured: true);
        ctx.AddCredential(morgan, null, CredentialMethod.KeyCard, "owner-full", PropertyTime.At(2024, 3, 1, 9), null, "551204", PropertyTime.At(2024, 3, 1, 9));

        var elena = ctx.AddPerson("Elena Park", PersonType.MidtermRenter, "304", featured: true);
        var elenaStay = ctx.AddStay(elena, PropertyTime.At(2026, 9, 1, 12), PropertyTime.At(2026, 11, 30, 12), PropertyTime.At(2026, 8, 14, 10), shortTerm: false, source: "Lease agreement");
        ctx.AddCredential(elena, elenaStay, CredentialMethod.PinAndQr, "resident-midterm", elenaStay.CheckIn, elenaStay.CheckOut, "604418", PropertyTime.At(2026, 8, 31, 12));

        var sam = ctx.AddPerson("Sam Rivera", PersonType.Staff, null, featured: true, role: "Housekeeping");
        ctx.AddCredential(sam, null, CredentialMethod.KeyCard, "staff-housekeeping", PropertyTime.At(2025, 5, 12, 8), null, "117630", PropertyTime.At(2025, 5, 12, 8), new DailySchedule(new(8, 0), new(16, 0)));

        var hvac = ctx.AddPerson("Coastal HVAC", PersonType.Vendor, null, featured: true, role: "HVAC service contractor");
        ctx.AddCredential(hvac, null, CredentialMethod.Pin, "vendor-service", PropertyTime.At(2026, 9, 1, 0), PropertyTime.At(2026, 10, 31, 0), "903311", PropertyTime.At(2026, 8, 28, 15), new DailySchedule(new(9, 0), new(12, 0)));

        foreach (var unit in new[] { "807", "1104", "612", "905", "1201", "304", "1008" })
        {
            ctx.ReserveUnit(unit);
        }

        // Issues for the three blocked arrivals ------------------------------
        var firstAttempt = PropertyTime.At(Today, new TimeOnly(12, 1));
        var taylorIssue = new SyncIssue
        {
            Id = "iss-taylor-reed", Kind = SyncIssueKind.ProvisioningTimeout, PersonId = taylor.Id, StayId = taylorStay.Id, Unit = "612",
            Summary = "UniFi Access did not confirm Taylor Reed's credential for Unit 612 in time.",
            NextAction = "Retry provisioning — the reservation and mapping are valid.",
            CreatedAt = firstAttempt,
        };
        taylorIssue.Attempts.Add(new SyncAttempt(firstAttempt, false, "Controller timeout after 30 s"));
        taylorIssue.Attempts.Add(new SyncAttempt(firstAttempt.AddMinutes(15), false, "Automatic retry timed out after 30 s"));
        taylorIssue.Attempts.Add(new SyncAttempt(firstAttempt.AddMinutes(30), false, "Automatic retries paused after 2 attempts"));

        var jordanIssue = new SyncIssue
        {
            Id = "iss-jordan-ellis", Kind = SyncIssueKind.MissingUnitMapping, PersonId = jordan.Id, StayId = jordanStay.Id, Unit = "1104",
            Summary = "Unit 1104 has no assigned access group.",
            NextAction = "Choose the access group guests in Unit 1104 should receive.",
            CreatedAt = firstAttempt,
        };
        jordanIssue.Attempts.Add(new SyncAttempt(firstAttempt, false, "No access group mapped to Unit 1104 — credential not created"));

        var caseyIssue = new SyncIssue
        {
            Id = "iss-casey-brooks", Kind = SyncIssueKind.DuplicateReservation, PersonId = casey.Id, StayId = caseyStay.Id, Unit = "905",
            Summary = "Two overlapping reservations for Casey Brooks in Unit 905.",
            NextAction = "Review both reservations and keep the correct one.",
            CreatedAt = firstAttempt,
            Candidates =
            [
                new ReservationCandidate(caseyStay.ReservationId, caseyStay.CheckIn, caseyStay.CheckOut, 2,
                    caseyStay.ReceivedAt, "Original booking via owner website"),
                new ReservationCandidate("TRK-" + (int.Parse(caseyStay.ReservationId[4..]) + 4817), caseyStay.CheckIn,
                    PropertyTime.At(new DateOnly(2026, 10, 1), CheckOutTime), 3,
                    PropertyTime.At(2026, 9, 25, 21, 14), "Modified booking — one extra night, 3 guests"),
            ],
        };
        caseyIssue.Attempts.Add(new SyncAttempt(firstAttempt, false, "Held for review — duplicate reservation detected"));
        s.SyncIssues.AddRange([taylorIssue, jordanIssue, caseyIssue]);

        // Departed earlier today ---------------------------------------------
        var blake = ctx.AddPerson("Blake Turner", PersonType.StrGuest, ctx.TakeUnit(), featured: true);
        var departedUnits = new List<string> { blake.Unit! };
        ctx.AddGuestStay(blake, new DateOnly(2026, 9, 21), Today, receivedDaysBefore: 30, eta: new TimeOnly(17, 0));
        for (var i = 1; i < DepartedTodayCount; i++)
        {
            var person = ctx.AddPerson(ctx.RandomName(), PersonType.StrGuest, ctx.TakeUnit());
            departedUnits.Add(person.Unit!);
            var checkIn = Today.AddDays(-ctx.Random.Next(3, 8));
            ctx.AddGuestStay(person, checkIn, Today, receivedDaysBefore: ctx.Random.Next(10, 60), eta: ctx.RandomEta());
        }

        // Currently in house ------------------------------------------------
        for (var i = 0; i < ActiveStayCount; i++)
        {
            var person = ctx.AddPerson(ctx.RandomName(), PersonType.StrGuest, ctx.TakeUnit());
            var checkIn = Today.AddDays(-ctx.Random.Next(1, 8));
            var checkOut = Today.AddDays(ctx.Random.Next(1, 9));
            ctx.AddGuestStay(person, checkIn, checkOut, receivedDaysBefore: ctx.Random.Next(7, 90), eta: ctx.RandomEta());
        }

        // Arriving today — most take over units that turned over this morning.
        for (var i = 0; i < ArrivalsTodayCount - 4; i++)
        {
            var unit = i < departedUnits.Count - 1 ? departedUnits[i + 1] : ctx.TakeUnit();
            var person = ctx.AddPerson(ctx.RandomName(), PersonType.StrGuest, unit);
            ctx.AddGuestStay(person, Today, Today.AddDays(ctx.Random.Next(2, 8)), receivedDaysBefore: ctx.Random.Next(5, 60), eta: ctx.RandomEta(), preparedAt: arrivalPrepared.AddSeconds(i));
        }

        // Upcoming arrivals over the following week --------------------------
        int[] upcomingPerDay = [5, 4, 3, 4, 3, 4, 8];
        for (var day = 0; day < upcomingPerDay.Length; day++)
        {
            var arrival = Today.AddDays(day + 1);
            for (var i = 0; i < upcomingPerDay[day]; i++)
            {
                var person = ctx.AddPerson(ctx.RandomName(), PersonType.StrGuest, ctx.TakeUnit());
                ctx.AddGuestStay(person, arrival, arrival.AddDays(ctx.Random.Next(3, 8)), receivedDaysBefore: ctx.Random.Next(3, 45), eta: ctx.RandomEta(), preparedAt: arrivalPrepared.AddMinutes(-ctx.Random.Next(60, 2000)));
            }
        }

        // Owners -------------------------------------------------------------
        for (var i = 0; i < 23; i++)
        {
            var owner = ctx.AddPerson(ctx.RandomName(), PersonType.Owner, ctx.TakeUnit());
            var since = PropertyTime.At(2019 + ctx.Random.Next(0, 7), ctx.Random.Next(1, 13), ctx.Random.Next(1, 28), 9);
            ctx.AddCredential(owner, null, CredentialMethod.KeyCard, "owner-full", since, null, ctx.RandomPin(), since);
        }

        // Mid-term renters ---------------------------------------------------
        for (var i = 0; i < 9; i++)
        {
            var renter = ctx.AddPerson(ctx.RandomName(), PersonType.MidtermRenter, ctx.TakeUnit());
            var start = PropertyTime.At(2026, ctx.Random.Next(7, 10), 1, 12);
            var end = start.AddMonths(ctx.Random.Next(3, 7));
            var stay = ctx.AddStay(renter, start, end, start.AddDays(-20), shortTerm: false, source: "Lease agreement");
            ctx.AddCredential(renter, stay, CredentialMethod.PinAndQr, "resident-midterm", start, end, ctx.RandomPin(), start.AddDays(-1));
        }

        // Staff --------------------------------------------------------------
        (string Name, string Role, string Group, int Start, int End)[] staff =
        [
            ("Priya Raman", "Front desk lead", "staff-housekeeping", 7, 15),
            ("Marcus Webb", "Maintenance technician", "staff-maintenance", 7, 16),
            ("Lena Ortiz", "Housekeeping", "staff-housekeeping", 8, 16),
            ("Andre Coleman", "Night security", "staff-maintenance", 22, 24),
            ("Hollis Grant", "Maintenance supervisor", "staff-maintenance", 6, 15),
            ("Rosa Villanueva", "Housekeeping", "staff-housekeeping", 9, 17),
            ("Tomas Reyes", "Pool attendant", "staff-housekeeping", 10, 18),
        ];
        foreach (var member in staff)
        {
            var person = ctx.AddPerson(member.Name, PersonType.Staff, null, role: member.Role);
            var since = PropertyTime.At(2025, ctx.Random.Next(1, 13), ctx.Random.Next(1, 28), 8);
            var end = member.End == 24 ? new TimeOnly(23, 59) : new TimeOnly(member.End, 0);
            ctx.AddCredential(person, null, CredentialMethod.KeyCard, member.Group, since, null, ctx.RandomPin(), since, new DailySchedule(new TimeOnly(member.Start, 0), end));
        }

        // Vendors ------------------------------------------------------------
        (string Name, string Role, int Start, int End)[] vendors =
        [
            ("Gulfside Pool Care", "Pool maintenance", 7, 10),
            ("Emerald Coast Elevator", "Elevator inspection", 9, 15),
            ("Bayline Pest Control", "Quarterly pest service", 8, 11),
            ("Sandpiper Linen Co.", "Linen delivery", 6, 9),
        ];
        foreach (var vendor in vendors)
        {
            var person = ctx.AddPerson(vendor.Name, PersonType.Vendor, null, role: vendor.Role);
            ctx.AddCredential(person, null, CredentialMethod.Pin, "vendor-service", PropertyTime.At(2026, 9, 1, 0), PropertyTime.At(2026, 12, 31, 0), ctx.RandomPin(), PropertyTime.At(2026, 8, 30, 10), new DailySchedule(new TimeOnly(vendor.Start, 0), new TimeOnly(vendor.End, 0)));
        }

        // Visitors -----------------------------------------------------------
        (string Name, string Host, int Start, int End)[] visitors =
        [
            ("Dana Whitfield", "1201", 14, 19),
            ("Chris Albright", "304", 11, 17),
        ];
        foreach (var visitor in visitors)
        {
            var person = ctx.AddPerson(visitor.Name, PersonType.Visitor, null, role: $"Guest of Unit {visitor.Host}", hostUnit: visitor.Host);
            ctx.AddCredential(person, null, CredentialMethod.PinAndQr, "visitor-day", PropertyTime.At(Today, new TimeOnly(visitor.Start, 0)), PropertyTime.At(Today, new TimeOnly(visitor.End, 0)), ctx.RandomPin(), PropertyTime.At(Today, new TimeOnly(visitor.Start - 1, 30)));
        }
    }

    // ── Sync history ──────────────────────────────────────────────────────────

    private static void SeedSyncHistory(Context ctx)
    {
        var s = ctx.State;
        var received = s.Stays.Count(st => st.IsShortTerm);
        var first = PropertyTime.At(Today, new TimeOnly(12, 0));
        for (var run = first; run < DemoClock.Start; run = run.AddMinutes(15))
        {
            var isFirst = run == first;
            var updated = isFirst ? 6 : ctx.Random.Next(0, 3);
            var created = isFirst ? ArrivalsTodayCount - 3 : 0;
            s.SyncRuns.Add(new SyncRun
            {
                Id = s.NextId("run"),
                StartedAt = run,
                Trigger = SyncTrigger.Scheduled,
                Received = received,
                Created = created,
                Updated = updated,
                Failed = 3,
                Unchanged = received - created - updated - 3,
                DurationMs = 2100 + ctx.Random.Next(0, 1800) + (isFirst ? 34000 : 0),
                Result = SyncRunResult.CompletedWithIssues,
                Note = isFirst ? "Prepared credentials for today's 4:00 PM check-in" : null,
            });
        }

        var morning = PropertyTime.At(Today, new TimeOnly(6, 0));
        s.SyncRuns.Insert(0, new SyncRun
        {
            Id = "run-0000",
            StartedAt = morning,
            Trigger = SyncTrigger.Scheduled,
            Received = received,
            Created = 0,
            Updated = 11,
            Unchanged = received - 11,
            Failed = 0,
            DurationMs = 2480,
            Result = SyncRunResult.Succeeded,
            Note = "Overnight changes applied",
        });
    }

    // ── Activity ──────────────────────────────────────────────────────────────

    private static void SeedActivity(Context ctx)
    {
        var s = ctx.State;
        DateTimeOffset T(int h, int m) => PropertyTime.At(Today, new TimeOnly(h, m));
        Person P(string id) => s.FindPerson(id)!;
        AccessPoint A(string id) => s.FindAccessPoint(id)!;

        // Yesterday evening, for depth.
        var yesterday = Today.AddDays(-1);
        s.Audit(AuditCategory.Sync, "Sync run completed", AuditResult.Success, "Track feed", detail: "No changes", at: PropertyTime.At(yesterday, new TimeOnly(21, 0)));
        s.Audit(AuditCategory.Credential, "Reservation modified", AuditResult.Info, "Track feed", P("casey-brooks"), detail: "Second reservation received for Unit 905 (3 guests, +1 night)", at: PropertyTime.At(yesterday, new TimeOnly(21, 14)));

        s.Audit(AuditCategory.Sync, "Sync run completed", AuditResult.Success, "Track feed", detail: "11 overnight changes applied", at: T(6, 0));

        // Deterministic background access traffic.
        var inHouse = s.Stays
            .Where(st => st.IsShortTerm && st.CheckIn < DemoClock.Start && st.CheckOut > DemoClock.Start)
            .Select(st => st.PersonId)
            .ToList();
        var departed = s.Stays
            .Where(st => st.IsShortTerm && PropertyTime.DateOf(st.CheckOut) == Today)
            .Select(st => st.PersonId)
            .ToList();
        for (var i = 0; i < 46; i++)
        {
            var minute = 6 * 60 + 40 + ctx.Random.Next(0, 9 * 60);
            var at = T(minute / 60, minute % 60);
            var pool = at < T(10, 0) && i % 3 == 0 ? departed : inHouse;
            var person = P(pool[ctx.Random.Next(0, pool.Count)]);
            var credential = s.CredentialFor(person.Id)!;
            var points = s.AccessPointsFor(credential).Where(a => a.Online || a.OfflineSince > at).ToList();
            var point = points[ctx.Random.Next(0, points.Count)];
            s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", person, point, "PIN", at);
        }

        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("elena-park"), A("fitness-center"), "Mobile QR", T(7, 12));
        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("sam-rivera"), A("staff-entrance"), "Key card · on shift", T(7, 56));
        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("coastal-hvac"), A("service-entry"), "PIN · within 9:00 AM–12:00 PM window", T(9, 4));
        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("coastal-hvac"), A("maintenance-room"), "PIN", T(9, 11));

        s.Audit(AuditCategory.Credential, "Credential expired", AuditResult.Info, "Shoreline Access",
            detail: $"{DepartedTodayCount} guest credentials ended at 10:00 AM checkout", at: T(10, 0));
        s.Audit(AuditCategory.Credential, "Credential expired", AuditResult.Info, "Shoreline Access", P("blake-turner"),
            detail: "Stay ended at 10:00 AM checkout", at: T(10, 0));
        s.Audit(AuditCategory.Access, "Access denied", AuditResult.Denied, "UniFi Access", P("blake-turner"), A("beach-gate-east"),
            "Credential expired at 10:00 AM checkout", T(11, 12));

        s.Audit(AuditCategory.Sync, "Sync run completed with issues", AuditResult.Warning, "Track feed", detail: "39 credentials prepared · 3 need attention", at: T(12, 0));
        s.Audit(AuditCategory.Credential, "Credential prepared", AuditResult.Success, "Shoreline Access", P("avery-morgan"),
            detail: "Scheduled for Sep 26, 4:00 PM → Oct 3, 10:00 AM", at: T(12, 2));
        s.Audit(AuditCategory.Credential, "Credentials prepared", AuditResult.Success, "Shoreline Access",
            detail: $"{ArrivalsTodayCount - 4} more arrival credentials scheduled for 4:00 PM", at: T(12, 2));
        s.Audit(AuditCategory.Sync, "Exception created", AuditResult.Warning, "Shoreline Access", P("taylor-reed"), detail: "Provisioning timed out", at: T(12, 1));
        s.Audit(AuditCategory.Sync, "Exception created", AuditResult.Warning, "Shoreline Access", P("jordan-ellis"), detail: "Unit 1104 has no assigned access group", at: T(12, 1));
        s.Audit(AuditCategory.Sync, "Exception created", AuditResult.Warning, "Shoreline Access", P("casey-brooks"), detail: "Duplicate reservation held for review", at: T(12, 1));

        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("dana-whitfield"), A("main-lobby"), "Visitor QR · host Unit 1201", T(14, 6));
        s.Audit(AuditCategory.Access, "Access granted", AuditResult.Success, "UniFi Access", P("morgan-lane"), A("owners-lounge"), "Key card", T(14, 20));
        s.Audit(AuditCategory.Access, "Access point offline", AuditResult.Warning, "UniFi Access", accessPoint: A("service-entry"),
            detail: "Controller lost contact with the service entry reader", at: T(15, 37));
        s.Audit(AuditCategory.Sync, "Reservation feed received", AuditResult.Success, "Track feed", detail: "No changes", at: T(15, 43));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private sealed class Context(DemoState state)
    {
        private readonly HashSet<string> _names = [];
        private readonly HashSet<string> _pins = [];
        private readonly Queue<string> _units = new(Shuffle(AllUnits().ToList(), new DeterministicRandom(19)));
        private readonly HashSet<string> _reserved = [];

        public DemoState State { get; } = state;
        public DeterministicRandom Random { get; } = new(2026);

        public void ReserveUnit(string unit) => _reserved.Add(unit);

        public string TakeUnit()
        {
            string unit;
            do
            {
                unit = _units.Dequeue();
            }
            while (_reserved.Contains(unit));

            _reserved.Add(unit);
            return unit;
        }

        public string RandomName()
        {
            while (true)
            {
                var name = $"{FirstNames[Random.Next(0, FirstNames.Length)]} {LastNames[Random.Next(0, LastNames.Length)]}";
                if (_names.Add(name))
                {
                    return name;
                }
            }
        }

        public string RandomPin()
        {
            while (true)
            {
                var pin = Random.Next(100000, 1000000).ToString();
                if (_pins.Add(pin))
                {
                    return pin;
                }
            }
        }

        public TimeOnly RandomEta() => new TimeOnly(16, 0).AddMinutes(Random.Next(0, 19) * 15);

        public Person AddPerson(string name, PersonType type, string? unit, bool featured = false, string? role = null, string? hostUnit = null)
        {
            _names.Add(name);
            var slug = Slug(name);
            var id = slug;
            for (var n = 2; State.FindPerson(id) is not null; n++)
            {
                id = $"{slug}-{n}";
            }

            var emailLocal = slug.Replace('-', '.');
            var person = new Person
            {
                Id = id,
                Name = name,
                Type = type,
                Unit = unit,
                Role = role,
                HostUnit = hostUnit,
                Email = $"{emailLocal}@example.com",
                Phone = $"(850) 555-{Random.Next(100, 200):D4}",
                Featured = featured,
            };
            State.People.Add(person);
            return person;
        }

        public Stay AddStay(Person person, DateTimeOffset checkIn, DateTimeOffset checkOut, DateTimeOffset receivedAt, bool shortTerm = true, string? source = null, TimeOnly? eta = null, int guests = 2)
        {
            var stay = new Stay
            {
                Id = State.NextId("stay"),
                PersonId = person.Id,
                ReservationId = $"TRK-{Random.Next(400000, 900000)}",
                Unit = person.Unit!,
                CheckIn = checkIn,
                CheckOut = checkOut,
                ReceivedAt = receivedAt,
                IsShortTerm = shortTerm,
                Source = source ?? "Track Hospitality",
                ExpectedArrival = eta is { } t ? PropertyTime.At(PropertyTime.DateOf(checkIn), t) : null,
                Guests = guests,
            };
            State.Stays.Add(stay);
            return stay;
        }

        public Stay AddGuestStay(Person person, DateOnly checkIn, DateOnly checkOut, int receivedDaysBefore, TimeOnly eta, string? pin = null, bool provisioned = true, int? guests = null, DateTimeOffset? preparedAt = null)
        {
            var from = PropertyTime.At(checkIn, CheckInTime);
            var until = PropertyTime.At(checkOut, CheckOutTime);
            var stay = AddStay(person, from, until, from.AddDays(-receivedDaysBefore), eta: eta, guests: guests ?? Random.Next(1, 6));
            var group = State.UnitMappings.GetValueOrDefault(person.Unit!);
            var credential = AddCredential(person, stay, CredentialMethod.PinAndQr, group, from, until, pin ?? RandomPin(), provisioned ? preparedAt ?? from.AddHours(-4) : null);
            if (!provisioned)
            {
                credential.AccessGroupId = null;
            }

            return stay;
        }

        public Credential AddCredential(Person person, Stay? stay, CredentialMethod method, string? groupId, DateTimeOffset from, DateTimeOffset? until, string pin, DateTimeOffset? preparedAt, DailySchedule? schedule = null)
        {
            _pins.Add(pin);
            var credential = new Credential
            {
                Id = State.NextId("cred"),
                PersonId = person.Id,
                StayId = stay?.Id,
                Method = method,
                Pin = pin,
                AccessGroupId = groupId,
                ValidFrom = from,
                ValidUntil = until,
                Schedule = schedule,
            };
            if (preparedAt is { } at && groupId is not null)
            {
                credential.MarkProvisioned(at, groupId);
            }

            State.Credentials.Add(credential);
            return credential;
        }
    }

    private static string Slug(string name) =>
        new string(name.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray())
            .Replace("--", "-")
            .Trim('-');

    private static List<T> Shuffle<T>(List<T> items, DeterministicRandom random)
    {
        for (var i = items.Count - 1; i > 0; i--)
        {
            var j = random.Next(0, i + 1);
            (items[i], items[j]) = (items[j], items[i]);
        }

        return items;
    }
}

/// <summary>Mulberry32 — tiny, fast and stable across .NET versions (unlike System.Random seeding).</summary>
public sealed class DeterministicRandom(uint seed)
{
    private uint _state = seed;

    public int Next(int minInclusive, int maxExclusive)
    {
        _state += 0x6D2B79F5;
        var t = _state;
        t = (t ^ (t >> 15)) * (t | 1);
        t ^= t + ((t ^ (t >> 7)) * (t | 61));
        var value = (t ^ (t >> 14)) / 4294967296.0;
        return minInclusive + (int)(value * (maxExclusive - minInclusive));
    }
}
