import { Router } from "express";
import { createTable, deleteTable, getTables, renameTable } from "../controllers/tableController.js";
const router = Router();
router.get("/", getTables);
router.post("/", createTable);
router.patch("/", renameTable);
router.delete("/", deleteTable);
export default router;
