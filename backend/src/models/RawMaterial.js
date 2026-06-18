import mongoose, { Schema } from "mongoose";
const RawMaterialSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 }
}, { timestamps: true });
const RawMaterial = mongoose.models.RawMaterial || mongoose.model("RawMaterial", RawMaterialSchema);
export default RawMaterial;
