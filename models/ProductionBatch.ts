import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ProductionLineSchema = new Schema(
  {
    itemId: { type: String, trim: true, default: "" },
    materialName: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0 },
    stdQty: { type: Number, required: true, min: 0 },
    actualQty: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true, default: "" },
    signature: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const ProductionBatchSchema = new Schema(
  {
    productName: { type: String, required: true, trim: true, index: true },
    batchNo: { type: String, trim: true, default: "" },
    batchSize: { type: String, trim: true, default: "" },
    specificGravity: { type: String, trim: true, default: "" },
    viscosity: { type: String, trim: true, default: "" },
    targetKg: { type: Number, required: true, min: 0 },
    actualKg: { type: Number, required: true, min: 0 },
    createdBy: { type: String, trim: true, default: "" },
    lines: { type: [ProductionLineSchema], default: [] }
  },
  { timestamps: true }
);

ProductionBatchSchema.index({ productName: 1, createdAt: 1 });

export type ProductionBatchDocument = InferSchemaType<typeof ProductionBatchSchema>;

const ProductionBatch: Model<ProductionBatchDocument> =
  mongoose.models.ProductionBatch || mongoose.model<ProductionBatchDocument>("ProductionBatch", ProductionBatchSchema);

export default ProductionBatch;
