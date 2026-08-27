import mongoose, { Schema } from "mongoose";
const TableSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    ratePerKg: { type: Number, default: 0, min: 0 },
    packSizes: [{
        packSize: { type: Number, required: true, min: 0 },
        availableQuantity: { type: Number, default: 0, min: 0 }
    }],
}, { timestamps: true });
const Table = mongoose.models.Table || mongoose.model("Table", TableSchema);
export default Table;
