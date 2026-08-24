"use client";
import { useEffect, useState } from "react";
import { Save, LoaderCircle } from "lucide-react";
import { calculateAmount } from "@/lib/calculations";
import { Button, Card, Input, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { toast } from "sonner";
const NUMBER_FORMAT = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
function formatCurrency(value) {
    return NUMBER_FORMAT.format(Number(value ?? 0));
}
export function SalesDashboard({ email }) {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [quantity, setQuantity] = useState("");
    const [rate, setRate] = useState(0);
    const [amount, setAmount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        async function loadProducts() {
            setLoading(true);
            try {
                const response = await fetch("/api/items?tableName=Table%201");
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || "Failed to load products");
                }
                setProducts(data.tables ?? []);
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load products");
            }
            finally {
                setLoading(false);
            }
        }
        loadProducts();
    }, []);
    useEffect(() => {
        async function loadRate() {
            if (!selectedProduct) {
                setRate(0);
                return;
            }
            setLoading(true);
            try {
                const response = await fetch(`/api/items?tableName=${encodeURIComponent(selectedProduct)}`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || "Failed to load product rate");
                }
                const items = data.items ?? [];
                const computedRate = Number(items.reduce((sum, item) => sum + (item.amount ?? 0), 0).toFixed(2));
                setRate(computedRate);
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load product rate");
            }
            finally {
                setLoading(false);
            }
        }
        loadRate();
    }, [selectedProduct]);
    useEffect(() => {
        const qty = Number(quantity);
        if (selectedProduct && rate > 0 && !Number.isNaN(qty) && qty > 0) {
            setAmount(calculateAmount(qty, rate));
        }
        else {
            setAmount(0);
        }
    }, [quantity, rate, selectedProduct]);
    async function saveSale() {
        const qty = Number(quantity);
        if (!selectedProduct) {
            toast.error("Please select a product");
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }
        setSaving(true);
        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productName: selectedProduct,
                    quantity: qty,
                    rate
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to save sale");
            }
            toast.success(`Sale saved: ${formatCurrency(data.sale?.amount ?? 0)}`);
            setQuantity("");
            setSelectedProduct("");
            setAmount(0);
            setRate(0);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save sale");
        }
        finally {
            setSaving(false);
        }
    }
    return (<div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Title className="text-2xl sm:text-3xl">Sales</Title>
          <Subtitle className="text-sm sm:text-base">Select a product, enter quantity in KG, and calculate the sales amount.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setQuantity(""); setSelectedProduct(""); setAmount(0); setRate(0); }} className="w-full sm:w-auto" disabled={!selectedProduct && !quantity}>
            Clear
          </Button>
          <Button onClick={saveSale} disabled={saving || loading || !selectedProduct} className="w-full sm:w-auto">
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            Save Sale
          </Button>
        </div>
      </div>
      <SummaryCards items={[
            { label: "Selected Product", value: selectedProduct || "—", hint: "Product for this sale" },
            { label: "Rate per KG", value: formatCurrency(rate), hint: "Derived from product master data" },
            { label: "Quantity (KG)", value: quantity ? `${Number(quantity).toLocaleString("en-IN")} KG` : "—", hint: "Quantity entered" },
            { label: "Total Amount", value: formatCurrency(amount), hint: "Quantity × Rate" }
        ]}/>
      <Card className="border-border bg-white shadow-sm rounded-2xl p-4 sm:p-6">
        <div className="mb-5 pb-4 border-b border-border">
          <h3 className="text-[18px] font-semibold text-slate-900">Sale Details</h3>
        </div>
        <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-product" className="block text-[13px] font-medium text-slate-700 mb-2">Product</label>
            <select
              id="sale-product"
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setQuantity(""); }}
              className="h-11.5 w-full rounded-xl border border-border bg-white px-4 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              disabled={loading}
            >
              <option value="">Select Product</option>
              {products.map((product) => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-quantity" className="block text-[13px] font-medium text-slate-700 mb-2">Quantity (KG)</label>
            <Input
              id="sale-quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-rate" className="block text-[13px] font-medium text-slate-700 mb-2">Rate per KG</label>
            <Input
              id="sale-rate"
              value={formatCurrency(rate)}
              readOnly
              className="h-11.5 rounded-xl border-border bg-slate-100 text-slate-500"
            />
          </div>
          <div className="col-span-12">
            <label htmlFor="sale-amount" className="block text-[13px] font-medium text-slate-700 mb-2">Amount</label>
            <Input
              id="sale-amount"
              value={formatCurrency(amount)}
              readOnly
              className="h-12 rounded-xl border-border bg-accentSoft text-accent text-xl font-bold"
            />
          </div>
        </div>
      </Card>
    </div>);
}
