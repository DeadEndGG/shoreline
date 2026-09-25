using Shoreline.Api.Domain;

namespace Shoreline.Api.Infrastructure.Demo;

/// <summary>
/// The entire in-memory "database" for the demo. There is no persistence: restarting the
/// API or calling the reset endpoint restores the deterministic fixtures.
/// Only <see cref="DemoStore"/> hands this out, always under its lock.
/// </summary>
public sealed class DemoState
{
    private long _sequence;
    private readonly Dictionary<string, int> _idCounters = new();

    public required DateTimeOffset Now { get; set; }
    public DemoScenario Scenario { get; set; } = DemoScenario.Normal;
    public required DateTimeOffset FeedLastReceivedAt { get; set; }

    public List<Person> People { get; } = [];
    public List<Stay> Stays { get; } = [];
    public List<Credential> Credentials { get; } = [];
    public List<AccessGroup> AccessGroups { get; } = [];
    public List<AccessPoint> AccessPoints { get; } = [];
    public List<SyncRun> SyncRuns { get; } = [];
    public List<SyncIssue> SyncIssues { get; } = [];
    public List<AuditEvent> AuditEvents { get; } = [];

    /// <summary>Guest unit → access group. A missing entry is a mapping gap.</summary>
    public Dictionary<string, string> UnitMappings { get; } = new();

    /// <summary>Last simulated guest-message resend per person.</summary>
    public Dictionary<string, DateTimeOffset> MessagesResent { get; } = new();

    public string NextId(string prefix)
    {
        _idCounters.TryGetValue(prefix, out var current);
        _idCounters[prefix] = ++current;
        return $"{prefix}-{current:D4}";
    }

    public Person? FindPerson(string id) => People.Find(p => p.Id == id);

    public Stay? StayFor(string personId) => Stays.Find(s => s.PersonId == personId);

    public Credential? CredentialFor(string personId) => Credentials.Find(c => c.PersonId == personId);

    public AccessPoint? FindAccessPoint(string id) => AccessPoints.Find(a => a.Id == id);

    public AccessGroup? FindGroup(string? id) => id is null ? null : AccessGroups.Find(g => g.Id == id);

    public IEnumerable<AccessPoint> AccessPointsFor(Credential credential)
    {
        var ids = credential.AccessPointIds ?? FindGroup(credential.AccessGroupId)?.AccessPointIds ?? [];
        return AccessPoints.Where(a => ids.Contains(a.Id));
    }

    public string? GroupNameFor(Credential credential) =>
        credential.AccessPointIds is not null ? "Temporary access" : FindGroup(credential.AccessGroupId)?.Name;

    public SyncIssue? OpenIssueFor(string personId) =>
        SyncIssues.Find(i => i.PersonId == personId && !i.IsResolved);

    public AuditEvent Audit(
        AuditCategory category,
        string title,
        AuditResult result,
        string source,
        Person? person = null,
        AccessPoint? accessPoint = null,
        string? detail = null,
        DateTimeOffset? at = null)
    {
        var entry = new AuditEvent
        {
            Id = NextId("evt"),
            At = at ?? Now,
            Category = category,
            Title = title,
            Detail = detail,
            PersonId = person?.Id,
            PersonName = person?.Name,
            Unit = person?.Unit ?? person?.HostUnit,
            AccessPointId = accessPoint?.Id,
            AccessPointName = accessPoint?.Name,
            Source = source,
            Result = result,
            Sequence = ++_sequence,
        };
        AuditEvents.Add(entry);
        return entry;
    }

    /// <summary>Newest first, stable for identical timestamps.</summary>
    public IEnumerable<AuditEvent> AuditTimeline() =>
        AuditEvents.OrderByDescending(e => e.At).ThenByDescending(e => e.Sequence);
}
