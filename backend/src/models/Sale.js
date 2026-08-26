import mongoose, { Schema } from "mongoose";
const SaleSchema = new Schema({
    productName: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    packSize: { type: Number, default: null },
    dispatchStatus: { type: String, required: true, enum: ["pending", "dispatched"], default: "pending" },
    createdBy: { type: String, trim: true, default: "" }
}, { timestamps: true });
const Sale = mongoose.models.Sale || mongoose.model("Sale", SaleSchema);
export default Sale;
