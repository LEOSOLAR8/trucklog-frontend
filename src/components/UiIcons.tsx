import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function SvgIcon({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconRoute({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h3.5a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h6" />
    </SvgIcon>
  );
}

export function IconNavigation({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 2 5 21l7-4 7 4-7-19Z" />
    </SvgIcon>
  );
}

export function IconPackageCheck({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="m9 16 2 2 4-5" />
    </SvgIcon>
  );
}

export function IconFlag({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M5 22V3" />
      <path d="M5 3h12l-2 5 2 5H5" />
    </SvgIcon>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </SvgIcon>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </SvgIcon>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </SvgIcon>
  );
}

export function IconGauge({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 14l4-4" />
      <path d="M6.5 19h11" />
    </SvgIcon>
  );
}

export function IconTruck({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h3l4 4v2h-7z" />
      <path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M7 17h8" />
    </SvgIcon>
  );
}

export function IconRuler({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 19 19 4l1 5-11 11-5-1Z" />
      <path d="m9 14 2 2" />
      <path d="m12 11 2 2" />
      <path d="m15 8 2 2" />
    </SvgIcon>
  );
}

export function IconListTree({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M6 4v16" />
      <path d="M6 7h6" />
      <path d="M6 12h10" />
      <path d="M6 17h14" />
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="6" cy="17" r="2" />
    </SvgIcon>
  );
}
