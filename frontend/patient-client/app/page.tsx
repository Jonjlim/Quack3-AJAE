"use client";

import { WelcomeWizard } from "./components/onboarding/WelcomeWizard";
import { signInWithPatientId } from "@/lib/ws-client";

export default function HomePage() {
  return <WelcomeWizard onSignIn={signInWithPatientId} />;
}
