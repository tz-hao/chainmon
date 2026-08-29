import type { RiftNodeType } from "@/lib/rift/types";

interface RiftIconProps {
  type: RiftNodeType | "rift" | "team" | "signal" | "capsule" | "lock";
  className?: string;
}

export function RiftIcon({ type, className = "h-5 w-5" }: RiftIconProps) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "battle" || type === "elite" || type === "boss") {
    return (
      <svg {...common}>
        <path d="m5 3 6 6-2 2-6-6V3h2Z" />
        <path d="m19 3-6 6 2 2 6-6V3h-2Z" />
        <path d="m8 12-5 5 4 4 5-5" />
        <path d="m16 12 5 5-4 4-5-5" />
        {type !== "battle" ? <path d="M9 4h6l-1 3h-4L9 4Z" /> : null}
      </svg>
    );
  }
  if (type === "capture" || type === "capsule") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h5m6 0h5" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (type === "protocol-event" || type === "signal") {
    return (
      <svg {...common}>
        <path d="M4 17c2.5-5 4.5-5 7-1s4.5 4 9-5" />
        <path d="M4 8c2-3 4-3 6 0s4 3 7-1" />
        <circle cx="4" cy="17" r="1" fill="currentColor" stroke="none" />
        <circle cx="20" cy="11" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === "rest") {
    return (
      <svg {...common}>
        <path d="M6 19h12" />
        <path d="M8 19v-7a4 4 0 0 1 8 0v7" />
        <path d="M10 7V4m4 3V4" />
      </svg>
    );
  }
  if (type === "team") {
    return (
      <svg {...common}>
        <circle cx="8" cy="9" r="3" />
        <circle cx="17" cy="8" r="2" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2" />
        <path d="M14 14a4 4 0 0 1 7 3v2" />
      </svg>
    );
  }
  if (type === "lock") {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 2 5 6v8l7 8 7-8V6l-7-4Z" />
      <path d="m12 6-3 5 3 7 3-7-3-5Z" />
    </svg>
  );
}
