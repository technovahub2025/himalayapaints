import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const StockMovementSchema = new Schema(
  {
    productName: { type: String, required: true, trim: true, index: true },
    materialName: { type: String, required: true, trim: true, index: true },
    movementType: { type: String, required: true, enum: ["in", "out", "adjustment"] },
    quantity: { type: Number, required: true, min: 0 },
    quantityDelta: { type: Number, required: true },
    unit: { type: String, required: true, trim: true, default: "KG" },
    balanceBefore: { type: Number, required: true, default: 0 },
    balanceAfter: { type: Number, required: true, default: 0 },
    referenceType: { type: String, trim: true, default: "manual" },
    referenceId: { type: String, trim: true, default: "" },
    batchNo: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

StockMovementSchema.index({ productName: 1, materialName: 1, createdAt: 1 });

export type StockMovementDocument = InferSchemaType<typeof StockMovementSchema>;

const StockMovement: Model<StockMovementDocument> =
  mongoose.models.StockMovement || mongoose.model<StockMovementDocument>("StockMovement", StockMovementSchema);

export default StockMovement;
