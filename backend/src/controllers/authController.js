import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { dbConnect } from "../lib/db.js";
import { ensureSeedData } from "../lib/seed.js";
import { loginSchema } from "../lib/validators.js";
import { signToken } from "../lib/auth.js";
import { roleRedirectPath } from "../lib/routes.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    };
}
export async function login(req, res) {
    try {
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
        const token = await signToken({
            userId: String(user._id),
            email: user.email,
            role: user.role
        });
        res.cookie("auth_token", token, {
            ...cookieOptions(),
            maxAge: 60 * 60 * 24 * 7 * 1000
        });
        return res.json({
            token,
            role: user.role,
            redirectTo: roleRedirectPath(user.role)
        });
    }
    catch (error) {
        const message = error instanceof Error && /MONGODB_URI|connect|ECONNREFUSED|failed to connect/i.test(error.message)
            ? "Database connection failed. Make sure MongoDB is running and MONGODB_URI is correct."
            : error instanceof Error && /JWT_SECRET/i.test(error.message)
                ? "JWT_SECRET is missing in the backend environment."
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
    res.cookie("auth_token", "", {
        ...cookieOptions(),
        maxAge: 0
    });
    return res.json({ ok: true });
}
