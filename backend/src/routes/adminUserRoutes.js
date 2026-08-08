import { Router } from "express";
import { getAdminUsers, updateAdminUser } from "../controllers/adminUserController.js";

const router = Router();
router.get("/", getAdminUsers);
router.patch("/:id", updateAdminUser);
export default router;
