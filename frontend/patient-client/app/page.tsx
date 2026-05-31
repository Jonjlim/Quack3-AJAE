"use client";

import { useRouter } from "next/navigation";
import { PatientSignInForm } from "./components/PatientSignInForm";
import { signInWithPatientId } from "@/lib/ws-client";

const PATIENT_ID_KEY = "er-overwatch-patient-id";

export default function HomePage() {
  const router = useRouter();

  async function handleSignIn(patientId: string) {
    await signInWithPatientId(patientId);
    sessionStorage.setItem(PATIENT_ID_KEY, patientId);
    router.push(`/queue?patientId=${encodeURIComponent(patientId)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">ER-OVERWATCH</p>
        <h1 className="mt-2 text-3xl font-bold">Patient Sign In</h1>
        <p className="mt-2 text-slate-600">
          Enter the patient ID from the nurse to view your queue status.
        </p>
      </header>
      <PatientSignInForm onSignIn={handleSignIn} />
    </main>
  );
}
