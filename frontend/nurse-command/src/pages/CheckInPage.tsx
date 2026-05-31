import { CheckInWizard } from "../components/checkin/CheckInWizard";
import type { CheckInData, CheckInResult } from "../hooks/useTriageSocket";

interface CheckInTabProps {
  onSubmit: (data: CheckInData) => Promise<CheckInResult>;
  className?: string;
}

export function CheckInTab({ onSubmit, className = "" }: CheckInTabProps) {
  return (
    <div className={`flex min-h-0 flex-col overflow-hidden bg-[var(--surface)] ${className}`}>
      <CheckInWizard onSubmit={onSubmit} />
    </div>
  );
}
