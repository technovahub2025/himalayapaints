import { Router } from "express";
import { createRawMaterial, deleteRawMaterials, getRawMaterials, importRawMaterials, updateRawMaterial } from "../controllers/rawMaterialController.js";
const router = Router();
router.get("/", getRawMaterials);
router.post("/import", importRawMaterials);
router.post("/", createRawMaterial);
router.patch("/", updateRawMaterial);
router.delete("/", deleteRawMaterials);
export default router;
