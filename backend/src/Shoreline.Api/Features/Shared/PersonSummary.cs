using Shoreline.Api.Common;
using Shoreline.Api.Domain;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Shared;

/// <summary>
/// Row contract shared by the directory, the overview tables and search.
/// Kept deliberately small; detail views project their own shapes.
/// </summary>
public sealed record PersonSummary(
    string Id,
    string Name,
    string Initials,
    PersonType Type,
    string? Unit,
    string? Role,
    string? ReservationId,
    DateTimeOffset? AccessFrom,
    DateTimeOffset? AccessUntil,
    string? Schedule,
    DateTimeOffset? ExpectedArrival,
    CredentialMethod? Method,
    CredentialStatus Status,
    string? AccessGroup,
    bool HasOpenIssue);

public static class PersonProjection
{
    public static PersonSummary ToSummary(this DemoState state, Person person)
    {
        var stay = state.StayFor(person.Id);
        var credential = state.CredentialFor(person.Id);
        var status = credential is null
            ? CredentialStatus.NeedsAttention
            : AccessRules.StatusOf(credential, stay, state.Now);

        return new PersonSummary(
            person.Id,
            person.Name,
            person.Initials,
            person.Type,
            person.Unit ?? person.HostUnit,
            person.Role,
            stay?.ReservationId,
            credential?.ValidFrom,
            credential?.ValidUntil,
            credential?.Schedule is { } s ? ScheduleLabel(s) : null,
            stay?.ExpectedArrival,
            credential?.Method,
            status,
            credential is null ? null : state.GroupNameFor(credential),
            state.OpenIssueFor(person.Id) is not null);
    }

    public static string ScheduleLabel(DailySchedule schedule)
    {
        static string Fmt(TimeOnly t) => t == new TimeOnly(23, 59) ? "midnight" : t.ToString("h:mm tt", System.Globalization.CultureInfo.GetCultureInfo("en-US"));
        return $"Daily {Fmt(schedule.Start)}–{Fmt(schedule.End)}";
    }

    public static string MethodLabel(CredentialMethod method) => method switch
    {
        CredentialMethod.PinAndQr => "PIN + QR",
        CredentialMethod.KeyCard => "NFC fob / card",
        _ => "PIN",
    };
}

/// <summary>Date-based segments shared by overview metrics and the directory filters.</summary>
public static class StaySegments
{
    public static bool IsActiveGuestStay(Stay stay, DateTimeOffset now) =>
        stay.IsShortTerm && stay.State == ReservationState.Confirmed && stay.CheckIn <= now && now < stay.CheckOut;

    public static bool ArrivesToday(Stay stay, DateTimeOffset now) =>
        stay.IsShortTerm && stay.State == ReservationState.Confirmed && PropertyTime.DateOf(stay.CheckIn) == PropertyTime.DateOf(now);

    public static bool DepartsToday(Stay stay, DateTimeOffset now) =>
        stay.IsShortTerm && stay.State == ReservationState.Confirmed && PropertyTime.DateOf(stay.CheckOut) == PropertyTime.DateOf(now);
}
