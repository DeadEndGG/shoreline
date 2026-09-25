using Shoreline.Api.Common;

namespace Shoreline.Api.Domain;

/// <summary>
/// The single source of truth for "does this person have access right now?".
/// Provisioning, reservation and lifecycle states are kept separate and combined only here.
/// </summary>
public static class AccessRules
{
    public static CredentialStatus StatusOf(Credential credential, Stay? stay, DateTimeOffset now)
    {
        if (credential.IsRevoked || stay?.State == ReservationState.Cancelled)
        {
            return CredentialStatus.Revoked;
        }

        // Failed or pending provisioning never produces active access.
        if (credential.Provisioning != ProvisioningState.Succeeded)
        {
            return CredentialStatus.NeedsAttention;
        }

        // Checkout is an exclusive end boundary.
        if (credential.ValidUntil is { } end && now >= end)
        {
            return CredentialStatus.Expired;
        }

        return now < credential.ValidFrom ? CredentialStatus.Scheduled : CredentialStatus.Active;
    }

    /// <summary>Active status plus any staff/vendor schedule, evaluated in property time.</summary>
    public static bool CanEnterNow(Credential credential, Stay? stay, DateTimeOffset now)
    {
        if (StatusOf(credential, stay, now) != CredentialStatus.Active)
        {
            return false;
        }

        if (credential.Schedule is not { } schedule)
        {
            return true;
        }

        var time = PropertyTime.TimeOf(now);
        return time >= schedule.Start && time < schedule.End;
    }

    /// <summary>"Ready" means provisioned and scheduled — not necessarily active yet.</summary>
    public static bool IsReady(Credential credential, Stay? stay) =>
        credential.Provisioning == ProvisioningState.Succeeded
        && !credential.IsRevoked
        && stay?.State != ReservationState.Cancelled;
}
