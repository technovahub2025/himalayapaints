import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required"),
  quantity: z.number().nonnegative("Quantity must be 0 or greater"),
  rate: z.number().nonnegative("Rate must be 0 or greater")
});

export const itemUpdateSchema = itemSchema.partial().extend({
  name: z.string().trim().min(1, "Item name is required").optional()
});
