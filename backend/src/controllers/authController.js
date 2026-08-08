import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { dbConnect } from "../lib/db.js";
import { ensureSeedData } from "../lib/seed.js";
import { loginSchema, passwordResetSchema } from "../lib/validators.js";
import { signToken } from "../lib/auth.js";
import { roleRedirectPath } from "../lib/routes.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
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
export async function login(req, res) {
    try {
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
export async function changePassword(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = passwordResetSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid password request" });
    }
    const targetEmail = String(parsed.data.email ?? auth.email).trim().toLowerCase();
    if (!targetEmail) {
        return res.status(400).json({ message: "Email is required" });
    }
    if (parsed.data.confirmPassword && parsed.data.confirmPassword !== parsed.data.newPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
    }
    await dbConnect();
    const user = await User.findOne({ email: targetEmail });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    user.password = await bcrypt.hash(parsed.data.newPassword, 10);
    await user.save();
    return res.json({ ok: true, email: user.email });
}
export async function logout(_req, res) {
    res.clearCookie("auth_token", cookieOptions());
    return res.json({ ok: true });
}
