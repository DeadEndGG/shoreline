namespace Shoreline.Api.Common;

/// <summary>
/// A vertical slice exposes its HTTP surface by implementing this interface.
/// Endpoints are discovered at startup, so adding a feature never touches Program.cs.
/// </summary>
public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder app);
}
