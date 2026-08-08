import { Router } from "express";
import { changePassword, login, logout, me } from "../controllers/authController.js";
const router = Router();
router.post("/login", login);
router.get("/me", me);
router.post("/change-password", changePassword);
router.post("/logout", logout);
export default router;
