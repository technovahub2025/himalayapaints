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
export function createApp() {
    const app = express();
    const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    app.use(helmet({
        crossOriginResourcePolicy: false
    }));
    app.use(cors({
        origin: frontendOrigin,
        credentials: true
    }));
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
    app.use((error, _req, res, _next) => {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    });
    return app;
}
