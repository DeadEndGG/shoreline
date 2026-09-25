using System.Text.Json;
using System.Text.Json.Serialization;
using Shoreline.Api.Common;
using Shoreline.Api.Infrastructure.Demo;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
});
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.Configure<DemoOptions>(builder.Configuration.GetSection(DemoOptions.Section));
builder.Services.AddSingleton<DemoStore>();
builder.Services.AddSingleton<SimulatedLatency>();
builder.Services.AddEndpoints(typeof(Program).Assembly);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// In a container build, the compiled Angular app is copied into wwwroot and served from here.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapEndpoints();
app.MapGet("/api/health", () => TypedResults.Ok(new { status = "ok" })).WithTags("Health");
// SPA fallback for non-file paths outside /api (hash routing makes this mostly a safety net).
app.MapFallbackToFile("{*path:nonfile:regex(^(?!api/).*$)}", "index.html");

app.Run();

public partial class Program;
