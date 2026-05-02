import { type ChangeEvent, useEffect } from "react";

import { saveDriverProfile } from "../utils/driverProfileStorage";

interface Props {
  driverName: string;
  logDate: string;
  dutyStartTime: string;
  onDriverNameChange: (value: string) => void;
  onLogDateChange: (value: string) => void;
  onDutyStartTimeChange: (value: string) => void;
}

export default function DriverInfoCard({
  driverName,
  logDate,
  dutyStartTime,
  onDriverNameChange,
  onLogDateChange,
  onDutyStartTimeChange,
}: Props) {
  useEffect(() => {
    saveDriverProfile(driverName, logDate, dutyStartTime);
  }, [driverName, logDate, dutyStartTime]);

  return (
    <section className="card driver-info-card" aria-label="Driver information">
      <h2>Driver</h2>
      <div className="location-field">
        <div className="location-field-header">
          <label htmlFor="driver_name" className="location-field-label">
            Driver name
          </label>
        </div>
        <input
          id="driver_name"
          name="driver_name"
          type="text"
          autoComplete="name"
          placeholder="Full name"
          value={driverName}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onDriverNameChange(e.target.value)
          }
        />
      </div>
      <div className="location-field">
        <div className="location-field-header">
          <label htmlFor="log_date" className="location-field-label">
            Log date
          </label>
        </div>
        <input
          id="log_date"
          name="log_date"
          type="date"
          value={logDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onLogDateChange(e.target.value)
          }
        />
      </div>
      <div className="location-field">
        <div className="location-field-header">
          <label htmlFor="duty_start_time" className="location-field-label">
            Duty start time
          </label>
        </div>
        <input
          id="duty_start_time"
          name="duty_start_time"
          type="time"
          step={60}
          value={dutyStartTime}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onDutyStartTimeChange(e.target.value)
          }
        />
      </div>
    </section>
  );
}
