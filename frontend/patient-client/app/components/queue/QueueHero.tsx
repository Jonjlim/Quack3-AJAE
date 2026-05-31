import type { QueueStatus } from "@shared/types/telemetry";
import { statusLabel } from "@/lib/queue-status-copy";
import { ConnectionBadge } from "./ConnectionBadge";
import { Surface } from "../ui/Surface";

interface QueueHeroProps {
  queue: QueueStatus;
  wsConnected: boolean;
  isMockMode: boolean;
  loading?: boolean;
}

export function QueueHero({ queue, wsConnected, isMockMode, loading }: QueueHeroProps) {
  if (loading) {
    return (
      <Surface>
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 w-16 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-neutral-100" />
      </Surface>
    );
  }

  return (
    <Surface>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">Queue position</p>
        <ConnectionBadge wsConnected={wsConnected} isMockMode={isMockMode} />
      </div>

      <p className="text-queue-number mt-2 text-ink">{queue.queue_position}</p>
      <p className="mt-2 text-base text-ink">{statusLabel(queue.status)}</p>

      <dl className="mt-5 space-y-3 border-t border-neutral-200 pt-5">
        <div>
          <dt className="text-sm font-medium text-muted">Estimated wait</dt>
          <dd className="mt-0.5 text-lg font-semibold text-ink">
            About {queue.estimated_wait_minutes} minutes
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted">Time waiting so far</dt>
          <dd className="mt-0.5 text-base text-ink">{queue.wait_minutes} minutes</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted">
        Wait times may change when urgent cases arrive.
      </p>
    </Surface>
  );
}
