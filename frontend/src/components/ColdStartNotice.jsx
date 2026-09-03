import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { onBackendWaking } from '../lib/api';

/**
 * Explains a slow first request instead of letting it look like a broken site.
 *
 * The API sleeps on Render's free tier and takes 30-60s to wake. Without this,
 * a first-time visitor gets an empty catalogue and a spinner for the better
 * part of a minute and reasonably assumes the thing is dead - the single worst
 * first impression this project can make, and one that costs nothing to fix.
 *
 * It only appears when a request has genuinely been slow (see the latency
 * watch in lib/api.js), so a warm server never shows it.
 */
export default function ColdStartNotice() {
  const [waking, setWaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => onBackendWaking(setWaking), []);

  // A counter that visibly moves is what separates "still working" from
  // "frozen". Without it, a static message reads as stuck.
  useEffect(() => {
    if (!waking) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [waking]);

  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 animate-slide-up"
    >
      <div className="flex items-start gap-3 rounded-xl border border-neutral-300 bg-neutral-200 px-4 py-3 shadow-raised-lg">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary-400" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-neutral-950">Waking the server up…</p>
          <p className="mt-0.5 text-neutral-600">
            The API sleeps on a free hosting tier. The first request after a quiet
            spell takes up to a minute — everything is fast once it is awake.
          </p>
          {elapsed >= 5 && (
            <p className="mt-1 font-mono text-xs text-neutral-500">{elapsed}s elapsed</p>
          )}
        </div>
      </div>
    </div>
  );
}
