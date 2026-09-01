import { useId } from 'react';

/**
 * Brand mark: a key whose bow is pierced by a D-pad instead of the usual round
 * hole. The silhouette reads as a key; the cross is what makes it read as
 * gaming. Both are single bold shapes on purpose - an earlier version used a
 * round hole flanked by two thumbstick dots, and at header size those three
 * small shapes merged into an unreadable blob.
 *
 * Pass `title` to expose it to screen readers as a standalone image. Where the
 * mark sits next to the "KeyVault" wordmark it is decorative, so leave `title`
 * unset and it is hidden from assistive tech instead of read out twice.
 */
export default function Logo({ className = 'w-8 h-8', title }) {
  // Most pages render this twice (header and footer). Gradient ids are global
  // to the document, so without a per-instance id the two <defs> would collide
  // and every instance would paint with whichever one rendered last.
  const gradientId = `kv-logo-gradient-${useId()}`;

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#66c0f4" />
          <stop offset="100%" stopColor="#3bb6d0" />
        </linearGradient>
      </defs>

      {/* Bow, with the D-pad cross knocked out of it by the even-odd rule. */}
      <path
        fillRule="evenodd"
        fill={`url(#${gradientId})`}
        d="M 10 3 H 22 A 6 6 0 0 1 28 9 V 11 A 6 6 0 0 1 22 17 H 10 A 6 6 0 0 1 4 11 V 9 A 6 6 0 0 1 10 3 Z
           M 14.7 6.4 H 17.3 V 8.7 H 19.6 V 11.3 H 17.3 V 13.6 H 14.7 V 11.3 H 12.4 V 8.7 H 14.7 Z"
      />

      {/* Shaft and teeth, kept deliberately chunky so they still register
          once the mark is scaled down to 16px. */}
      <path
        fill={`url(#${gradientId})`}
        d="M 13.8 17 H 18.2 V 20.5 H 23 V 23 H 18.2 V 25.5 H 21.5 V 28 H 18.2 V 30 H 13.8 Z"
      />
    </svg>
  );
}
