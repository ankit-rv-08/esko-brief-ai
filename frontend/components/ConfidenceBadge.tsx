import type { Confidence } from '@/lib/types';

const labels: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };

export function ConfidenceBadge({ level, reason }: { level: Confidence; reason?: string | null }) {
  return (
    <span className={`confidence confidence-${level}`} title={reason ?? labels[level]}>
      <i /> {labels[level]}
    </span>
  );
}