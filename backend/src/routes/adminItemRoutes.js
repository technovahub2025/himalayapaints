import { Router } from "express";
import { createAdminItem, deleteAdminItem, getAdminItems, saveAdminItems, updateAdminItem } from "../controllers/itemController.js";
const router = Router();
router.get("/", getAdminItems);
router.post("/", createAdminItem);
router.put("/", saveAdminItems);
router.patch("/:id", updateAdminItem);
router.delete("/:id", deleteAdminItem);
export default router;
