import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LocationFieldKey, Route, Stop, UiLocation } from "../types/trip";
import {
  LOCATION_FIELD_KEYS,
  formatUiLocationSecondary,
  isUiLocationReady,
  uiLocationRemarkPlace,
} from "../types/trip";
import {
  IconClock,
  IconListTree,
  IconRuler,
} from "./UiIcons";

type LatLngTuple = [number, number];

const US_CENTER: LatLngTuple = [39.8283, -98.5795];
const US_ZOOM = 4;

/** Cap vertices used for fitBounds so long routes zoom to the corridor, not every raw OSRM point. */
const ROUTE_FIT_VERTEX_BUDGET = 100;

const FIELD_POPUP_LABEL: Record<LocationFieldKey, string> = {
  current_location: "Current (planned start)",
  pickup_location: "Pickup",
  dropoff_location: "Drop-off",
};

const PICK_HINT_LABEL: Record<LocationFieldKey, string> = {
  current_location: "current location",
  pickup_location: "pickup location",
  dropoff_location: "drop-off location",
};

/** Keep waypoint popups on screen together during tracking / manual clicks. */
const ROUTE_SITE_POPUP_PROPS = {
  className: "route-location-popup",
  autoClose: false,
  closeOnClick: false,
} as const;

function ClosePopupsOnNewReplay({ replayKey }: { replayKey: number }) {
  const map = useMap();
  const prevKey = useRef(0);

  useEffect(() => {
    if (replayKey > 0 && replayKey !== prevKey.current) {
      map.closePopup();
    }
    prevKey.current = replayKey;
  }, [replayKey, map]);

  return null;
}

/** Red = current/start, neutral pick for pickup waypoint, blue = drop-off */
const ICON_CURRENT = L.divIcon({
  className: "route-pin-icon",
  html: `<span class="route-pin route-pin--current"></span>`,
  iconSize: [36, 44],
  iconAnchor: [18, 42],
});

const ICON_PICKUP = L.divIcon({
  className: "route-pin-icon",
  html: `<span class="route-pin route-pin--pickup"></span>`,
  iconSize: [28, 34],
  iconAnchor: [14, 32],
});

const ICON_DROPOFF = L.divIcon({
  className: "route-pin-icon",
  html: `<span class="route-pin route-pin--dropoff"></span>`,
  iconSize: [28, 34],
  iconAnchor: [14, 32],
});

