using Shoreline.Api.Common;
using Shoreline.Api.Infrastructure.Demo;

namespace Shoreline.Api.Features.Demo;

public static class ResetDemo
{
    public sealed class Endpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app) =>
            app.MapPost("/demo/reset", Handle)
                .WithTags("Demo")
                .WithName(nameof(ResetDemo));
    }

    internal static GetDemoState.Response Handle(DemoStore store)
    {
        store.Reset();
        return store.Read(GetDemoState.Project);
    }
}
