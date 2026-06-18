import { Router } from "express";
import { createProductionBatch, getProductionBatches } from "../controllers/productionController.js";
const router = Router();
router.get("/", getProductionBatches);
router.post("/", createProductionBatch);
export default router;
