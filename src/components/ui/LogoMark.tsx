// InboxPilot mark: a speech bubble with a small "sent" tick cut into it
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v5a3.5 3.5 0 0 1-3.5 3.5H15l-4.2 3.2c-.5.4-1.3 0-1.3-.6V20.6A3.5 3.5 0 0 1 9 17.5z"
        fill="#fff"
      />
      <path
        d="m12.8 14.2 2 2 4.4-4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}