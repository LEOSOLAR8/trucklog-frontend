import { useMemo, type CSSProperties } from "react";
import type { LogDay, Segment } from "../types/trip";
import "./ELD.css";

/** Labels from the trip form for on-duty remark lines (address or coordinates). */
export interface EldLocationLabels {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
}

interface Props {
  logs?: LogDay[];
  locationLabels?: EldLocationLabels;
}

const SVG_W = 480;
const ROW_H = 28;
const SVG_H = ROW_H * 4;

const ROW_ORDER = [
  "off_duty",
  "sleeper",
  "driving",
  "on_duty",
] as const;

type EldRow = (typeof ROW_ORDER)[number];

const ROW_LABELS: Record<EldRow, string> = {
  off_duty: "OFF DUTY",
  sleeper: "SLEEPER BERTH",
  driving: "DRIVING",
  on_duty: "ON DUTY (NOT DRIVING)",
};

const ROW_STROKE: Record<EldRow, string> = {
  off_duty: "#64748b",
  sleeper: "#2563eb",
  driving: "#15803d",
  on_duty: "#c2410c",
};

/** Horizontal rules between the four status bands (matches `.eld-line` tone). */
const ROW_GRID_STROKE = "rgba(196, 30, 58, 0.42)";

function segmentRow(t: Segment["type"]): EldRow {
  if (t === "break") return "off_duty";
  if (t === "sleeper") return "sleeper";
  if (t === "driving") return "driving";
  if (t === "on_duty") return "on_duty";
  return "off_duty";
}

function yCenterRow(rowIdx: number): number {
  return ROW_H * (rowIdx + 0.5);
}

function formatClockFromHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

function segmentLineTitle(seg: Segment, t0: number, t1: number): string {
  const row = ROW_LABELS[segmentRow(seg.type)];
  const span = Math.round((t1 - t0) * 60);
  if (seg.duty_kind === "pretrip") {
    return `Pre-trip — ${span} min (${formatClockFromHours(t0)}–${formatClockFromHours(t1)})`;
  }
  if (seg.duty_kind === "pickup") {
    return `Pickup — ${span} min (${formatClockFromHours(t0)}–${formatClockFromHours(t1)})`;
  }
  if (seg.duty_kind === "unload") {
    return `Dropoff — ${span} min (${formatClockFromHours(t0)}–${formatClockFromHours(t1)})`;
  }
  return `${row} (${formatClockFromHours(t0)}–${formatClockFromHours(t1)})`;
}

interface TimelinePiece {
  seg: Segment;
  t0: number;
  t1: number;
  rowIdx: number;
  rowKey: EldRow;
}

function buildPieces(segments: Segment[]): TimelinePiece[] {
  let t = 0;
  const out: TimelinePiece[] = [];
  for (const seg of segments) {
    const rowKey = segmentRow(seg.type);
    const rowIdx = ROW_ORDER.indexOf(rowKey);
    out.push({
      seg,
      t0: t,
      t1: t + seg.hours,
      rowIdx,
      rowKey,
    });
    t += seg.hours;
  }
  return out;
}

function hoursPerRow(segments: Segment[]): Record<EldRow, number> {
  const acc: Record<EldRow, number> = {
    off_duty: 0,
    sleeper: 0,
    driving: 0,
    on_duty: 0,
  };
  for (const seg of segments) {
    acc[segmentRow(seg.type)] += seg.hours;
  }
  return acc;
}

