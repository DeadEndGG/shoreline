using System.Globalization;

namespace Shoreline.Api.Common;

/// <summary>
/// Shoreline Residences is in Panama City Beach, Florida, which observes US Central time.
/// All schedules are evaluated in property time, never in the server's or viewer's zone.
/// </summary>
public static class PropertyTime
{
    public const string TimeZoneId = "America/Chicago";

    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    private static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("en-US");

    public static DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone);

    public static DateOnly DateOf(DateTimeOffset instant) => DateOnly.FromDateTime(ToLocal(instant).DateTime);

    public static TimeOnly TimeOf(DateTimeOffset instant) => TimeOnly.FromDateTime(ToLocal(instant).DateTime);

    /// <summary>Creates an instant from a wall-clock time at the property.</summary>
    public static DateTimeOffset At(int year, int month, int day, int hour = 0, int minute = 0)
    {
        var wall = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Unspecified);
        return new DateTimeOffset(wall, Zone.GetUtcOffset(wall));
    }

    public static DateTimeOffset At(DateOnly date, TimeOnly time) =>
        At(date.Year, date.Month, date.Day, time.Hour, time.Minute);

    /// <summary>Parses "yyyy-MM-ddTHH:mm" as property wall-clock time; accepts explicit offsets too.</summary>
    public static bool TryParseLocal(string? value, out DateTimeOffset instant)
    {
        instant = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (value.Length > 16 && (value.EndsWith('Z') || value[^6] is '+' or '-'))
        {
            return DateTimeOffset.TryParse(value, Culture, DateTimeStyles.None, out instant);
        }

        if (DateTime.TryParse(value, Culture, DateTimeStyles.None, out var wall))
        {
            instant = At(wall.Year, wall.Month, wall.Day, wall.Hour, wall.Minute);
            return true;
        }

        return false;
    }

    public static string ZoneAbbreviation(DateTimeOffset instant) =>
        Zone.IsDaylightSavingTime(ToLocal(instant)) ? "CDT" : "CST";

    public static string Format(DateTimeOffset instant, string format) =>
        ToLocal(instant).ToString(format, Culture);

    /// <summary>Short wall-clock label such as "4:00 PM".</summary>
    public static string Clock(DateTimeOffset instant) => Format(instant, "h:mm tt");
}
