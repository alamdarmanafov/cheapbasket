export function LogoMark({ size = 39 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#E53935" />
      <path d="M66 30 H46 C33 30 24 39 24 51 C24 63 33 70 46 70 H70 L78 62" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="42" cy="82" r="5.5" fill="#fff" />
      <circle cx="62" cy="82" r="5.5" fill="#fff" />
      <path d="M61 44 L71 34 L80 34 L80 43 L70 53 Z" fill="#fff" />
      <circle cx="75" cy="39" r="2.2" fill="#E53935" />
    </svg>
  );
}

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Cheap Market">
      <LogoMark />
      <span>
        Cheap
        <br />
        <b>Market</b>
      </span>
    </a>
  );
}
