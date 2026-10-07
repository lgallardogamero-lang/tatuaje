export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Calco">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M4 20 L13 4 L22 20 Z" stroke="#a58bff" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8.5 20 L13 12 L17.5 20" stroke="#ece7dc" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="13" cy="4" r="1.6" fill="#a58bff" />
      </svg>
      <span className="display text-[1.55rem] leading-none text-bone">Calco</span>
    </span>
  );
}
