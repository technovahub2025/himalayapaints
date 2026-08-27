import { Router } from "express";
import { createTable, deleteTable, getTables, renameTable, updateTableRate } from "../controllers/tableController.js";
const router = Router();
router.get("/", getTables);
router.post("/", createTable);
router.patch("/", renameTable);
router.patch("/rate", updateTableRate);
router.delete("/", deleteTable);
export default router;
