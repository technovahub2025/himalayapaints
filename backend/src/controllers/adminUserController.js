import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { dbConnect } from "../lib/db.js";
import { adminUserUpdateSchema } from "../lib/validators.js";
import { getAuthFromRequest } from "../utils/request-auth.js";

function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}

export async function getAdminUsers(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin") {
        return forbidden(res);
    }
    await dbConnect();
    const users = await User.find().select("_id email role createdAt updatedAt").sort({ email: 1 }).lean();
    return res.json({ users });
}

export async function updateAdminUser(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin") {
        return forbidden(res);
    }
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid user update" });
    }
    const targetId = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(targetId)) {
        return res.status(400).json({ message: "Invalid user account" });
    }
    const nextEmail = parsed.data.email.toLowerCase();
    await dbConnect();
    const user = await User.findById(targetId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    const duplicate = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).select("_id").lean();
    if (duplicate) {
        return res.status(409).json({ message: "That user ID/email is already in use" });
    }
    user.email = nextEmail;
    if (parsed.data.newPassword) {
        user.password = await bcrypt.hash(parsed.data.newPassword, 10);
    }
    await user.save();
    return res.json({
        ok: true,
        user: { _id: String(user._id), email: user.email, role: user.role },
        requiresRelogin: String(user._id) === String(auth.userId)
    });
}
