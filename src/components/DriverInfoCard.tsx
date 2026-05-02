import { type ChangeEvent, useEffect } from "react";

import { saveDriverProfile } from "../utils/driverProfileStorage";
import {
  IconCalendar,
  IconClock,
  IconUser,
} from "./UiIcons";

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
      <h2 className="section-title">
        <IconUser className="section-title-icon" />
        <span>Driver</span>
      </h2>
      <div className="location-field">
        <div className="location-field-header">
          <label htmlFor="driver_name" className="location-field-label">
            <IconUser className="field-label-icon" />
            <span>Driver name</span>
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
            <IconCalendar className="field-label-icon" />
            <span>Log date</span>
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
            <IconClock className="field-label-icon" />
            <span>Duty start time</span>
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
