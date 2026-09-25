namespace Shoreline.Api.Common;

/// <summary>
/// Minimal, dependency-free validation helper. Each slice declares its own rules and
/// returns RFC 7807 validation problems through <see cref="TypedResults.ValidationProblem(IDictionary{string, string[]}, string?, string?, string?, string?, IDictionary{string, object?}?)"/>.
/// </summary>
public sealed class Validator
{
    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.OrdinalIgnoreCase);

    public Validator Require(bool condition, string field, string message)
    {
        if (!condition)
        {
            if (!_errors.TryGetValue(field, out var list))
            {
                _errors[field] = list = [];
            }

            list.Add(message);
        }

        return this;
    }

    public bool IsValid => _errors.Count == 0;

    public Dictionary<string, string[]> Errors => _errors.ToDictionary(e => e.Key, e => e.Value.ToArray());
}
