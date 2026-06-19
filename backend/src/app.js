import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import adminItemRoutes from "./routes/adminItemRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import rawMaterialRoutes from "./routes/rawMaterialRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
dotenv.config();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
function parseAllowedOrigins(value) {
    return String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
export function createApp() {
    const app = express();
    const allowedOrigins = parseAllowedOrigins(process.env.FRONTEND_ORIGIN || "http://localhost:5173");
    const corsOptions = {
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        credentials: true
    };
    app.disable("x-powered-by");
    app.use(helmet({
        crossOriginResourcePolicy: false
    }));
    app.use(cors(corsOptions));
    app.options("*", cors(corsOptions));
    app.use((req, res, next) => {
        if (SAFE_METHODS.has(req.method)) {
            next();
            return;
        }
        const origin = req.get("origin");
        if (!origin || allowedOrigins.includes(origin)) {
            next();
            return;
        }
        res.status(403).json({ message: "Invalid request origin" });
    });
    app.use(cookieParser());
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use("/api/auth", rateLimit({
        windowMs: 60 * 1000,
        max: 30
    }), authRoutes);
    app.use("/api/items", itemRoutes);
    app.use("/api/admin/items", adminItemRoutes);
    app.use("/api/admin/tables", tableRoutes);
    app.use("/api/admin/raw-materials", rawMaterialRoutes);
    app.use("/api/production", productionRoutes);
    app.use("/api/stock", stockRoutes);
    app.get("/health", (_req, res) => {
        res.json({ ok: true });
    });
    app.use((_req, res) => {
        res.status(404).json({ message: "Not found" });
    });
    app.use((error, _req, res, _next) => {
        console.error(error);
        if (res.headersSent) {
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    });
    return app;
}
