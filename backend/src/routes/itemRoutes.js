import { Router } from "express";
import { getPublicItems } from "../controllers/itemController.js";
const router = Router();
router.get("/", getPublicItems);
export default router;
