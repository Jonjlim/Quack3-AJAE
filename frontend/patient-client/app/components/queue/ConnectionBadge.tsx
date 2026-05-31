import { Badge } from "../ui/Badge";

interface ConnectionBadgeProps {
  wsConnected: boolean;
  isMockMode: boolean;
}

export function ConnectionBadge({ wsConnected, isMockMode }: ConnectionBadgeProps) {
  if (isMockMode) {
    return (
      <Badge tone="mock" title="Demo mode — no live updates">
        Demo
      </Badge>
    );
  }
  if (wsConnected) {
    return (
      <Badge tone="live" title="Connected to live queue updates">
        Connected
      </Badge>
    );
  }
  return (
    <Badge tone="offline" pulse title="Reconnecting to server">
      Reconnecting
    </Badge>
  );
}
