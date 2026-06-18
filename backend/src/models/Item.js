import mongoose, { Schema } from "mongoose";
const ItemSchema = new Schema({
    tableName: { type: String, required: true, trim: true, default: "Table 1" },
    code: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
}, { timestamps: true });
const Item = mongoose.models.Item || mongoose.model("Item", ItemSchema);
export default Item;
