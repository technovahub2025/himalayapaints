import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import Item from "@/models/Item";
import Table from "@/models/Table";
import User from "@/models/User";

const DEFAULT_ADMIN = {
  email: "admin@gmail.com",
  password: "admin@123",
  role: "admin" as const
};

const DEFAULT_USER = {
  email: "user@gmail.com",
  password: "user@123",
  role: "user" as const
};

const DEFAULT_TABLE_NAME = "Table 1";

export async function ensureSeedData() {
  await dbConnect();
  const adminPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  const userPassword = await bcrypt.hash(DEFAULT_USER.password, 10);

  await User.updateOne(
    { email: DEFAULT_ADMIN.email },
    { $set: { email: DEFAULT_ADMIN.email, password: adminPassword, role: DEFAULT_ADMIN.role } },
    { upsert: true }
  );

  await User.updateOne(
    { email: DEFAULT_USER.email },
    { $set: { email: DEFAULT_USER.email, password: userPassword, role: DEFAULT_USER.role } },
    { upsert: true }
  );

  await User.deleteMany({
    email: { $in: ["admin@example.com", "user@example.com"] }
  });

  const existingItems = await Item.find({}).select("tableName").lean();
  const distinctItemTables = Array.from(new Set(existingItems.map((item) => item.tableName).filter(Boolean))).filter(Boolean);
  const tableNames = Array.from(new Set([DEFAULT_TABLE_NAME, ...distinctItemTables]));

  for (const name of tableNames) {
    await Table.updateOne({ name }, { $set: { name } }, { upsert: true });
  }

  await Item.updateMany(
    {
      $or: [
        { tableName: { $exists: false } },
        { tableName: null },
        { tableName: "" }
      ]
    },
    { $set: { tableName: DEFAULT_TABLE_NAME } }
  );
}
