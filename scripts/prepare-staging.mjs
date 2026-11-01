import { readFileSync, writeFileSync } from "node:fs";
const project = process.argv[2];
if (project !== "leadership-skill-builder-stg")
  throw new Error("Refusing a non-staging target.");
const config = JSON.parse(readFileSync(process.argv[3], "utf8"));
if (config.projectId !== project || !config.apiKey || !config.appId)
  throw new Error("Invalid staging Firebase configuration.");
const env = { VITE_APP_ENV: "staging", VITE_FREEMIUM_ENABLED: "true" };
for (const [key, value] of Object.entries({
  API_KEY: config.apiKey,
  AUTH_DOMAIN: config.authDomain,
  PROJECT_ID: config.projectId,
  STORAGE_BUCKET: config.storageBucket || "",
  MESSAGING_SENDER_ID: config.messagingSenderId,
  APP_ID: config.appId,
}))
  env["VITE_FIREBASE_" + key] = value;
const appCheck = JSON.parse(readFileSync("config/app-check.staging.json", "utf8"));
if (!appCheck.siteKey) throw new Error("Missing staging App Check key.");
env.VITE_APP_CHECK_SITE_KEY = appCheck.siteKey;
writeFileSync(
  ".env.staging",
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);
const billing = JSON.parse(readFileSync("config/stripe.staging.json", "utf8"));
if (billing.STRIPE_MODE !== "test" || billing.APP_BASE_URL !== "https://leadership-skill-builder-staging-600309447137.europe-west1.run.app") throw new Error("Invalid Stripe staging configuration.");
writeFileSync(`functions/.env.${project}`, Object.entries({ ...billing, APP_CHECK_ENFORCED: "true" }).map(([k,v]) => `${k}=${v}`).join("\n") + "\n");
console.log("Prepared configuration for staging only.");
