import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "Password123!",
  role: "admin" as const
};

const DEFAULT_USER = {
  email: "user@example.com",
  password: "Password123!",
  role: "user" as const
};

export async function ensureSeedData() {
  await dbConnect();
  const existing = await User.countDocuments();
  if (existing > 0) return;

  const adminPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  const userPassword = await bcrypt.hash(DEFAULT_USER.password, 10);

  await User.create([
    { email: DEFAULT_ADMIN.email, password: adminPassword, role: DEFAULT_ADMIN.role },
    { email: DEFAULT_USER.email, password: userPassword, role: DEFAULT_USER.role }
  ]);
}
