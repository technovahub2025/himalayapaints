import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const TableSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

export type TableDocument = InferSchemaType<typeof TableSchema>;

const Table: Model<TableDocument> = mongoose.models.Table || mongoose.model<TableDocument>("Table", TableSchema);

export default Table;
