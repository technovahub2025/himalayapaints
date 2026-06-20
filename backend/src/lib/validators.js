import { z } from "zod";
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});
export const itemSchema = z.object({
    tableName: z.string().trim().min(1, "Table name is required"),
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "Item name is required"),
    quantity: z.number().nonnegative("Quantity must be 0 or greater"),
    rate: z.number().nonnegative("Rate must be 0 or greater")
});
export const itemUpdateSchema = itemSchema.partial().extend({
    name: z.string().trim().min(1, "Item name is required").optional()
});
export const stockMovementSchema = z.object({
    productName: z.string().trim().min(1, "Product name is required"),
    materialName: z.string().trim().min(1, "Material name is required"),
    movementType: z.enum(["in", "out", "adjustment"]),
    quantity: z.number().positive("Quantity must be greater than 0"),
    adjustmentDirection: z.enum(["increase", "decrease"]).optional(),
    unit: z.string().trim().min(1).default("KG"),
    referenceType: z.string().trim().optional(),
    referenceId: z.string().trim().optional(),
    batchNo: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    createdBy: z.string().trim().optional()
});
export const productionLineSchema = z.object({
    itemId: z.string().trim().optional(),
    materialName: z.string().trim().min(1, "Material name is required"),
    percentage: z.number().nonnegative(),
    stdQty: z.number().nonnegative(),
    actualQty: z.number().nonnegative().optional(),
    remarks: z.string().trim().optional(),
    signature: z.string().trim().optional()
});
export const productionPackRowSchema = z.object({
    packSize: z.string().trim().optional(),
    quantity: z.string().trim().optional()
});
export const productionBatchSchema = z.object({
    productName: z.string().trim().min(1, "Product name is required"),
    batchNo: z.string().trim().optional(),
    batchSize: z.string().trim().optional(),
    specificGravity: z.string().trim().optional(),
    viscosity: z.string().trim().optional(),
    targetKg: z.number().nonnegative(),
    actualKg: z.number().nonnegative().optional(),
    createdBy: z.string().trim().optional(),
    packRows: z.array(productionPackRowSchema).optional(),
    lines: z.array(productionLineSchema).min(1, "At least one line item is required")
});