function formatTotalHours(hours: number): string {
  if (hours <= 0) return "";
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatHourEndLabel(h: number): string {
  const end = h + 1;
  if (end === 12) return "N.";
  if (end === 24) return "12";
  if (end < 12) return String(end);
  return String(end - 12);
}

function EldDutySummary({ segments }: { segments: Segment[] }) {
  const bits = segments.filter((s) => s.duty_kind);
  if (bits.length === 0) return null;
  const text = bits.map((s) => {
    const min = Math.round(s.hours * 60);
    if (s.duty_kind === "pretrip") {
      return `Pre-trip ${min} min (on-duty)`;
    }
    if (s.duty_kind === "pickup") {
      return `Pickup ${min} min (on-duty)`;
    }
    return `Drop-off ${min} min (on-duty)`;
  });
  return (
    <p className="eld-duty-callouts muted" aria-label="On-duty specials">
      <span className="eld-duty-chip">{text.join(" · ")}</span>
    </p>
  );
}

function EldTimelineSvg({ segments }: { segments: Segment[] }) {
  const pieces = useMemo(() => buildPieces(segments), [segments]);

  return (
    <svg
      className="eld-timeline-svg"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <g className="eld-row-grid">
        {[1, 2, 3].map((k) => (
          <line
            key={`row-sep-${k}`}
            x1={0}
            y1={ROW_H * k}
            x2={SVG_W}
            y2={ROW_H * k}
            stroke={ROW_GRID_STROKE}
            strokeWidth={1}
          />
        ))}
      </g>
      {pieces.map((p, i) => {
        const y = yCenterRow(p.rowIdx);
        const x0 = (p.t0 / 24) * SVG_W;
        const x1 = (p.t1 / 24) * SVG_W;
        const stroke = ROW_STROKE[p.rowKey];
        return (
          <line
            key={`seg-h-${i}`}
            x1={x0}
            y1={y}
            x2={x1}
            y2={y}
            stroke={stroke}
            strokeWidth={4}
            strokeLinecap="round"
          >
            <title>{segmentLineTitle(p.seg, p.t0, p.t1)}</title>
          </line>
        );
      })}
      {pieces.slice(0, -1).map((p, i) => {
        const q = pieces[i + 1]!;
        if (p.rowIdx === q.rowIdx) return null;
        const x = (p.t1 / 24) * SVG_W;
        const y0 = yCenterRow(p.rowIdx);
        const y1 = yCenterRow(q.rowIdx);
        const stroke = ROW_STROKE[p.rowKey];
        return (
          <line
            key={`seg-v-${i}`}
            x1={x}
            y1={y0}
            x2={x}
            y2={y1}
            stroke={stroke}
            strokeWidth={4}
            strokeLinecap="round"
          >
            <title>Status change at {formatClockFromHours(p.t1)}</title>
          </line>
        );
      })}
    </svg>
  );
}

const HEADER_ROW = 1;
const BODY_START_ROW = HEADER_ROW + 1;

interface OnDutyRemark {
  t0: number;
  t1: number;
  text: string;
}

function collectOnDutyRemarks(
  segments: Segment[],
  labels: EldLocationLabels,
): OnDutyRemark[] {
  const pieces = buildPieces(segments);
  const out: OnDutyRemark[] = [];
  for (const p of pieces) {
    if (p.seg.type !== "on_duty") continue;
    const dk = p.seg.duty_kind;
    let text: string;
    if (dk === "pretrip") {
      text = `${labels.current_location} — Pre-trip / TIV`;
    } else if (dk === "pickup") {
      text = `${labels.pickup_location} — Pickup`;
    } else if (dk === "unload") {
      text = `${labels.dropoff_location} — Drop-off`;
    } else {
      text = "On duty (not driving)";
    }
    out.push({ t0: p.t0, t1: p.t1, text });
  }
  return out;
}

function EldOnDutyRemarks({
  segments,
  labels,
}: {
  segments: Segment[];
  labels: EldLocationLabels;
}) {
  const entries = useMemo(
    () => collectOnDutyRemarks(segments, labels),
    [segments, labels],
  );

  if (entries.length === 0) {
    return (
      <div
        className="eld-remarks-row eld-remarks-row--empty"
        aria-label="On-duty remarks"
      >
        <div className="eld-remarks-label" role="rowheader">
          Remarks
        </div>
        <div className="eld-remarks-track-wrap">
          <p className="eld-remarks-none muted">No on-duty (N/D) segments this day.</p>
        </div>
        <div className="eld-remarks-total-spacer" aria-hidden />
      </div>
    );
  }

  return (
    <div className="eld-remarks-row" aria-label="On-duty remarks">
      <div className="eld-remarks-label" role="rowheader">
        Remarks
      </div>
      <div className="eld-remarks-track-wrap">
        <div className="eld-remarks-track" role="list">
          {entries.map((e, i) => (
            <div
              key={`${e.t0}-${i}`}
              className="eld-remark-item"
              role="listitem"
              style={
                {
                  "--eld-r-left": `${(e.t0 / 24) * 100}%`,
                  "--eld-r-span": `${((e.t1 - e.t0) / 24) * 100}%`,
                } as CSSProperties
              }
            >
              <span className="eld-remark-text">{e.text}</span>
              <span className="eld-remark-time" aria-hidden>
                {formatClockFromHours(e.t0)}–{formatClockFromHours(e.t1)} 
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="eld-remarks-total-spacer" aria-hidden />
    </div>
  );
}

export default function ELDLogs({ logs, locationLabels }: Props) {
  if (!logs) return null;

  return (
    <div className="card eld-card">
      <h3>ELD Log Sheets</h3>

      {logs.map((log, logIndex) => {
        const totals = hoursPerRow(log.segments);

        return (
          <div key={`${log.day}-${logIndex}`} className="eld-day">
            <h4 className="eld-day-title">
              Day {log.day}
              {log.calendar_date ? ` — ${log.calendar_date}` : ""}
              {log.note ? ` — ${log.note}` : ""}
            </h4>
            <EldDutySummary segments={log.segments} />
            {log.summary && (
              <p className="eld-summary">
                Drive {log.summary.drive_hours}h · On-duty (14h clock){" "}
                {log.summary.duty_hours}h · Cycle {log.summary.cycle_total}h
              </p>
            )}

            <div className="eld-day-paper">
            <div
              className={`eld-sheet${locationLabels ? " eld-sheet--stacked" : ""}`}
              role="table"
              aria-label={`ELD grid day ${log.day}`}
            >
              <div className="eld-corner" aria-hidden />
              <div className="eld-time-axis" role="row">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div key={hour} className="eld-hour-block">
                    <span className="eld-hour-label">{formatHourEndLabel(hour)}</span>
                    <div className="eld-half-row" aria-hidden>
                      {[0, 1].map((q) => (
                        <span key={q} className="eld-qtr-mark" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="eld-total-hdr" role="columnheader">
                Total
                <span className="eld-total-hdr-sub">hours</span>
              </div>

              {ROW_ORDER.map((row, idx) => (
                <div
                  key={row}
                  className="eld-row-label"
                  role="rowheader"
                  style={{ gridColumn: 1, gridRow: BODY_START_ROW + idx }}
                >
                  <span className="eld-row-num">{idx + 1}</span>
                  <span className="eld-row-name">{ROW_LABELS[row]}</span>
                </div>
              ))}

              <div
                className="eld-timeline-pane"
                style={{ gridColumn: 2, gridRow: `${BODY_START_ROW} / ${BODY_START_ROW + ROW_ORDER.length}` }}
              >
                <div className="eld-timeline-bg" aria-hidden>
                  {Array.from({ length: 48 }).map((_, s) => (
                    <div key={s} className="eld-bg-slot" />
                  ))}
                </div>
                <EldTimelineSvg segments={log.segments} />
              </div>

              {ROW_ORDER.map((row, idx) => (
                <div
                  key={`tot-${row}`}
                  className="eld-total-cell"
                  role="cell"
                  style={{ gridColumn: 3, gridRow: BODY_START_ROW + idx }}
                >
                  {formatTotalHours(totals[row])}
                </div>
              ))}
            </div>
            {locationLabels ? (
              <EldOnDutyRemarks segments={log.segments} labels={locationLabels} />
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
