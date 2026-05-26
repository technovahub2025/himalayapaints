import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import Item from "@/models/Item";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const items = await Item.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json({ items });
}
