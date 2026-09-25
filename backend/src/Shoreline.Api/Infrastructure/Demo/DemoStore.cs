namespace Shoreline.Api.Infrastructure.Demo;

/// <summary>
/// Thread-safe owner of the demo state. Slices read and mutate state exclusively
/// through <see cref="Read{T}"/> and <see cref="Write{T}"/> so every screen observes
/// one consistent snapshot.
/// </summary>
public sealed class DemoStore
{
    private readonly Lock _gate = new();
    private DemoState _state = DemoFixtures.Create();

    public T Read<T>(Func<DemoState, T> query)
    {
        lock (_gate)
        {
            return query(_state);
        }
    }

    public T Write<T>(Func<DemoState, T> command)
    {
        lock (_gate)
        {
            return command(_state);
        }
    }

    public void Reset()
    {
        lock (_gate)
        {
            _state = DemoFixtures.Create();
        }
    }
}
