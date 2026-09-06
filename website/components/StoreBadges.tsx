/** App Store / Google Play badges. Replace hrefs with the real listing URLs after launch. */
export function StoreBadges({ appStore, googlePlay, dark = true }: { appStore: string; googlePlay: string; dark?: boolean }) {
  return (
    <div className={`store-buttons${dark ? '' : ' light'}`}>
      <a href={appStore} aria-label="App Store">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16.36 12.64c0-2.4 1.97-3.55 2.06-3.6-1.12-1.64-2.87-1.86-3.49-1.89-1.49-.15-2.9.87-3.65.87-.76 0-1.92-.85-3.15-.83-1.62.02-3.12.94-3.95 2.39-1.69 2.93-.43 7.26 1.21 9.63.8 1.16 1.75 2.46 3 2.41 1.21-.05 1.66-.78 3.12-.78s1.87.78 3.14.76c1.3-.02 2.12-1.18 2.91-2.35.92-1.34 1.3-2.65 1.32-2.72-.03-.01-2.53-.97-2.52-3.89zM13.96 5.6c.66-.8 1.11-1.92.99-3.03-.96.04-2.11.64-2.8 1.44-.61.71-1.15 1.85-1.01 2.94 1.07.08 2.16-.54 2.82-1.35z" />
        </svg>
        <span>
          <small>Download on the</small>App Store
        </span>
      </a>
      <a href={googlePlay} aria-label="Google Play">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l.1.1 9.2-9.2v-.2L3.7 2.3l-.1.1z" fill="#34A853" />
          <path d="M16 15.6l-3.1-3.1v-.2l3.1-3.1.1.1 3.6 2.1c1 .6 1 1.6 0 2.2L16 15.6z" fill="#FBBC04" />
          <path d="M16.1 15.5L12.9 12.3 3.6 21.6c.3.4.9.4 1.5.1l11-6.2" fill="#EA4335" />
          <path d="M16.1 8.5L5.1 2.3c-.6-.4-1.2-.3-1.5.1l9.3 9.3 3.2-3.2z" fill="#4285F4" />
        </svg>
        <span>
          <small>GET IT ON</small>Google Play
        </span>
      </a>
    </div>
  );
}
