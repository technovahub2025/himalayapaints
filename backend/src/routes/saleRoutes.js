import { Router } from "express";
import { createSale, dispatchSale, getSaleStock, getSales } from "../controllers/saleController.js";
const router = Router();
router.get("/", getSales);
router.get("/stock", getSaleStock);
router.post("/", createSale);
router.post("/:id/dispatch", dispatchSale);
export default router;
