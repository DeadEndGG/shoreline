using Shoreline.Api.Common;
using Shoreline.Api.Domain;

namespace Shoreline.Api.Tests;

public class AccessRulesTests
{
    private static readonly DateTimeOffset CheckIn = PropertyTime.At(2026, 9, 26, 16, 0);
    private static readonly DateTimeOffset CheckOut = PropertyTime.At(2026, 10, 3, 10, 0);

    private static Credential Provisioned()
    {
        var credential = new Credential
        {
            Id = "c", PersonId = "p", Method = CredentialMethod.PinAndQr, Pin = "123456",
            ValidFrom = CheckIn, ValidUntil = CheckOut,
        };
        credential.MarkProvisioned(CheckIn.AddHours(-4), "guest-standard");
        return credential;
    }

    [Fact]
    public void Check_in_is_an_inclusive_start_boundary()
    {
        var credential = Provisioned();
        Assert.Equal(CredentialStatus.Scheduled, AccessRules.StatusOf(credential, null, CheckIn.AddTicks(-1)));
        Assert.Equal(CredentialStatus.Active, AccessRules.StatusOf(credential, null, CheckIn));
    }

    [Fact]
    public void Checkout_is_an_exclusive_end_boundary()
    {
        var credential = Provisioned();
        Assert.Equal(CredentialStatus.Active, AccessRules.StatusOf(credential, null, CheckOut.AddTicks(-1)));
        Assert.Equal(CredentialStatus.Expired, AccessRules.StatusOf(credential, null, CheckOut));
    }

    [Fact]
    public void Failed_provisioning_never_produces_active_access()
    {
        var credential = new Credential
        {
            Id = "c", PersonId = "p", Method = CredentialMethod.PinAndQr, Pin = "123456",
            ValidFrom = CheckIn, ValidUntil = CheckOut,
        };
        credential.MarkFailed("timeout");

        Assert.Equal(CredentialStatus.NeedsAttention, AccessRules.StatusOf(credential, null, CheckIn.AddHours(1)));
        Assert.False(AccessRules.CanEnterNow(credential, null, CheckIn.AddHours(1)));
    }

    [Fact]
    public void Revocation_wins_over_every_later_clock_position()
    {
        var credential = Provisioned();
        credential.Revoke(CheckIn.AddHours(-1), "Guest cancelled");

        Assert.Equal(CredentialStatus.Revoked, AccessRules.StatusOf(credential, null, CheckIn));
        Assert.Equal(CredentialStatus.Revoked, AccessRules.StatusOf(credential, null, CheckOut.AddDays(1)));
    }

    [Fact]
    public void Staff_schedule_is_evaluated_in_property_time()
    {
        var credential = new Credential
        {
            Id = "c", PersonId = "p", Method = CredentialMethod.KeyCard, Pin = "1",
            ValidFrom = PropertyTime.At(2025, 1, 1), Schedule = new DailySchedule(new(8, 0), new(16, 0)),
        };
        credential.MarkProvisioned(PropertyTime.At(2025, 1, 1), "staff-housekeeping");

        Assert.True(AccessRules.CanEnterNow(credential, null, PropertyTime.At(2026, 9, 26, 15, 59)));
        Assert.False(AccessRules.CanEnterNow(credential, null, PropertyTime.At(2026, 9, 26, 16, 0)));
        Assert.False(AccessRules.CanEnterNow(credential, null, PropertyTime.At(2026, 9, 26, 7, 59)));
    }

    [Fact]
    public void Provisioning_is_idempotent()
    {
        var credential = Provisioned();
        Assert.False(credential.MarkProvisioned(CheckIn, "guest-standard"));
        Assert.Equal(1, credential.ControllerWrites);
    }
}
