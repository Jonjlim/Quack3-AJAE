import { ER_DOCUMENT_ITEMS } from "./checkin-constants";

interface CheckInStepIdentityProps {
  lastName: string;
  firstName: string;
  age: string;
  sex: "Male" | "Female" | "Non-binary" | "";
  emergencyContact: string;
  allergies: string;
  documentsReceived: Set<string>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  onLastNameChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onAgeChange: (value: string) => void;
  onSexChange: (value: "Male" | "Female" | "Non-binary" | "") => void;
  onEmergencyContactChange: (value: string) => void;
  onAllergiesChange: (value: string) => void;
  onToggleDocument: (id: string) => void;
  error?: string;
}

const inputClass =
  "intake-input telemetry-value w-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--text-dim)]";

export function CheckInStepIdentity({
  lastName,
  firstName,
  age,
  sex,
  emergencyContact,
  allergies,
  documentsReceived,
  nameInputRef,
  onLastNameChange,
  onFirstNameChange,
  onAgeChange,
  onSexChange,
  onEmergencyContactChange,
  onAllergiesChange,
  onToggleDocument,
  error,
}: CheckInStepIdentityProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-px bg-[var(--border-subtle)] p-px">
      <div className="grid flex-shrink-0 grid-cols-12 gap-px bg-[var(--border-subtle)]">
        <div className="col-span-5 bg-[var(--surface)] p-3">
          <label htmlFor="checkin-last" className="telemetry-label block text-[11px]">
            Last name <span className="text-[var(--status-critical)]">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="checkin-last"
            type="text"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Nguyen"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div className="col-span-4 bg-[var(--surface)] p-3">
          <label htmlFor="checkin-first" className="telemetry-label block text-[11px]">
            First name
          </label>
          <input
            id="checkin-first"
            type="text"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Alan"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div className="col-span-1 bg-[var(--surface)] p-3">
          <label htmlFor="checkin-age" className="telemetry-label block text-[11px]">
            Age
          </label>
          <input
            id="checkin-age"
            type="number"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder="—"
            min={0}
            max={120}
            className={`${inputClass} mt-1 px-2`}
          />
        </div>
        <div className="col-span-2 flex flex-col bg-[var(--surface)] p-3">
          <span className="telemetry-label block text-[11px]">Sex</span>
          <div className="mt-1 flex flex-1 gap-px">
            {(["M", "F", "NB"] as const).map((s) => {
              const full = s === "M" ? "Male" : s === "F" ? "Female" : "Non-binary";
              const on = sex === full;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSexChange(on ? "" : full)}
                  className={`intake-input flex flex-1 items-center justify-center border text-xs font-bold ${
                    on
                      ? "border-[var(--text)] bg-[var(--text)] text-white"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-6 bg-[var(--surface)] p-3">
          <label htmlFor="checkin-ec" className="telemetry-label block text-[11px]">
            Emergency contact
          </label>
          <input
            id="checkin-ec"
            type="text"
            value={emergencyContact}
            onChange={(e) => onEmergencyContactChange(e.target.value)}
            placeholder="Name · phone"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div className="col-span-6 bg-[var(--surface)] p-3">
          <label htmlFor="checkin-allergies" className="telemetry-label block text-[11px]">
            Known allergies
          </label>
          <input
            id="checkin-allergies"
            type="text"
            value={allergies}
            onChange={(e) => onAllergiesChange(e.target.value)}
            placeholder="NKDA or list"
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>

      {error && (
        <p className="flex-shrink-0 bg-[var(--surface)] px-3 py-1 text-xs text-[var(--status-critical)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <p className="telemetry-label mb-2 text-[11px]">Registration & documents received</p>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-[var(--border-subtle)] lg:grid-cols-3">
          {ER_DOCUMENT_ITEMS.map((doc) => {
            const on = documentsReceived.has(doc.id);
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onToggleDocument(doc.id)}
                className={`intake-input flex min-h-[4.5rem] flex-col items-center justify-center border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                  on
                    ? "border-[var(--status-stable)] bg-green-50 text-[var(--status-stable)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                }`}
              >
                <span className="text-base leading-none">{on ? "✓" : "○"}</span>
                <span className="mt-1.5 leading-snug">{doc.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
