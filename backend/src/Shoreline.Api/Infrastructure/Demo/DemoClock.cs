using Shoreline.Api.Common;

namespace Shoreline.Api.Infrastructure.Demo;

/// <summary>The fixed story timeline. The demo never reads the machine clock.</summary>
public static class DemoClock
{
    /// <summary>Saturday, September 26, 2026, 3:45 PM CDT.</summary>
    public static readonly DateTimeOffset Start = PropertyTime.At(2026, 9, 26, 15, 45);

    /// <summary>Standard check-in for today's arrivals.</summary>
    public static readonly DateTimeOffset CheckIn = PropertyTime.At(2026, 9, 26, 16, 0);

    /// <summary>Avery Morgan's checkout, exactly one week later.</summary>
    public static readonly DateTimeOffset Checkout = PropertyTime.At(2026, 10, 3, 10, 0);

    public const string ManagerName = "Morgan Hale";
    public const string ManagerRole = "Property manager";
}
