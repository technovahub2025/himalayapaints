import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { dbConnect } from "../lib/db.js";
import { ensureSeedData } from "../lib/seed.js";
import { loginSchema } from "../lib/validators.js";
import { signToken } from "../lib/auth.js";
import { roleRedirectPath } from "../lib/routes.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { getFirebaseAdminAuth } from "../lib/firebase-admin.js";
function cookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        path: "/"
    };
}
function setSessionCookie(res, token) {
    res.cookie("auth_token", token, {
        ...cookieOptions(),
        maxAge: 60 * 60 * 24 * 7 * 1000
    });
}
async function issueSessionForUser(res, user) {
    const token = await signToken({
        userId: String(user._id),
        email: user.email,
        role: user.role
    });
    setSessionCookie(res, token);
    return res.json({
        role: user.role,
        redirectTo: roleRedirectPath(user.role)
    });
}
async function handleEmailPasswordLogin(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid email or password" });
    }

    await dbConnect();
    await ensureSeedData();

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordOk) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    return issueSessionForUser(res, user);
}
export async function googleLogin(req, res) {
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
    if (!idToken) {
        return res.status(400).json({ message: "idToken is required" });
    }

    const firebaseAuth = getFirebaseAdminAuth();
    if (!firebaseAuth) {
        return res.status(503).json({ message: "Firebase Admin is unavailable" });
    }

    let decodedToken;
    try {
        decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    const email = typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : "";
    if (!email) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
        await dbConnect();
        await ensureSeedData();

        let user = await User.findOne({ email });
        if (!user) {
            const password = await bcrypt.hash(`${decodedToken.uid}:${email}`, 10);
            user = await User.create({
                email,
                password,
                role: "user"
            });
        }

        return issueSessionForUser(res, user);
    } catch (error) {
        const message = error instanceof Error && /MONGODB_URI|connect|ECONNREFUSED|failed to connect/i.test(error.message)
            ? "Database connection failed. Make sure MongoDB is running and MONGODB_URI is correct."
            : "Login failed";
        const status = message.startsWith("Database connection failed") ? 503 : 500;
        return res.status(status).json({ message });
    }
}
export async function login(req, res) {
    try {
        if (typeof req.body?.idToken === "string") {
            return await googleLogin(req, res);
        }
        return await handleEmailPasswordLogin(req, res);
    }
    catch (error) {
        const message = error instanceof Error && /MONGODB_URI|connect|ECONNREFUSED|failed to connect/i.test(error.message)
            ? "Database connection failed. Make sure MongoDB is running and MONGODB_URI is correct."
            : "Login failed";
        const status = message.startsWith("Database connection failed") ? 503 : 500;
        return res.status(status).json({ message });
    }
}
export async function me(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth)
        return res.status(401).json({ message: "Unauthorized" });
    return res.json({ user: auth });
}
export async function logout(_req, res) {
    res.clearCookie("auth_token", cookieOptions());
    return res.json({ ok: true });
}
