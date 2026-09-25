namespace Shoreline.Api.Common;

/// <summary>
/// Case-insensitive enum binding for query strings, so clients can send the same camelCase
/// values the JSON serializer emits (e.g. <c>?segment=activeStays</c>). Invalid values yield 400.
/// </summary>
public readonly record struct QueryEnum<T>(T Value) where T : struct, Enum
{
    public static bool TryParse(string? value, out QueryEnum<T> result)
    {
        var ok = Enum.TryParse<T>(value, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed);
        result = new QueryEnum<T>(parsed);
        return ok;
    }

    public static implicit operator T(QueryEnum<T> value) => value.Value;
}
