import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting. Without it the first news of a crash in the field is a
 * one-star review. Off entirely until a DSN is configured, so development
 * builds and the web preview never report anything.
 *
 * Set EXPO_PUBLIC_SENTRY_DSN in EAS environment variables (production) to
 * turn it on. Symbolicated native stack traces additionally need the
 * `@sentry/react-native/expo` config plugin with the org/project and a
 * SENTRY_AUTH_TOKEN at build time — see the note in app.json.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const monitoringEnabled = !!DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // A tenth of sessions is plenty for performance data on a small app and
    // keeps the free quota for the errors, which are what matter.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/** Ties reports to the account without sending anything personal. */
export function setMonitoredUser(id: string | null): void {
  if (!DSN) return;
  Sentry.setUser(id ? { id } : null);
}

/** Wraps the root component so render errors are caught and reported. */
export function withMonitoring(component: React.ComponentType<Record<string, unknown>>): React.ComponentType<Record<string, unknown>> {
  return DSN ? Sentry.wrap(component) : component;
}
