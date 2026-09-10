/**
 * "Plus is active" is worth more than an OS alert.
 *
 * A purchase can complete on the Plus screen, from a restore on the profile, or
 * while the app is somewhere else entirely, so the moment is announced through a
 * tiny emitter and drawn by one host mounted at the root — the same shape as the
 * popup host. No component needs to know where the purchase happened.
 */
type Listener = (title: string, body: string) => void;

const listeners = new Set<Listener>();

export function onCelebrate(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fire the confetti. Safe to call from anywhere, including outside React. */
export function celebrate(title: string, body: string): void {
  for (const fn of listeners) fn(title, body);
}
