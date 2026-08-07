import fs from "fs";
import path from "path";
import * as firebaseAdmin from "firebase-admin";

const RENDER_CREDENTIAL_PATH = "/etc/secrets/firebase-service-account.json";
const LOCAL_CREDENTIAL_PATH = path.resolve(process.cwd(), "src", "nexion-98f7c-4e49040efb6b.json");

let cachedApp = null;
let initializationAttempted = false;

function getCandidateCredentialPaths() {
    const envCredentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    return [envCredentialPath, RENDER_CREDENTIAL_PATH, LOCAL_CREDENTIAL_PATH].filter(Boolean);
}

function resolveCredentialPath() {
    for (const credentialPath of getCandidateCredentialPaths()) {
        if (fs.existsSync(credentialPath)) {
            return credentialPath;
        }
    }
    return null;
}

function loadServiceAccount(credentialPath) {
    if (!fs.existsSync(credentialPath)) {
        return null;
    }
    console.log(`[Firebase Admin] Credential file found: ${credentialPath}`);
    const rawJson = fs.readFileSync(credentialPath, "utf8");
    return JSON.parse(rawJson);
}

function initializeFirebaseAdmin() {
    if (initializationAttempted) {
        return cachedApp;
    }

    initializationAttempted = true;

    const credentialPath = resolveCredentialPath();
    if (!credentialPath) {
        console.warn("[Firebase Admin] Credential file missing");
        return null;
    }

    try {
        const serviceAccount = loadServiceAccount(credentialPath);
        if (!serviceAccount) {
            console.warn("[Firebase Admin] Credential file missing");
            return null;
        }

        if (firebaseAdmin.apps.length > 0) {
            cachedApp = firebaseAdmin.app();
        } else {
            cachedApp = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert(serviceAccount)
            });
        }

        console.log("[Firebase Admin] initialized successfully");
        return cachedApp;
    } catch {
        console.error("[Firebase Admin] initialization failed");
        cachedApp = null;
        return null;
    }
}

export function getFirebaseAdminApp() {
    return initializeFirebaseAdmin();
}

export function getFirebaseAdminAuth() {
    const app = initializeFirebaseAdmin();
    return app ? firebaseAdmin.auth(app) : null;
}