const ICON_TRACKER = L.divIcon({
  className: "route-pin-icon",
  html: `<span class="route-tracker-head"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function draftIconForField(key: LocationFieldKey): L.DivIcon {
  if (key === "current_location") return ICON_CURRENT;
  if (key === "dropoff_location") return ICON_DROPOFF;
  return ICON_PICKUP;
}

function fuelStopIcon(index: number, mileMarker: number | undefined): L.DivIcon {
  const mile =
    typeof mileMarker === "number" && Number.isFinite(mileMarker)
      ? `${Math.round(mileMarker)} mi`
      : "Fuel";

  return L.divIcon({
    className: "route-fuel-stop-icon",
    html: `
      <span class="fuel-callout">
        <span class="fuel-callout__top">
          <span class="fuel-callout__left">Fuel ${index + 1}</span>
          <span class="fuel-callout__right">${mile}</span>
        </span>
        <span class="fuel-callout__tail"></span>
      </span>
    `,
    iconSize: [150, 58],
    iconAnchor: [75, 55],
  });
}

interface Props {
  route?: Route;
  stops?: {
    fuel: Stop[];
    rest: Stop[];
  };
  planLocations?: Record<LocationFieldKey, UiLocation>;
  pickTarget?: LocationFieldKey | null;
  onMapLocationPick?: (lat: number, lng: number) => void;
  /** Incremented after a successful trip plan (Create); tracking replay runs only when this is greater than 0. */
  routeTrackingReplayKey?: number;
}

function haversineM(a: LatLngTuple, b: LatLngTuple): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function lerpLng(a: LatLngTuple, b: LatLngTuple, t: number): LatLngTuple {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function buildCumulative(positions: LatLngTuple[]): { cum: number[]; total: number } {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += haversineM(positions[i - 1]!, positions[i]!);
    cum.push(total);
  }
  return { cum, total };
}

/** Planar-ish projection for segment clamp (lat/lng). */
function projectPointOnSegmentT(p: LatLngTuple, a: LatLngTuple, b: LatLngTuple): number {
  const lat0 = (((a[0] + b[0]) / 2) * Math.PI) / 180;
  const scale = Math.cos(lat0);
  const ax = a[1] * scale;
  const ay = a[0];
  const bx = b[1] * scale;
  const by = b[0];
  const px = p[1] * scale;
  const py = p[0];
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-18) return 0;
  const t = ((px - ax) * abx + (py - ay) * aby) / ab2;
  return Math.min(1, Math.max(0, t));
}

/** Normalized distance [0,1] along polyline to closest projection of `point`. */
function closestUOnPolyline(
  point: LatLngTuple,
  positions: LatLngTuple[],
  cum: number[],
  total: number,
): number {
  if (positions.length < 2 || total < 1e-9) return 0;
  let bestU = 0;
  let bestDist = Infinity;
  for (let i = 0; i < positions.length - 1; i++) {
    const p0 = positions[i]!;
    const p1 = positions[i + 1]!;
    const t = projectPointOnSegmentT(point, p0, p1);
    const mx = p0[0] + t * (p1[0] - p0[0]);
    const my = p0[1] + t * (p1[1] - p0[1]);
    const mid: LatLngTuple = [mx, my];
    const d = haversineM(point, mid);
    if (d < bestDist) {
      bestDist = d;
      const along = cum[i]! + t * (cum[i + 1]! - cum[i]!);
      bestU = along / total;
    }
  }
  for (let i = 0; i < positions.length; i++) {
    const d = haversineM(point, positions[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestU = cum[i]! / total;
    }
  }
  return Math.min(1, Math.max(0, bestU));
}

function RoutePopupBody({
  title,
  planLocations,
  fieldKey,
  details,
}: {
  title: string;
  planLocations?: Record<LocationFieldKey, UiLocation>;
  fieldKey: LocationFieldKey;
  details?: string[];
}) {
  const loc = planLocations?.[fieldKey];
  const primary = loc ? uiLocationRemarkPlace(loc) : "—";
  const secondary = loc ? formatUiLocationSecondary(loc) : "";
  return (
    <div className="route-popup-body">
      <strong>{title}</strong>
      <div className="route-popup-place">{primary}</div>
      {details?.length ? (
        <div className="route-popup-details">
          {details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      ) : null}
      {secondary ? <div className="route-popup-coords muted">{secondary}</div> : null}
    </div>
  );
}

function FuelPopupBody({ mileMarker }: { mileMarker: number | undefined }) {
  return (
    <div className="route-popup-body route-popup-body--fuel">
      <strong>Fuel stop</strong>
      <div className="route-popup-place">
        Mile {mileMarker ?? "?"} along route
      </div>
    </div>
  );
}

function pointAtNormalizedDistance(
  positions: LatLngTuple[],
  cum: number[],
  total: number,
  u: number,
): { trail: LatLngTuple[]; head: LatLngTuple } {
  const n = positions.length;
  if (n === 0) return { trail: [], head: [0, 0] };
  if (n === 1 || total < 1e-9) return { trail: [positions[0]!], head: positions[0]! };

  const clamped = Math.min(1, Math.max(0, u));
  const d = clamped * total;

  let i = 0;
  while (i < n - 1 && cum[i + 1]! < d - 1e-12) {
    i++;
  }

  const p0 = positions[i]!;
  const p1 = positions[i + 1] ?? p0;
  const segA = cum[i]!;
  const segB = cum[i + 1]!;
  const segLen = segB - segA;
  const frac =
    segLen > 1e-12 ? Math.min(1, Math.max(0, (d - segA) / segLen)) : clamped >= 1 ? 1 : 0;
  const head = lerpLng(p0, p1, frac);
  const trail = positions.slice(0, i + 1);

  const last = trail[trail.length - 1]!;
  const headSame =
    Math.abs(last[0] - head[0]) < 1e-8 && Math.abs(last[1] - head[1]) < 1e-8;
  if (!headSame) trail.push(head);

  return { trail, head };
}

/** Point along polyline where the first OSRM leg ends (current → pickup). */
function pickupPointAlongRoute(
  positions: LatLngTuple[],
  route: Route,
): LatLngTuple | null {
  if (positions.length < 2) return null;
  const { cum, total } = buildCumulative(positions);
  if (total < 1e-9) return positions[0]!;

  let u = 0.5;
  const legs = route.legs;
  if (legs && legs.length >= 2) {
    const d0 = Math.max(0, legs[0].distance ?? 0);
    const d1 = Math.max(0, legs[1].distance ?? 0);
    const sumD = d0 + d1;
    if (sumD > 1e-9) {
      u = d0 / sumD;
    } else {
      const t0 = Math.max(0, legs[0].duration ?? 0);
      const t1 = Math.max(0, legs[1].duration ?? 0);
      const sumT = t0 + t1;
      if (sumT > 1e-9) u = t0 / sumT;
    }
  }

  return pointAtNormalizedDistance(positions, cum, total, u).head;
}

/** Evenly sample along the polyline so bbox reflects route shape without oversized bounds. */
function samplePositionsAlongRoute(
  positions: LatLngTuple[],
  maxVertices: number,
): LatLngTuple[] {
  const n = positions.length;
  if (n <= maxVertices) return positions.slice();
  const out: LatLngTuple[] = [];
  const step = (n - 1) / (maxVertices - 1);
  for (let i = 0; i < maxVertices; i++) {
    const idx = Math.round(i * step);
    out.push(positions[Math.min(n - 1, idx)]!);
  }
  return out;
}

interface TrackingMilestone {
  id: string;
  /** Normalized position along route [0, 1]. */
  u: number;
  onOpen: () => void;
}

/** Animated tracking polyline + moving marker; runs when `replayKey` bumps after Create. */
function RouteTrackingOverlay({
  positions,
  durationMs,
  replayKey,
  milestones,
  routeDistanceMiles,
  routeDurationHours,
}: {
  positions: LatLngTuple[];
  durationMs: number;
  replayKey: number;
  milestones?: TrackingMilestone[];
  routeDistanceMiles: number;
  routeDurationHours: number;
}) {
  const [trail, setTrail] = useState<LatLngTuple[]>([]);
  const [head, setHead] = useState<LatLngTuple>(US_CENTER);
  const [progress, setProgress] = useState(0);

  const { cum, total } = useMemo(() => buildCumulative(positions), [positions]);
  const firedMilestones = useRef<Set<string>>(new Set());

  useEffect(() => {
    firedMilestones.current.clear();
  }, [replayKey]);

  useEffect(() => {
    if (replayKey <= 0 || positions.length < 2 || total < 1e-6) {
      return undefined;
    }

    const start = positions[0]!;
    setTrail([start]);
    setHead(start);

    let rafId = 0;
    const startWall = performance.now();
    const sorted = milestones?.length
      ? [...milestones].sort((a, b) => a.u - b.u || a.id.localeCompare(b.id))
      : [];

    function frame(now: number) {
      const elapsedMs = Math.max(0, now - startWall);
      const t = Math.min(1, elapsedMs / durationMs);
      setProgress(t);
      const { trail: tr, head: h } = pointAtNormalizedDistance(
        positions,
        cum,
        total,
        t,
      );
      setTrail(tr.length ? tr : [start]);
      setHead(h);

      for (const m of sorted) {
        if (firedMilestones.current.has(m.id)) continue;
        if (t + 1e-9 >= m.u) {
          firedMilestones.current.add(m.id);
          m.onOpen();
        }
      }

      if (elapsedMs >= durationMs) {
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [replayKey, positions, cum, total, durationMs, milestones]);

  if (positions.length < 2) return null;

  const showBrown = trail.length >= 2;
  const drivenMiles = Math.max(0, routeDistanceMiles * progress);
  const remainingMiles = Math.max(0, routeDistanceMiles - drivenMiles);
  const elapsedHours = Math.max(0, routeDurationHours * progress);
  const remainingHours = Math.max(0, routeDurationHours - elapsedHours);

  return (
    <>
      {showBrown && (
        <Polyline
          positions={trail}
          pane="overlayPane"
          pathOptions={{
            color: "#ff5a1f",
            weight: 6,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}
      <Marker position={head} icon={ICON_TRACKER}>
        <Popup className="route-tracker-popup">
          <div className="route-tracker-popup-card">
            <strong>Driving tracker</strong>
            <span className="route-tracker-popup-percent">
              {Math.round(progress * 100)}% complete
            </span>
            <dl>
              <div>
                <dt>Driven</dt>
                <dd>{Math.round(drivenMiles)} mi</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{Math.round(remainingMiles)} mi</dd>
              </div>
              <div>
                <dt>Elapsed</dt>
                <dd>{elapsedHours.toFixed(1)} h</dd>
              </div>
              <div>
                <dt>Left</dt>
                <dd>{remainingHours.toFixed(1)} h</dd>
              </div>
            </dl>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function MapPickListener({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled && onPick) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapViewSync({
  boundsPoints,
  fitTrigger,
}: {
  boundsPoints: LatLngTuple[] | null;
  /** Bumps after Create (and when bounds change) to re-run fitBounds. */
  fitTrigger?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (boundsPoints && boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);

      if (!bounds.isValid()) {
        map.setView(US_CENTER, US_ZOOM);
        return;
      }

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const collapses =
        Math.abs(sw.lat - ne.lat) < 1e-8 && Math.abs(sw.lng - ne.lng) < 1e-8;

      if (collapses) {
        map.setView(bounds.getCenter(), Math.max(map.getZoom(), 13));
      } else {
        map.fitBounds(bounds, {
          padding: [56, 56],
          maxZoom: 15,
          animate: true,
        });
      }
    } else {
      map.setView(US_CENTER, US_ZOOM);
    }
  }, [map, boundsPoints, fitTrigger]);

  return null;
}

export default function RouteMap({
  route,
  stops,
  planLocations,
  pickTarget,
  onMapLocationPick,
  routeTrackingReplayKey = 0,
}: Props) {
  const hasRoute = Boolean(route?.geometry?.coordinates?.length);

  const coords = route?.geometry?.coordinates;

  const positions = useMemo<LatLngTuple[]>(
    () => coords?.map(([lng, lat]) => [lat, lng] as LatLngTuple) ?? [],
    [coords],
  );

  const routeBoundsPts = useMemo(() => {
    if (!coords?.length || !route || positions.length < 2) return null;
    const pts: LatLngTuple[] = [
      ...samplePositionsAlongRoute(positions, ROUTE_FIT_VERTEX_BUDGET),
    ];
    const pickupPt = pickupPointAlongRoute(positions, route);
    if (pickupPt) pts.push(pickupPt);
    for (const stop of [...(stops?.fuel ?? []), ...(stops?.rest ?? [])]) {
      if (stop.location) {
        pts.push([stop.location.lat, stop.location.lng]);
      }
    }
    return pts;
  }, [coords, route, stops, positions]);

  const draftBoundsPts = useMemo(() => {
    if (!planLocations) return null;
    const pts: LatLngTuple[] = [];
    for (const key of LOCATION_FIELD_KEYS) {
      const loc = planLocations[key];
      if (
        loc.source === "map" &&
        isUiLocationReady(loc) &&
        loc.lat !== undefined &&
        loc.lng !== undefined
      ) {
        pts.push([loc.lat, loc.lng]);
      }
    }
    return pts.length ? pts : null;
  }, [planLocations]);

  const mergedBoundsPoints = useMemo(() => {
    if (hasRoute && routeBoundsPts?.length) return routeBoundsPts;
    if (!hasRoute && draftBoundsPts?.length) return draftBoundsPts;
    return null;
  }, [draftBoundsPts, hasRoute, routeBoundsPts]);

  const milesUi = route ? Math.round(route.distance) : 0;
  const hoursUi = route ? route.duration : 0;
  const segmentsUi = positions.length > 1 ? positions.length - 1 : "—";

  /** 1 s per 200 mi if distance ≤ 1000 mi; else fixed 5 s. */
  const replayMs = useMemo(() => {
    if (!route) return 5000;
    const d = Math.max(0, route.distance);
    if (d > 1000) return 5000;
    const ms = (d / 200) * 1000;
    return Math.max(ms, d > 0 ? 250 : 500);
  }, [route]);

  const pickupAlongRoute = useMemo(() => {
    if (!hasRoute || !route || positions.length < 2) return null;
    return pickupPointAlongRoute(positions, route);
  }, [hasRoute, route, positions]);

  const startMarkerRef = useRef<LeafletMarker | null>(null);
  const pickupMarkerRef = useRef<LeafletMarker | null>(null);
  const dropoffMarkerRef = useRef<LeafletMarker | null>(null);
  const fuelMarkerRefs = useRef<Map<number, LeafletMarker | null>>(new Map());

  const trackingMilestones = useMemo((): TrackingMilestone[] | undefined => {
    if (!hasRoute || !route || positions.length < 2) return undefined;
    const { cum, total } = buildCumulative(positions);
    const list: TrackingMilestone[] = [];

    list.push({
      id: "start",
      u: 0,
      onOpen: () => startMarkerRef.current?.openPopup(),
    });

    if (pickupAlongRoute) {
      let up = closestUOnPolyline(pickupAlongRoute, positions, cum, total);
      if (up <= 0.002) up = 0.002;
      if (up >= 0.998) up = 0.998;
      list.push({
        id: "pickup",
        u: up,
        onOpen: () => pickupMarkerRef.current?.openPopup(),
      });
    }

    stops?.fuel?.forEach((stop, i) => {
      if (!stop.location) return;
      const pt: LatLngTuple = [stop.location.lat, stop.location.lng];
      let uf = closestUOnPolyline(pt, positions, cum, total);
      if (uf <= 0.001) uf = 0.001;
      if (uf >= 0.999) uf = 0.999;
      const idx = i;
      list.push({
        id: `fuel-${i}`,
        u: uf,
        onOpen: () => fuelMarkerRefs.current.get(idx)?.openPopup(),
      });
    });

    list.push({
      id: "end",
      u: 1,
      onOpen: () => dropoffMarkerRef.current?.openPopup(),
    });

    list.sort((a, b) => a.u - b.u || a.id.localeCompare(b.id));
    return list;
  }, [hasRoute, route, positions, pickupAlongRoute, stops]);

  const pickingActive = Boolean(pickTarget && onMapLocationPick);
  const pickupLeg = route?.legs?.[0];
  const dropoffLeg = route?.legs?.[1];
  const startDetails = hasRoute ? ["0 mi", "Trip start"] : undefined;
  const pickupDetails =
    hasRoute && pickupLeg
      ? [
          `${Math.round(pickupLeg.distance)} mi from start`,
          `${pickupLeg.duration.toFixed(1)} h drive`,
        ]
      : undefined;
  const dropoffDetails =
    hasRoute && route
      ? [
          `${Math.round(route.distance)} mi total`,
          `${route.duration.toFixed(1)} h total`,
          dropoffLeg ? `${Math.round(dropoffLeg.distance)} mi after pickup` : "",
        ].filter(Boolean)
      : undefined;

  return (
    <section className="card map-card map-card--fill">
      <h2>Route</h2>
      {/* <div className="route-legend">
        <span className="legend-chip--current">Current / Start</span>
        <span>Pickup</span>
        <span className="legend-chip--dropoff">Drop-off</span>
        <span>Fuel Stop</span>
        <span>Rest Stop</span>
        <span className="legend-chip--track">Tracking</span>
      </div> */}

      {!hasRoute && !pickingActive && (
        <p className="map-placeholder-hint muted">
          Plan a trip to see the route on the map, or pick locations on the map using the form.
        </p>
      )}

      {pickingActive && pickTarget ? (
        <p className="map-pick-hint muted" role="status">
          Click the map to set your {PICK_HINT_LABEL[pickTarget]} (crosshair mode).
        </p>
      ) : null}

      <div className="map-shell">
        <MapContainer
          className={pickingActive ? "route-leaflet map-container--picking" : "route-leaflet"}
          center={US_CENTER}
          zoom={US_ZOOM}
          style={{ height: "100%", width: "100%", minHeight: "min(52vh, 560px)" }}
          scrollWheelZoom
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={100}
          wheelDebounceTime={30}
          preferCanvas
          closePopupOnClick={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            className="route-map-tiles"
            opacity={0.9}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <MapViewSync
            boundsPoints={mergedBoundsPoints}
            fitTrigger={routeTrackingReplayKey}
          />

          {hasRoute && routeTrackingReplayKey > 0 ? (
            <ClosePopupsOnNewReplay replayKey={routeTrackingReplayKey} />
          ) : null}

          <MapPickListener enabled={pickingActive} onPick={onMapLocationPick} />

          {!hasRoute && planLocations
            ? LOCATION_FIELD_KEYS.map((key) => {
                const loc = planLocations[key];
                if (
                  loc.source !== "map" ||
                  !isUiLocationReady(loc) ||
                  loc.lat === undefined ||
                  loc.lng === undefined
                )
                  return null;
                return (
                  <Marker
                    key={`draft-${key}`}
                    position={[loc.lat, loc.lng]}
                    icon={draftIconForField(key)}
                  >
                    <Popup>{FIELD_POPUP_LABEL[key]}</Popup>
                  </Marker>
                );
              })
            : null}

          {hasRoute && positions.length > 0 && (
            <>
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#d6d1c4",
                  weight: 8,
                  opacity: 0.62,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#ff5a1f",
                  weight: 5,
                  opacity: 0.96,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              {routeTrackingReplayKey > 0 ? (
                <RouteTrackingOverlay
                  positions={positions}
                  durationMs={replayMs}
                  replayKey={routeTrackingReplayKey}
                  milestones={trackingMilestones}
                  routeDistanceMiles={route?.distance ?? 0}
                  routeDurationHours={route?.duration ?? 0}
                />
              ) : null}

              <Marker
                ref={startMarkerRef}
                position={positions[0]!}
                icon={ICON_CURRENT}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -40]}
                  className="route-site-tooltip route-site-tooltip--current"
                >
                  <RoutePopupBody
                    title="Start"
                    planLocations={planLocations}
                    fieldKey="current_location"
                    details={startDetails}
                  />
                </Tooltip>
              </Marker>

              {pickupAlongRoute ? (
                <Marker
                  ref={pickupMarkerRef}
                  position={pickupAlongRoute}
                  icon={ICON_PICKUP}
                >
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -32]}
                    className="route-site-tooltip route-site-tooltip--pickup"
                  >
                    <RoutePopupBody
                      title="Pickup"
                      planLocations={planLocations}
                      fieldKey="pickup_location"
                      details={pickupDetails}
                    />
                  </Tooltip>
                </Marker>
              ) : null}

              <Marker
                ref={dropoffMarkerRef}
                position={positions[positions.length - 1]!}
                icon={ICON_DROPOFF}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -32]}
                  className="route-site-tooltip route-site-tooltip--dropoff"
                >
                  <RoutePopupBody
                    title="Drop-off"
                    planLocations={planLocations}
                    fieldKey="dropoff_location"
                    details={dropoffDetails}
                  />
                </Tooltip>
              </Marker>

              {stops?.fuel?.map((stop, i) =>
                stop.location ? (
                  <Marker
                    key={`fuel-${i}`}
                    ref={(node) => {
                      if (node) fuelMarkerRefs.current.set(i, node);
                      else fuelMarkerRefs.current.delete(i);
                    }}
                    position={[stop.location.lat, stop.location.lng]}
                    icon={fuelStopIcon(i, stop.mile_marker)}
                  >
                    <Popup {...ROUTE_SITE_POPUP_PROPS}>
                      <FuelPopupBody mileMarker={stop.mile_marker} />
                    </Popup>
                  </Marker>
                ) : null,
              )}

              {stops?.rest?.map((stop, i) =>
                stop.location ? (
                  <Marker
                    key={`rest-${i}`}
                    position={[stop.location.lat, stop.location.lng]}
                  >
                    <Popup {...ROUTE_SITE_POPUP_PROPS}>
                      Rest Stop after {stop.after_hours ?? 0}h driving
                    </Popup>
                  </Marker>
                ) : null,
              )}
            </>
          )}
        </MapContainer>

        <aside className={`route-stats${!hasRoute ? " route-stats--muted" : ""}`}>
          <p>
            <strong>
              <IconRuler className="route-stats-icon" />
              <span>Distance</span>
            </strong>
            <span>{hasRoute ? `${milesUi} mi` : "—"}</span>
          </p>
          <p>
            <strong>
              <IconClock className="route-stats-icon" />
              <span>Duration</span>
            </strong>
            <span>{hasRoute ? `${hoursUi.toFixed(1)} h` : "—"}</span>
          </p>
          <p>
            <strong>
              <IconListTree className="route-stats-icon" />
              <span>Segments</span>
            </strong>
            <span>{hasRoute ? segmentsUi : "—"}</span>
          </p>
        </aside>
      </div>
    </section>
  );
}
