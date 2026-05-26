import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";
import { loginSchema } from "@/lib/validators";
import { signToken } from "@/lib/auth";
import { roleRedirectPath } from "@/lib/routes";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 400 });
    }

    await dbConnect();
    await ensureSeedData();

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordOk) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const token = await signToken({
      userId: String(user._id),
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json({
      role: user.role,
      redirectTo: roleRedirectPath(user.role)
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    console.error("Login failed", error);

    const message =
      error instanceof Error && /MONGODB_URI|connect|ECONNREFUSED|failed to connect/i.test(error.message)
        ? "Database connection failed. Make sure MongoDB is running and MONGODB_URI is correct."
        : "Login failed";

    const status =
      message.startsWith("Database connection failed") ? 503 : 500;

    return NextResponse.json({ message }, { status });
  }
}
