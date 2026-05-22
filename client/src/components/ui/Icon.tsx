import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function baseProps({ size = 24, strokeWidth, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: strokeWidth ?? 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
}

/** Magnifier with question mark — "not found / search". */
export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M9.5 9.5a2 2 0 0 1 3.4 1.4c0 1-1.4 1.4-1.4 2.4" />
      <path d="M11.5 14.7v.05" />
    </svg>
  );
}

/** Padlock — "forbidden / restricted". */
export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

/** Cloud-off — "network error". */
export function CloudOffIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 3l18 18" />
      <path d="M17.5 17a4.5 4.5 0 0 0-1.1-8.86 6 6 0 0 0-10.94 1.39" />
      <path d="M5 13a4 4 0 0 0 1 7h10" />
    </svg>
  );
}

/** Alert triangle — "warning / invalid input". */
export function AlertIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Crown — for leaderboard first-place. Filled, not stroked. */
export function CrownIcon({ size = 48, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...rest}
    >
      <path d="M3 8 6 14l3-6 3 4 3-4 3 6 3-6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      <circle cx="3" cy="6" r="1.4" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="21" cy="6" r="1.4" />
    </svg>
  );
}

/** Hamburger menu — three lines. */
export function MenuIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

/** Close / X — pairs with MenuIcon for open mobile nav state. */
export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Generic info — fallback. */
export function InfoIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
    </svg>
  );
}
