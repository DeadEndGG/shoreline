namespace Shoreline.Api.Infrastructure.Demo;

public sealed class DemoOptions
{
    public const string Section = "Demo";

    /// <summary>Short, deterministic delay for simulated controller/feed calls. 0 in tests.</summary>
    public int SimulatedLatencyMs { get; set; } = 900;
}

public sealed class SimulatedLatency(Microsoft.Extensions.Options.IOptions<DemoOptions> options)
{
    public Task WaitAsync(CancellationToken cancellationToken, double factor = 1) =>
        options.Value.SimulatedLatencyMs <= 0
            ? Task.CompletedTask
            : Task.Delay(TimeSpan.FromMilliseconds(options.Value.SimulatedLatencyMs * factor), cancellationToken);
}
