import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], required: true }
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);

export default User;
