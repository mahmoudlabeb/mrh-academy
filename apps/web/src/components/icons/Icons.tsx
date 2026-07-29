import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Sun icon — used for switching to light mode */
export function SunIcon(props: IconProps) {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

/** Moon icon — used for switching to dark mode */
export function MoonIcon(props: IconProps) {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

/** Hamburger menu icon */
export function MenuIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

/** Close (X) icon */
export function CloseIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function BaseIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </BaseIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3h6m-9 4h12m-10 0 .7 13h6.6L16 7M10 11v5m4-5v5"
      />
    </BaseIcon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 6v5h-5M4 18v-5h5m9.5-2A7 7 0 0 0 6.1 7.5L4 11m16 2-2.1 3.5A7 7 0 0 1 5.5 13"
      />
    </BaseIcon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"
      />
    </BaseIcon>
  );
}

export function LessonIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3m10-3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5ZM12 12v3l2 1"
      />
    </BaseIcon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4 12a7 7 0 0 0-14 0"
      />
    </BaseIcon>
  );
}

export function MoneyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m3-9.5c-.7-.9-1.8-1.5-3-1.5-1.7 0-3 1-3 2.4 0 3.6 6 1.6 6 5.2 0 1.4-1.3 2.4-3 2.4-1.3 0-2.5-.6-3.2-1.6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </BaseIcon>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7.5h18m-16.5-3h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5ZM7 15h3"
      />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 3.5h3.4l.6 2.1 1.5.9 2.1-.5 1.7 3-1.5 1.6v1.8l1.5 1.6-1.7 3-2.1-.5-1.5.9-.6 2.1h-3.4l-.6-2.1-1.5-.9-2.1.5-1.7-3 1.5-1.6v-1.8L4.4 9l1.7-3 2.1.5 1.5-.9.6-2.1ZM15 11.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 8V5.5A2.5 2.5 0 0 0 11.5 3h-6A2.5 2.5 0 0 0 3 5.5v13A2.5 2.5 0 0 0 5.5 21h6a2.5 2.5 0 0 0 2.5-2.5V16m-3-4h10m0 0-3-3m3 3-3 3"
      />
    </BaseIcon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v5m0 3h.01M10.1 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.9 4.2a2 2 0 0 0-3.8 0Z"
      />
    </BaseIcon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
    </BaseIcon>
  );
}

export function BankIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9h18L12 3 3 9Zm2 3v6m4-6v6m6-6v6m4-6v6M3 21h18"
      />
    </BaseIcon>
  );
}
