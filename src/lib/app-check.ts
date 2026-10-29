import { getApp, getApps, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

let appCheck: AppCheck | null = null;
let initError: Error | null = null;

function getClientAppCheck(): AppCheck {
  if (appCheck) return appCheck;
  if (initError) throw initError;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

  const missing: string[] = [];
  if (!apiKey) missing.push("VITE_FIREBASE_API_KEY");
  if (!projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
  if (!appId) missing.push("VITE_FIREBASE_APP_ID");
  if (!siteKey) missing.push("VITE_FIREBASE_APPCHECK_SITE_KEY");

  if (missing.length > 0) {
    initError = new Error(
      `Firebase App Check is not configured for production. Missing required variables: ${missing.join(", ")}.`,
    );
    throw initError;
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      });

  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheck;
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    throw initError;
  }
}

export async function appCheckHeaders(): Promise<Record<string, string>> {
  // Local development / emulator mode: use debug token path
  if (import.meta.env.DEV || import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === "true") {
    return { "X-Firebase-AppCheck": "debug" };
  }

  // In production, never silently bypass App Check
  const instance = getClientAppCheck();
  const tokenResult = await getToken(instance);
  if (!tokenResult?.token) {
    throw new Error("Unable to obtain a valid Firebase App Check token in production.");
  }
  return { "X-Firebase-AppCheck": tokenResult.token };
}
