import mongoose from "mongoose";
const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;
export async function dbConnect() {
    if (cached.conn)
        return cached.conn;
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error("Please define the MONGODB_URI environment variable.");
    }
    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        }).then((instance) => instance).catch((error) => {
            cached.promise = null;
            throw error;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}
