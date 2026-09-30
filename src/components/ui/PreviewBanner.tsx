import { Eye } from 'lucide-react';

// Marks screens that show the plan for the product, filled with sample data
export function PreviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-surface-raised px-3 py-2 text-[13px] leading-relaxed text-ink-light">
      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
      <p>{children}</p>
    </div>
  );
}