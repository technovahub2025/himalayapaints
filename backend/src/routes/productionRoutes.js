import { Router } from "express";
import { createProductionBatch, getProductionBatches, getNextBatchNo } from "../controllers/productionController.js";
const router = Router();
router.get("/", getProductionBatches);
router.get("/next-batch-no", getNextBatchNo);
router.post("/", createProductionBatch);
export default router;
