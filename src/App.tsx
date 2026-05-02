import { useState } from "react";

import DriverInfoCard from "./components/DriverInfoCard";
import TripForm from "./components/TripForm";
import RouteMap from "./components/RouteMap";
import ELDLogs from "./components/ELDLogs";
import { IconTruck } from "./components/UiIcons";
import { planTrip } from "./api/tripApi";
import {
  type LocationFieldKey,
  type TripLocationsRequest,
  type TripPlanRequest,
  type TripResponse,
  uiLocationRemarkPlace,
} from "./types/trip";
import { emptyUiLocation } from "./types/trip";
import { loadDriverProfile } from "./utils/driverProfileStorage";

import "./App.css";

const formatHours = (hours: number) => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${minutes.toString().padStart(2, "0")}m`;
};

const initialDriver = loadDriverProfile();

function App() {
  const [data, setData] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [driverName, setDriverName] = useState(initialDriver.name);
  const [logDate, setLogDate] = useState(initialDriver.logDate);
  const [dutyStartTime, setDutyStartTime] = useState(initialDriver.dutyStartTime);

  const [locations, setLocations] = useState({
    current_location: emptyUiLocation(),
    pickup_location: emptyUiLocation(),
    dropoff_location: emptyUiLocation(),
  });
  const [cycleUsed, setCycleUsed] = useState(0);
  const [pickTarget, setPickTarget] = useState<LocationFieldKey | null>(null);
  /** Bumps only after a successful Create (planTrip) so route replay runs once per planned trip. */
  const [routeTrackingReplayKey, setRouteTrackingReplayKey] = useState(0);

  const handleMapPick = (lat: number, lng: number) => {
    if (!pickTarget) return;
    setLocations((prev) => ({
      ...prev,
      [pickTarget]: { source: "map", lat, lng },
    }));
    setPickTarget(null);
  };

  const handleTripFormSubmit = async (base: TripLocationsRequest) => {
    const dutyNorm =
      dutyStartTime.length >= 5 ? dutyStartTime.slice(0, 5) : dutyStartTime;
    const body: TripPlanRequest = {
      ...base,
      driver_name: driverName.trim(),
      log_date: logDate,
      duty_start_time: dutyNorm,
    };
    await handleSubmit(body);
  };

  const handleSubmit = async (payload: TripPlanRequest) => {
    try {
      setLoading(true);
      const res = await planTrip(payload);
      setData(res);
      setRouteTrackingReplayKey((k) => k + 1);
      if (res.driver) {
        setLogDate(res.driver.log_date);
        const ds = res.driver.duty_start_time;
        setDutyStartTime(ds.length >= 5 ? ds.slice(0, 5) : ds);
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Error fetching trip";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const driveHours =
    data?.logs.reduce((sum, day) => sum + (day.summary?.drive_hours ?? 0), 0) ?? 0;
  const dutyHours =
    data?.logs.reduce((sum, day) => sum + (day.summary?.duty_hours ?? 0), 0) ?? 0;
  const violations = data?.logs.filter((day) => day.note).length ?? 0;

  return (
    <div className="app-shell">
      <div className="app-workspace">
        <header
          className="app-topnav"
        >
          <h1 className="app-topnav-center">
            <IconTruck className="app-title-icon" />
            <span>Driver's Daily Log</span>
          </h1>
        </header>

        <div className="dashboard">
          <aside className="sidebar">
            <div className="sidebar-top">
              <DriverInfoCard
                driverName={driverName}
                logDate={logDate}
                dutyStartTime={dutyStartTime}
                onDriverNameChange={setDriverName}
                onLogDateChange={setLogDate}
                onDutyStartTimeChange={setDutyStartTime}
              />
            </div>
            <div className="sidebar-scroll">
              <TripForm
                locations={locations}
                onLocationChange={(key, loc) =>
                  setLocations((prev) => ({ ...prev, [key]: loc }))
                }
                pickTarget={pickTarget}
                onPickTargetChange={setPickTarget}
                cycleUsed={cycleUsed}
                onCycleUsedChange={setCycleUsed}
                loading={loading}
                onSubmitPayload={handleTripFormSubmit}
              />

              {data && (
                <section className="card">
                  <h2>Trip Summary</h2>
                  <dl className="summary-list">
                    <div>
                      <dt>Total Distance</dt>
                      <dd>{Math.round(data.summary.total_distance_miles)} mi</dd>
                    </div>
                    <div>
                      <dt>Total Duration (Est.)</dt>
                      <dd>{formatHours(data.summary.estimated_travel_hours)}</dd>
                    </div>
                    <div>
                      <dt>Total Days</dt>
                      <dd>{data.summary.required_days}</dd>
                    </div>
                    <div>
                      <dt>Driving Hours</dt>
                      <dd>{formatHours(driveHours)}</dd>
                    </div>
                    <div>
                      <dt>On Duty Hours</dt>
                      <dd>{formatHours(dutyHours)}</dd>
                    </div>
                    <div>
                      <dt>Violations</dt>
                      <dd className={violations > 0 ? "bad" : "good"}>{violations}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </div>
          </aside>

          <main className="content">
            <RouteMap
              route={data?.route}
              stops={data?.stops}
              planLocations={locations}
              pickTarget={pickTarget}
              onMapLocationPick={handleMapPick}
              routeTrackingReplayKey={routeTrackingReplayKey}
            />
            {data && (
              <div className="bottom-grid">
                <ELDLogs
                  logs={data.logs}
                  locationLabels={{
                    current_location: uiLocationRemarkPlace(locations.current_location),
                    pickup_location: uiLocationRemarkPlace(locations.pickup_location),
                    dropoff_location: uiLocationRemarkPlace(locations.dropoff_location),
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;

