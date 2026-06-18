import mongoose, { Schema } from "mongoose";
const UserSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], required: true }
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
