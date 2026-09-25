using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Shoreline.Api.Tests;

/// <summary>A fresh in-memory API per test, with simulated latency switched off.</summary>
public sealed class ShorelineApp : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting("Demo:SimulatedLatencyMs", "0");

    public async Task<JsonNode> GetJson(string url)
    {
        var response = await CreateClient().GetAsync($"/api{url}");
        response.EnsureSuccessStatusCode();
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }

    public async Task<(int Status, JsonNode? Body)> Send(HttpMethod method, string url, object? body = null)
    {
        var request = new HttpRequestMessage(method, $"/api{url}");
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        var response = await CreateClient().SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return ((int)response.StatusCode, string.IsNullOrEmpty(text) ? null : JsonNode.Parse(text));
    }

    public Task<(int Status, JsonNode? Body)> Post(string url, object? body = null) => Send(HttpMethod.Post, url, body ?? new { });

    public Task AdvanceTo(string target) => Post("/demo/clock/advance", new { target });
}
