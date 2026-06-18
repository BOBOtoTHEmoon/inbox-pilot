'use client';

import { useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  MessageSquare,
  Bot,
  UserCheck,
  TrendingUp,
  Mail,
  ShoppingBag,
  MessagesSquare,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

type Period = 'today' | '7d' | '30d';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const { summary, loading } = useAnalytics(BUSINESS_ID, period);

  if (loading || !summary) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const pieData = [
    { name: 'Bot', value: summary.total_bot_replies, color: '#8b5cf6' },
    { name: 'Human', value: summary.total_human_replies, color: '#2563eb' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <h1 className="text-sm font-semibold">Analytics</h1>
        <div className="flex gap-1">
          {(['today', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-accent-light text-accent'
                  : 'text-ink-muted hover:bg-surface-overlay'
              }`}
            >
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={MessageSquare}
            label="Messages Received"
            value={summary.total_messages_received}
            color="accent"
          />
          <StatCard
            icon={Bot}
            label="Bot Replies"
            value={summary.total_bot_replies}
            color="bot"
          />
          <StatCard
            icon={UserCheck}
            label="Human Replies"
            value={summary.total_human_replies}
            color="success"
          />
          <StatCard
            icon={TrendingUp}
            label="Automation Rate"
            value={`${summary.automation_rate}%`}
            color="warning"
          />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={MessagesSquare}
            label="Conversations Opened"
            value={summary.conversations_opened}
            color="accent"
          />
          <StatCard
            icon={Zap}
            label="Conversations Closed"
            value={summary.conversations_closed}
            color="success"
          />
          <StatCard
            icon={Mail}
            label="Emails Collected"
            value={summary.emails_collected}
            color="bot"
          />
          <StatCard
            icon={ShoppingBag}
            label="Products Sent"
            value={summary.products_sent}
            color="warning"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-6">
          {/* Hourly volume */}
          <div className="col-span-2 rounded-xl border border-border p-5">
            <h3 className="mb-4 text-sm font-medium">Message Volume by Hour</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.hourly_volume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) =>
                      h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
                    }
                    tick={{ fontSize: 11, fill: '#71717a' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e4e4e7',
                    }}
                    labelFormatter={(h) =>
                      `${h === 0 ? '12' : h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`
                    }
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bot vs Human pie */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="mb-4 text-sm font-medium">Bot vs Human Replies</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e4e4e7',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-ink-muted">
                    {d.name}: {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Automations */}
        {summary.top_automations.length > 0 && (
          <div className="rounded-xl border border-border p-5">
            <h3 className="mb-3 text-sm font-medium">Top Automations</h3>
            <div className="space-y-2">
              {summary.top_automations.map((auto, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-surface-overlay px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-bot-light text-[11px] font-semibold text-bot">
                      {i + 1}
                    </span>
                    <span className="text-sm">{auto.rule_name}</span>
                  </div>
                  <span className="text-sm font-medium text-ink-muted">
                    {auto.triggered}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    accent: { bg: 'bg-accent-light', text: 'text-accent' },
    bot: { bg: 'bg-bot-light', text: 'text-bot' },
    success: { bg: 'bg-success-light', text: 'text-success' },
    warning: { bg: 'bg-warning-light', text: 'text-warning' },
  };

  const c = colorMap[color] || colorMap.accent;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.text}`} />
        </div>
        <span className="text-xs text-ink-muted">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
