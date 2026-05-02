export interface Coordinates {
    lat: number;
    lon: number;
}
  
export interface RouteGeometry {
    coordinates: [number, number][];
}
  
/** OSRM leg (current→pickup, pickup→dropoff) when routing returns legs. */
export interface RouteLeg {
    distance: number;
    duration: number;
}

export interface Route {
    distance: number;
    duration: number;
    geometry: RouteGeometry;
    legs?: RouteLeg[];
}
  
export interface Stop {
    type: string;
    mile_marker?: number;
    after_hours?: number;
    reason?: string;
    location?: { lat: number; lng: number };
}
  
export interface Segment {
    type:
      | "driving"
      | "break"
      | "on_duty"
      | "off_duty"
      | "sleeper";
    hours: number;
    /** Pre-trip vs pickup/unload staging (backend). */
    duty_kind?: "pretrip" | "pickup" | "unload";
}

export interface LogDaySummary {
    drive_hours: number;
    duty_hours: number;
    cycle_total: number;
}
  
export interface LogDay {
    day: number;
    /** ISO calendar date corresponding to each sheet in order (backend). */
    calendar_date?: string;
    segments: Segment[];
    note?: string;
    summary?: LogDaySummary;
}

/** Driver fields echoed from API / stored on plan. */
export interface PersistedDriver {
    driver_name: string;
    log_date: string;
    duty_start_time: string;
}
  
export interface TripResponse {
    summary: {
      total_distance_miles: number;
      estimated_travel_hours: number;
      fuel_stops: number;
      rest_stops: number;
      required_days: number;
        };
    route: Route;
    stops: {
      fuel: Stop[];
      rest: Stop[];
    };
    logs: LogDay[];
    driver?: PersistedDriver;
}

/** API request: each leg may be plain text or map coordinates (`lng` forwarded to Django). */
export type LocationFieldKey =
  | "current_location"
  | "pickup_location"
  | "dropoff_location";

export const LOCATION_FIELD_KEYS: LocationFieldKey[] = [
  "current_location",
  "pickup_location",
  "dropoff_location",
];

export interface CoordinateLiteral {
  lat: number;
  lng: number;
}

export type LocationPayload = string | CoordinateLiteral;

/** Locations + cycle sent from the trip form (submitted merged with driver fields). */
export interface TripLocationsRequest {
    current_location: LocationPayload;
    pickup_location: LocationPayload;
    dropoff_location: LocationPayload;
    cycle_used: number;
}

export interface TripPlanRequest extends TripLocationsRequest, PersistedDriver {}

/** Form state before encoding to `TripPlanRequest`; map mode omits coords until picked. */
export type UiLocation =
  | { source: "text"; text: string }
  | { source: "map"; lat?: number; lng?: number };

export function uiLocationToPayload(loc: UiLocation): LocationPayload {
  if (loc.source === "text") return loc.text.trim();
  const { lat, lng } = loc;
  if (
    lat === undefined ||
    lng === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new Error("Map location is incomplete");
  }
  return { lat, lng };
}

export function isUiLocationReady(loc: UiLocation): boolean {
  if (loc.source === "text") return loc.text.trim().length > 0;
  return (
    loc.lat !== undefined &&
    loc.lng !== undefined &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  );
}

export function formatUiLocationSecondary(loc: UiLocation): string {
  if (loc.source === "text" || !isUiLocationReady(loc)) return "";
  return `${loc.lat!.toFixed(5)}, ${loc.lng!.toFixed(5)}`;
}

/** Short label for ELD remarks (address text or map coordinates). */
export function uiLocationRemarkPlace(loc: UiLocation): string {
  if (loc.source === "text") {
    const t = loc.text.trim();
    return t.length > 0 ? t : "—";
  }
  if (
    loc.lat !== undefined &&
    loc.lng !== undefined &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return "—";
}

export function emptyUiLocation(): UiLocation {
  return { source: "text", text: "" };
}