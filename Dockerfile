# Single container: the ASP.NET Core API serves the compiled Angular app from wwwroot.
# There is no database — all demo state lives in memory and resets when the container restarts.

FROM node:24-bookworm-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build --configuration production

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY backend/global.json backend/Shoreline.slnx ./
COPY backend/src/Shoreline.Api/Shoreline.Api.csproj src/Shoreline.Api/
RUN dotnet restore src/Shoreline.Api/Shoreline.Api.csproj
COPY backend/src/ src/
RUN dotnet publish src/Shoreline.Api/Shoreline.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /src/frontend/dist/frontend/browser ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Shoreline.Api.dll"]
