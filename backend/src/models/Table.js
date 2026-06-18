import mongoose, { Schema } from "mongoose";
const TableSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });
const Table = mongoose.models.Table || mongoose.model("Table", TableSchema);
export default Table;
