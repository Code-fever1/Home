import { cn } from '@/lib/utils';

interface ConnectionIndicatorProps {
  strength: number;
  type: 'wifi' | 'ethernet' | 'cellular';
  className?: string;
}

export function ConnectionIndicator({
  strength,
  type,
  className,
}: ConnectionIndicatorProps) {
  const bars = type === 'ethernet' ? 4 : 4;
  const activeBars = Math.max(0, Math.min(bars, Math.round((strength / 100) * bars)));

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {type === 'ethernet' ? (
        <svg
          className="w-4 h-4 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
      ) : (
        <div className="flex items-end gap-0.5">
          {Array.from({ length: bars }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1 rounded-sm transition-colors',
                i < activeBars
                  ? 'bg-emerald-500'
                  : 'bg-slate-700',
                i === 0 && 'h-1.5',
                i === 1 && 'h-2.5',
                i === 2 && 'h-3.5',
                i === 3 && 'h-4.5'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
