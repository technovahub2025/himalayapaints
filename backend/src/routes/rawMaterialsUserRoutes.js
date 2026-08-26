import { Router } from "express";
import { upload } from "./rawMaterialRoutes.js";
import { userImportRawMaterials } from "../controllers/rawMaterialController.js";
const router = Router();
router.post("/import", upload.single("file"), userImportRawMaterials);
export default router;
