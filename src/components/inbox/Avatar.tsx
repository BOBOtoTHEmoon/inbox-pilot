'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

// Instagram profile photo, falling back to initials when there is no photo
// or the photo link has expired
export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const clean = (name || '').replace(/[^\p{L}\p{N} ._]/gu, '').trim();
  const initials =
    clean
      .split(/[\s._]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';

  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-full object-cover bg-surface-overlay', className)}
      />
    );
  }

  return (
    <div
      style={style}
      aria-hidden="true"
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-overlay font-medium text-ink-muted',
        className
      )}
    >
      {initials}
    </div>
  );
}