namespace Shoreline.Api.Domain;

public enum PersonType { Owner, StrGuest, MidtermRenter, Staff, Vendor, Visitor }

/// <summary>Reservation state as reported by the reservation feed.</summary>
public enum ReservationState { Confirmed, Cancelled }

/// <summary>Whether the credential was successfully written to the access controller.</summary>
public enum ProvisioningState { Pending, Succeeded, Failed }

/// <summary>Credential lifecycle as shown to managers. Derived, never stored.</summary>
public enum CredentialStatus { Scheduled, Active, NeedsAttention, Expired, Revoked }

public enum CredentialMethod { PinAndQr, KeyCard, Pin }

public enum AccessPointCategory { Building, Amenity, Exterior, Service }

public enum AccessPointKind { Door, Gate, Room }

public enum SyncIssueKind { ProvisioningTimeout, MissingUnitMapping, DuplicateReservation, ProvisioningInterrupted }

public enum SyncRunResult { Succeeded, CompletedWithIssues, Failed }

public enum SyncTrigger { Scheduled, Manual, Retry, Recovery }

public enum AuditCategory { Access, Credential, Sync, Manual }

public enum AuditResult { Success, Denied, Warning, Info }

public enum DemoScenario { Normal, FeedUnavailable, ProvisioningInterrupted }
