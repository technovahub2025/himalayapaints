import { Router } from "express";
import { createStockMovement, getStock } from "../controllers/stockController.js";
const router = Router();
router.get("/", getStock);
router.post("/", createStockMovement);
export default router;
