'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { useInboxStats, type StatsPeriod } from '@/hooks/useInboxStats';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

function hourLabel(h: number) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return 'No replies yet';
  if (minutes < 1) return 'Under 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes / (24 * 60))}d`;
}

type Tone = 'good' | 'ok' | 'bad';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  ok: 'text-warning',
  bad: 'text-danger',
};

// Green when fast, amber when slowish, red when customers are left waiting
function replyTimeTone(minutes: number | null): Tone | undefined {
  if (minutes === null) return undefined;
  return minutes <= 30 ? 'good' : minutes <= 180 ? 'ok' : 'bad';
}

function replyRateTone(rate: number | null): Tone | undefined {
  if (rate === null) return undefined;
  return rate >= 80 ? 'good' : rate >= 50 ? 'ok' : 'bad';
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <div className="bg-surface p-4 md:p-5">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p
        className={clsx(
          'mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums md:text-[30px]',
          tone && TONE_TEXT[tone]
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-ink-faint">{note}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('7d');
  const { stats, loading } = useInboxStats(BUSINESS_ID, period);

  const maxHourly = stats ? Math.max(1, ...stats.hourly) : 1;
  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => Math.max(d.received, d.replied))) : 1;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:h-16 md:flex-row md:items-center md:justify-between md:px-6 md:py-0">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Analytics</h1>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-raised p-1 md:flex" role="tablist" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                period === p.key ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(22,22,26,0.10)]' : 'text-ink-muted hover:text-ink'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pt-5 pb-tabbar md:px-6 md:pt-6">
        {loading || !stats ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-8">
            {/* Headline numbers, in one panel split by hairlines */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
              <Stat
                label="Messages received"
                value={String(stats.received)}
                note={stats.people === 1 ? 'From 1 person' : `From ${stats.people} people`}
              />
              <Stat
                label="Replies sent"
                value={String(stats.replied)}
                note={stats.autoReplied > 0 ? `${stats.autoReplied} by auto-reply` : 'By you and your team'}
              />
              <Stat
                label="Typical reply time"
                value={formatDuration(stats.medianResponseMinutes)}
                note="From their message to your reply"
              />
              <Stat
                label="Reply rate"
                value={stats.replyRate === null ? 'None yet' : `${stats.replyRate}%`}
                note="Of people who messaged got a reply"
              />
              <Stat
                label="Typical reply time"
                value={formatDuration(stats.medianResponseMinutes)}
                note="From their message to your reply"
                tone={replyTimeTone(stats.medianResponseMinutes)}
              />
              <Stat
                label="Reply rate"
                value={stats.replyRate === null ? 'None yet' : `${stats.replyRate}%`}
                note="Of people who messaged got a reply"
                tone={replyRateTone(stats.replyRate)}
              />
            </div>

            {stats.received === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-muted">
                No customer messages in this period yet. Charts will fill in as messages arrive.
              </p>
            ) : (
              <>
                {/* When customers message */}
                <section>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">When customers message you</h2>
                    {stats.busiestHour !== null && (
                      <p className="text-[13px] text-ink-muted">
                        Busiest around {hourLabel(stats.busiestHour)}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex h-40 items-end gap-[3px] md:gap-1">
                    {stats.hourly.map((count, h) => (
                      <div
                        key={h}
                        title={`${hourLabel(h)}: ${count} ${count === 1 ? 'message' : 'messages'}`}
                        className="flex h-full flex-1 items-end"
                      >
                        <div
                          className={clsx(
                            'w-full rounded-t-[3px]',
                            h === stats.busiestHour ? 'bg-ink' : count > 0 ? 'bg-ink-faint' : 'bg-surface-overlay'
                          )}
                          style={{ height: count > 0 ? `${Math.max(6, (count / maxHourly) * 100)}%` : '3px' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                    <span>11pm</span>
                  </div>
                </section>

                {/* Day by day */}
                {period !== 'today' && (
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold">Day by day</h2>
                      <div className="flex items-center gap-4 text-[13px] text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-ink" />
                          Received
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-ink-faint" />
                          Replied
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex h-40 items-end gap-1 md:gap-2">
                      {stats.daily.map((d) => (
                        <div
                          key={d.date}
                          title={`${new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${d.received} received, ${d.replied} replied`}
                          className="flex h-full flex-1 items-end justify-center gap-px"
                        >
                          <div
                            className="w-1/2 max-w-[14px] rounded-t-[3px] bg-ink"
                            style={{ height: d.received ? `${Math.max(4, (d.received / maxDaily) * 100)}%` : '2px' }}
                          />
                          <div
                            className="w-1/2 max-w-[14px] rounded-t-[3px] bg-ink-faint"
                            style={{ height: d.replied ? `${Math.max(4, (d.replied / maxDaily) * 100)}%` : '2px' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1 text-[11px] text-ink-faint md:gap-2">
                      {stats.daily.map((d, i) => {
                        const date = new Date(d.date);
                        const show = period === '7d' || i % 5 === 0 || i === stats.daily.length - 1;
                        return (
                          <span key={d.date} className="flex-1 text-center">
                            {show
                              ? period === '7d'
                                ? date.toLocaleDateString('en-GB', { weekday: 'short' })
                                : date.getDate()
                              : ''}
                          </span>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}