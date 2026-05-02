import {
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  type LocationFieldKey,
  type TripLocationsRequest,
  type UiLocation,
  emptyUiLocation,
  formatUiLocationSecondary,
  isUiLocationReady,
  uiLocationToPayload,
} from "../types/trip";

interface Props {
  locations: Record<LocationFieldKey, UiLocation>;
  onLocationChange: (key: LocationFieldKey, loc: UiLocation) => void;
  pickTarget: LocationFieldKey | null;
  onPickTargetChange: (key: LocationFieldKey | null) => void;
  cycleUsed: number;
  onCycleUsedChange: (value: number) => void;
  loading?: boolean;
  onSubmitPayload: (payload: TripLocationsRequest) => void;
}

const LABELS: Record<LocationFieldKey, string> = {
  current_location: "Current location",
  pickup_location: "Pickup location",
  dropoff_location: "Drop-off location",
};

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M20 20l-3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M12 21c0 0 7-4.8 7-10.2C19 8.2 16.1 5 12 5S5 8.2 5 10.8C5 16.2 12 21 12 21z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}

function SubmitSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity={0.2}
      />
      <path
        d="M12 2a10 10 0 0110 10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TripForm({
  locations,
  onLocationChange,
  pickTarget,
  onPickTargetChange,
  cycleUsed,
  onCycleUsedChange,
  loading = false,
  onSubmitPayload,
}: Props) {
  const cycleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) {
      onCycleUsedChange(0);
      return;
    }
    onCycleUsedChange(Math.ceil(value * 2) / 2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();

    const keys: LocationFieldKey[] = [
      "current_location",
      "pickup_location",
      "dropoff_location",
    ];

    const missingUi = keys.find((key) => !isUiLocationReady(locations[key]));
    if (missingUi) {
      alert(`Please fill in or pick on the map for: ${LABELS[missingUi]}`);
      return;
    }

    onSubmitPayload({
      current_location: uiLocationToPayload(locations.current_location),
      pickup_location: uiLocationToPayload(locations.pickup_location),
      dropoff_location: uiLocationToPayload(locations.dropoff_location),
      cycle_used: cycleUsed,
    });
  };

  const locationRow = (key: LocationFieldKey) => {
    const loc = locations[key];
    const isPicking = pickTarget === key;

    return (
      <div key={key} className="location-field">
        <div className="location-field-header">
          <span id={`${key}-label`} className="location-field-label">
            {LABELS[key]}
          </span>
          <div
            className="input-mode-toggle location-mode-toggle"
            role="group"
            aria-label={`${LABELS[key]}: search or map`}
          >
            <button
              type="button"
              className={loc.source === "text" ? "active" : ""}
              aria-pressed={loc.source === "text"}
              onClick={() => {
                if (pickTarget === key) onPickTargetChange(null);
                onLocationChange(key, {
                  source: "text",
                  text: loc.source === "text" ? loc.text : "",
                });
              }}
            >
              <IconSearch className="location-mode-toggle__glyph" />
              <span>Search</span>
            </button>
            <button
              type="button"
              className={loc.source === "map" ? "active" : ""}
              aria-pressed={loc.source === "map"}
              onClick={() => {
                if (pickTarget === key) onPickTargetChange(null);
                onLocationChange(key, { source: "map" });
              }}
            >
              <IconMapPin className="location-mode-toggle__glyph" />
              <span>Map</span>
            </button>
          </div>
        </div>

        {loc.source === "text" ? (
          <div className="location-search-field">
            <span className="location-search-field__icon" aria-hidden>
              <IconSearch />
            </span>
            <input
              id={`${key}-input`}
              className="location-search-input"
              name={key}
              aria-labelledby={`${key}-label`}
              placeholder="Search city, address, or ZIP"
              autoComplete="street-address"
              value={loc.text}
              onChange={(e) =>
                onLocationChange(key, { source: "text", text: e.target.value })
              }
            />
            {loc.text ? (
              <button
                type="button"
                className="location-search-field__clear"
                aria-label="Clear search"
                onClick={() =>
                  onLocationChange(key, { source: "text", text: "" })
                }
              >
                ×
              </button>
            ) : null}
          </div>
        ) : (
          <div className="location-map-panel" aria-labelledby={`${key}-label`}>
            {isPicking ? (
              <div className="location-map-panel__active" role="status" aria-live="polite">
                <span className="location-map-panel__pulse" aria-hidden />
                <span>
                  Selection active — click the map to drop this pin. Press{" "}
                  <strong>Cancel</strong> to stop.
                </span>
              </div>
            ) : null}
            <div className="location-map-panel__body">
              <p className="location-map-summary muted">
                {isUiLocationReady(loc)
                  ? formatUiLocationSecondary(loc)
                  : "No pin yet — choose on map or switch to Search."}
              </p>
              <div className="location-map-panel__actions">
                <button
                  type="button"
                  className={isPicking ? "btn-pick active" : "btn-pick"}
                  onClick={() => onPickTargetChange(isPicking ? null : key)}
                >
                  {isPicking ? "Cancel" : "Choose on map"}
                </button>
                <button
                  type="button"
                  className="location-mode-switch-link"
                  onClick={() => {
                    if (pickTarget === key) onPickTargetChange(null);
                    onLocationChange(key, emptyUiLocation());
                  }}
                >
                  Use address search
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={submit} className="card">
      <h2>Trip planning</h2>

      {locationRow("current_location")}
      {locationRow("pickup_location")}
      {locationRow("dropoff_location")}

      <div className="location-field">
        <div className="location-field-header">
          <label htmlFor="cycle_used" className="location-field-label">
            Cycle used (hours)
          </label>
        </div>
        <input
          id="cycle_used"
          name="cycle_used"
          type="number"
          placeholder="0"
          step={0.5}
          min={0}
          value={Number.isNaN(cycleUsed) ? "" : cycleUsed}
          onChange={cycleChange}
        />
      </div>

      <div className="trip-form-submit-row">
        <button type="submit" disabled={loading} aria-busy={loading}>
          Generate Route
        </button>
        {loading ? (
          <span className="trip-form-submit-status" role="status" aria-live="polite">
            <SubmitSpinner className="trip-form-spinner" />
            <span className="trip-form-spinner-sr">Generating route…</span>
          </span>
        ) : null}
      </div>
    </form>
  );
}
