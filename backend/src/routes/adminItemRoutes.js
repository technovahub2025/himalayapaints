import { Router } from "express";
import multer from "multer";
import {
    createAdminItem,
    deleteAdminItem,
    getAdminItems,
    importAdminItems,
    saveAdminItems,
    updateAdminItem,
    updateAdminItemStatus
} from "../controllers/itemController.js";

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

router.get("/", getAdminItems);
router.post("/import", upload.single("file"), importAdminItems);
router.post("/", createAdminItem);
router.put("/", saveAdminItems);
router.patch("/:id", updateAdminItem);
router.patch("/:id/status", updateAdminItemStatus);
router.delete("/:id", deleteAdminItem);

export default router;