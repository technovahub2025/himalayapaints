import { Router } from "express";
import multer from "multer";
import { createRawMaterial, deleteRawMaterials, getRawMaterials, importRawMaterials, updateRawMaterial } from "../controllers/rawMaterialController.js";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase().split(".").pop();
        if (["xlsx", "xls", "csv"].includes(ext)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});
const router = Router();
router.get("/", getRawMaterials);
router.post("/import", upload.single("file"), importRawMaterials);
router.post("/", createRawMaterial);
router.patch("/", updateRawMaterial);
router.delete("/", deleteRawMaterials);
export default router;
