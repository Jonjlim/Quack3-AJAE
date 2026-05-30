"use client";

import { useRouter } from "next/navigation";
import { IntakeForm } from "./components/IntakeForm";
import { submitIntake } from "@/lib/ws-client";
import type { IntakeRequest } from "@shared/types/telemetry";

export default function HomePage() {
  const router = useRouter();

  async function handleIntake(data: IntakeRequest) {
    const result = await submitIntake(data);
    router.push(`/queue?patientId=${result.patient_id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">ER-OVERWATCH</p>
        <h1 className="mt-2 text-3xl font-bold">Welcome — Check In</h1>
        <p className="mt-2 text-slate-600">Scan complete. Tell us why you&apos;re here.</p>
      </header>
      <IntakeForm onSubmit={handleIntake} />
    </main>
  );
}
