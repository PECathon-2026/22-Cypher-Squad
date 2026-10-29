import { getApp, getApps, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

let appCheck: AppCheck | null = null;
let initError: Error | null = null;

function getClientAppCheck(): AppCheck | null {
  if (appCheck) return appCheck;
  if (initError) throw initError;

  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  // If not configured on this host, return null gracefully
  if (!siteKey || !apiKey || !projectId || !appId) {
    return null;
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
  // Local development / emulator / debug mode
  if (import.meta.env.DEV || import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === "true") {
    return { "X-Firebase-AppCheck": "debug" };
  }

  // In production with App Check configured, get token
  const instance = getClientAppCheck();
  if (!instance) {
    return {};
  }

  try {
    const tokenResult = await getToken(instance);
    return tokenResult?.token ? { "X-Firebase-AppCheck": tokenResult.token } : {};
  } catch {
    return {};
  }
}
