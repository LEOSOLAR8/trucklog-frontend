const NAME_KEY = "trucklog_driver_name";
const DATE_KEY = "trucklog_log_date";
const DUTY_KEY = "trucklog_duty_start";

export function defaultLogDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultDutyStartTime(): string {
  return "06:00";
}

export function loadDriverProfile(): {
  name: string;
  logDate: string;
  dutyStartTime: string;
} {
  try {
    const name = localStorage.getItem(NAME_KEY) ?? "";
    const storedDate = localStorage.getItem(DATE_KEY);
    const logDate =
      storedDate && storedDate.length >= 10 ? storedDate : defaultLogDateIso();
    const dutyRaw = localStorage.getItem(DUTY_KEY)?.trim();
    const dutyStartTime =
      dutyRaw && /^\d{1,2}:\d{2}/.test(dutyRaw) ? dutyRaw.slice(0, 5) : defaultDutyStartTime();
    return { name, logDate, dutyStartTime };
  } catch {
    return {
      name: "",
      logDate: defaultLogDateIso(),
      dutyStartTime: defaultDutyStartTime(),
    };
  }
}

export function saveDriverProfile(
  name: string,
  logDate: string,
  dutyStartTime: string,
): void {
  try {
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(DATE_KEY, logDate);
    localStorage.setItem(DUTY_KEY, dutyStartTime);
  } catch {
    /* ignore quota / private mode */
  }
}
