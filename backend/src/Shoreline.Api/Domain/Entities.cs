namespace Shoreline.Api.Domain;

public sealed class Person
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required PersonType Type { get; init; }
    public string? Unit { get; set; }
    public string? Role { get; init; }
    public string? HostUnit { get; init; }
    public required string Email { get; init; }
    public required string Phone { get; init; }
    /// <summary>Hero fixtures get individual audit entries; generated records are summarised.</summary>
    public bool Featured { get; init; }

    public string Initials
    {
        get
        {
            var parts = Name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length switch
            {
                0 => "?",
                1 => parts[0][..1].ToUpperInvariant(),
                _ => $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[^1][0])}",
            };
        }
    }

    public string FirstName => Name.Split(' ')[0];
}

public sealed class Stay
{
    public required string Id { get; init; }
    public required string PersonId { get; init; }
    public required string ReservationId { get; set; }
    public string Source { get; init; } = "Track Hospitality";
    public required string Unit { get; init; }
    public required DateTimeOffset CheckIn { get; set; }
    public required DateTimeOffset CheckOut { get; set; }
    public DateTimeOffset? ExpectedArrival { get; set; }
    public int Guests { get; set; } = 2;
    public ReservationState State { get; set; } = ReservationState.Confirmed;
    public required DateTimeOffset ReceivedAt { get; init; }
    /// <summary>Short-term rental stay (as opposed to a mid-term lease).</summary>
    public bool IsShortTerm { get; init; } = true;
}

public sealed record DailySchedule(TimeOnly Start, TimeOnly End);

public sealed class Credential
{
    public required string Id { get; init; }
    public required string PersonId { get; init; }
    public string? StayId { get; init; }
    public required CredentialMethod Method { get; init; }
    public required string Pin { get; init; }
    public string QrPayload => $"SHORELINE-DEMO|{Id}|NOT-VALID-FOR-ENTRY";

    public ProvisioningState Provisioning { get; set; } = ProvisioningState.Pending;
    public string? ProvisioningError { get; set; }
    public DateTimeOffset? PreparedAt { get; set; }
    /// <summary>How many times the controller accepted this credential. Must stay at 1.</summary>
    public int ControllerWrites { get; set; }

    public string? AccessGroupId { get; set; }
    /// <summary>Explicit locations for temporary access; overrides the group when set.</summary>
    public IReadOnlyList<string>? AccessPointIds { get; init; }

    public required DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidUntil { get; set; }
    public DailySchedule? Schedule { get; init; }

    public DateTimeOffset? RevokedAt { get; private set; }
    public string? RevokeReason { get; private set; }

    public bool IsRevoked => RevokedAt is not null;

    public void Revoke(DateTimeOffset at, string reason)
    {
        if (IsRevoked)
        {
            return;
        }

        RevokedAt = at;
        RevokeReason = reason;
    }

    /// <summary>Idempotent: provisioning an already provisioned credential is a no-op.</summary>
    public bool MarkProvisioned(DateTimeOffset at, string? accessGroupId)
    {
        if (Provisioning == ProvisioningState.Succeeded)
        {
            return false;
        }

        Provisioning = ProvisioningState.Succeeded;
        ProvisioningError = null;
        PreparedAt = at;
        AccessGroupId ??= accessGroupId;
        ControllerWrites++;
        return true;
    }

    public void MarkFailed(string error)
    {
        if (Provisioning == ProvisioningState.Succeeded)
        {
            return;
        }

        Provisioning = ProvisioningState.Failed;
        ProvisioningError = error;
    }
}

public sealed class AccessGroup
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required IReadOnlyList<string> AccessPointIds { get; init; }
    /// <summary>Groups that may be mapped to a guest unit.</summary>
    public bool AssignableToUnits { get; init; }
}

public sealed class AccessPoint
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required AccessPointCategory Category { get; init; }
    public required AccessPointKind Kind { get; init; }
    public bool Online { get; set; } = true;
    public DateTimeOffset? OfflineSince { get; set; }
    public bool HasCamera { get; init; }
}

public sealed record SyncAttempt(DateTimeOffset At, bool Succeeded, string Detail);

public sealed record ReservationCandidate(
    string ReservationId,
    DateTimeOffset CheckIn,
    DateTimeOffset CheckOut,
    int Guests,
    DateTimeOffset ReceivedAt,
    string Note);

public sealed class SyncIssue
{
    public required string Id { get; init; }
    public required SyncIssueKind Kind { get; init; }
    public required string PersonId { get; init; }
    public required string StayId { get; init; }
    public required string Unit { get; init; }
    public required string Summary { get; init; }
    public required string NextAction { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ResolvedAt { get; private set; }
    public string? Resolution { get; private set; }
    public List<SyncAttempt> Attempts { get; } = [];
    public IReadOnlyList<ReservationCandidate> Candidates { get; init; } = [];

    public bool IsResolved => ResolvedAt is not null;

    public void Resolve(DateTimeOffset at, string resolution)
    {
        ResolvedAt ??= at;
        Resolution ??= resolution;
    }
}

public sealed class SyncRun
{
    public required string Id { get; init; }
    public required DateTimeOffset StartedAt { get; init; }
    public string Source { get; init; } = "Demo reservation feed";
    public required SyncTrigger Trigger { get; init; }
    public int Received { get; init; }
    public int Created { get; init; }
    public int Updated { get; init; }
    public int Unchanged { get; init; }
    public int Failed { get; init; }
    public int DurationMs { get; init; }
    public required SyncRunResult Result { get; init; }
    public string? Note { get; init; }
}

public sealed class AuditEvent
{
    public required string Id { get; init; }
    public required DateTimeOffset At { get; init; }
    public required AuditCategory Category { get; init; }
    public required string Title { get; init; }
    public string? Detail { get; init; }
    public string? PersonId { get; init; }
    public string? PersonName { get; init; }
    public string? Unit { get; init; }
    public string? AccessPointId { get; init; }
    public string? AccessPointName { get; init; }
    public required string Source { get; init; }
    public required AuditResult Result { get; init; }
    /// <summary>Monotonic sequence to keep ordering stable for events with the same timestamp.</summary>
    public long Sequence { get; init; }
}
