import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ItemSchema = new Schema(
  {
    tableName: { type: String, required: true, trim: true, default: "Table 1" },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

export type ItemDocument = InferSchemaType<typeof ItemSchema>;

const Item: Model<ItemDocument> = mongoose.models.Item || mongoose.model<ItemDocument>("Item", ItemSchema);

export default Item;
