# Firebase Authentication

## Console setup

1. Create a Firebase project at https://console.firebase.google.com/
2. **Authentication** → Sign-in method → enable **Google** and **Anonymous**
3. Add two **Web** apps (patient + nurse) and copy the `firebaseConfig` values
4. **Project settings** → **Service accounts** → Generate new private key → save as `firebase-service-account.json` in repo root (gitignored)

## Environment

Root `.env`:

```env
REQUIRE_FIREBASE_AUTH=true
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
```

`frontend/patient-client/.env.local`:

```env
NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH=true
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

`frontend/nurse-command/.env.local` (or repo root `.env` via vite `envDir`):

```env
VITE_REQUIRE_FIREBASE_AUTH=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

## Where to look in Firebase Console

- **Authentication → Users** — nurses (Google) and patients (Anonymous) appear here after sign-in. There is no separate “register nurse” collection.
- **Custom claims** (`role=nurse`, `patient_id=…`) are set by the backend; they do not show as a field in the Console UI.
- **Firestore** — patient charts are **not** stored here yet (backend in-memory only).

## Flows

- **Nurse:** Google Sign-In → `POST /api/v1/auth/register-nurse` → custom claim `role=nurse`
- **Patient:** Anonymous auth → enter patient ID → `GET /api/v1/queue/{id}` → `POST /api/v1/auth/link-patient` → claim `role=patient` + `patient_id`

WebSockets pass `?token=<Firebase ID token>`. REST uses `Authorization: Bearer <token>`.

## Local dev without Firebase

Leave `REQUIRE_FIREBASE_AUTH=false` (default). No tokens required; behavior matches pre-Firebase stack.
