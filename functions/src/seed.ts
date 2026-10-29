import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { seedFeeds } from "./seed-data.js";

// Auto-detect Firebase CLI Application Default Credentials if not already set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const appData =
    process.env.APPDATA ||
    (process.platform === "win32"
      ? resolve(process.env.USERPROFILE || "", "AppData", "Roaming")
      : "");
  if (appData) {
    const firebaseDir = resolve(appData, "firebase");
    if (existsSync(firebaseDir)) {
      try {
        const files = readdirSync(firebaseDir);
        const adc = files.find((f) => f.endsWith("_application_default_credentials.json"));
        if (adc) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(firebaseDir, adc);
        }
      } catch {
        // Fall back to standard ADC lookup
      }
    }
  }
}

function getProjectId(): string {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const rcPath = resolve(process.cwd(), "..", ".firebaserc");
    if (existsSync(rcPath)) {
      const rc = JSON.parse(readFileSync(rcPath, "utf-8"));
      if (rc?.projects?.default) return rc.projects.default;
    }
  } catch {
    // Ignore fallback
  }
  return "cypher-squad";
}

const projectId = getProjectId();
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

function feedId(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

async function main() {
  console.log(`Seeding discovery feeds for project: ${projectId}`);
  await Promise.all(
    seedFeeds.map(async (feed) => {
      const docRef = db.collection("feeds").doc(feedId(feed.normalizedUrl));
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        if (!snap.exists) {
          transaction.set(docRef, {
            name: feed.name,
            normalizedUrl: feed.normalizedUrl,
            description: feed.description,
            seededPopularityCount: 1,
            livePopularityCount: 0,
          });
        } else {
          // Preserve livePopularityCount when re-running seed
          transaction.set(
            docRef,
            {
              name: feed.name,
              normalizedUrl: feed.normalizedUrl,
              description: feed.description,
              seededPopularityCount: 1,
            },
            { merge: true },
          );
        }
      });
    }),
  );
  console.log(`Seeded ${seedFeeds.length} discovery feeds.`);
}

void main();
