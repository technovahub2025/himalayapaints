"use client";
import { useEffect, useState } from "react";
import { Save, LoaderCircle } from "lucide-react";
import { calculateAmount } from "@/lib/calculations";
import { Button, Card, Input, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { apiFetch } from "@/services/api-client";
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
function formatDate(value) {
    if (!value)
        return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function SalesDashboard({ email }) {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [packSizes, setPackSizes] = useState([]);
    const [selectedPackSize, setSelectedPackSize] = useState(null);
    const [availableQuantity, setAvailableQuantity] = useState(null);
    const [stockError, setStockError] = useState(null);
    const [quantity, setQuantity] = useState("");
    const [ratePerKg, setRatePerKg] = useState(null);
    const [amount, setAmount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [pendingSales, setPendingSales] = useState([]);
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
    async function loadStock() {
        if (!selectedProduct) {
            setPackSizes([]);
            setSelectedPackSize(null);
            setAvailableQuantity(null);
            setStockError(null);
            setRatePerKg(null);
            return;
        }
        try {
            const data = await apiFetch(`/api/sales/stock?productName=${encodeURIComponent(selectedProduct)}`);
            const sizes = Array.isArray(data.packSizes) ? data.packSizes : [];
            setPackSizes(sizes);
            setStockError(null);
            setRatePerKg(data.ratePerKg !== undefined ? Number(data.ratePerKg) : null);
            if (sizes.length > 0) {
                const firstSize = sizes[0].packSize;
                setSelectedPackSize(firstSize);
                setAvailableQuantity(sizes[0].availableQuantity ?? 0);
            } else {
                setSelectedPackSize(null);
                setAvailableQuantity(null);
                setStockError("No pack size available for this product.");
            }
        }
        catch (error) {
            setPackSizes([]);
            setSelectedPackSize(null);
            setAvailableQuantity(null);
            setStockError(error instanceof Error ? error.message : "Unable to load inventory. Please try again.");
            setRatePerKg(null);
        }
    }
    useEffect(() => {
        loadStock();
    }, [selectedProduct]);
    useEffect(() => {
        if (selectedPackSize !== null && selectedPackSize !== undefined) {
            const pack = packSizes.find((p) => p.packSize === selectedPackSize);
            setAvailableQuantity(pack ? (pack.availableQuantity ?? 0) : null);
        }
    }, [selectedPackSize, packSizes]);
    async function refreshStock() {
        await loadStock();
    }
    async function refreshPendingSales() {
        if (!selectedProduct) {
            setPendingSales([]);
            return;
        }
        try {
            const data = await apiFetch(`/api/sales?productName=${encodeURIComponent(selectedProduct)}`);
            const sales = Array.isArray(data.sales) ? data.sales : [];
            setPendingSales(sales.filter((s) => s.dispatchStatus !== "dispatched"));
        }
        catch {
            setPendingSales([]);
        }
    }
    useEffect(() => {
        refreshPendingSales();
    }, [selectedProduct]);
    useEffect(() => {
        const qty = Number(quantity);
        if (selectedProduct && ratePerKg !== null && ratePerKg > 0 && !Number.isNaN(qty) && qty > 0) {
            setAmount(calculateAmount(qty, ratePerKg));
        }
        else {
            setAmount(0);
        }
    }, [quantity, ratePerKg, selectedProduct]);
    async function saveSale() {
        const qty = Number(quantity);
        if (!selectedProduct) {
            toast.error("Please select a product");
            return;
        }
        if (selectedPackSize === null || selectedPackSize === undefined) {
            toast.error(stockError || "Please select a pack size");
            return;
        }
        if (availableQuantity === null || availableQuantity === 0) {
            toast.error("Out of stock.");
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }
        if (qty > availableQuantity) {
            toast.error(`Insufficient available quantity. Only ${availableQuantity} KG is available.`);
            return;
        }
        if (ratePerKg === null || ratePerKg === 0) {
            toast.error("Product rate has not been set by admin.");
            return;
        }
        setSaving(true);
        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    productName: selectedProduct,
                    quantity: qty,
                    packSize: selectedPackSize
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to save sale");
            }
            toast.success(`Sale saved as pending: ${formatCurrency(data.sale?.amount ?? 0)}`);
            setQuantity("");
            setAmount(0);
            await refreshStock();
            await refreshPendingSales();
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save sale");
        }
        finally {
            setSaving(false);
        }
    }
    async function dispatchSale(saleId) {
        setDispatching(prev => prev === saleId ? prev : saleId);
        try {
            const response = await fetch(`/api/sales/${saleId}/dispatch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to dispatch sale");
            }
            toast.success("Sale dispatched. Stock updated.");
            await refreshStock();
            await refreshPendingSales();
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to dispatch sale");
        }
        finally {
            setDispatching(null);
        }
    }
    function clearForm() {
        setQuantity("");
        setSelectedProduct("");
        setRatePerKg(null);
        setAmount(0);
        setPackSizes([]);
        setSelectedPackSize(null);
        setAvailableQuantity(null);
        setStockError(null);
    }
    return (<div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Title className="text-2xl sm:text-3xl">Sales</Title>
          <Subtitle className="text-sm sm:text-base">Select a product, enter quantity in KG, and calculate the sales amount.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={clearForm} className="w-full sm:w-auto" disabled={!selectedProduct && !quantity}>
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
            { label: "Pack Size", value: selectedPackSize !== null && selectedPackSize !== undefined ? `${selectedPackSize} KG` : "—", hint: "Selected pack size" },
            { label: "Available Quantity", value: availableQuantity !== null && availableQuantity !== undefined ? `${availableQuantity} KG` : "—", hint: "Stock on hand" },
            { label: "Rate per KG", value: formatCurrency(ratePerKg), hint: "Set by admin (read-only)" },
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
            <label htmlFor="sale-pack-size" className="block text-[13px] font-medium text-slate-700 mb-2">Pack Size</label>
            <select
              id="sale-pack-size"
              value={selectedPackSize !== null && selectedPackSize !== undefined ? selectedPackSize : ""}
              onChange={(e) => setSelectedPackSize(e.target.value ? Number(e.target.value) : null)}
              className="h-11.5 w-full rounded-xl border border-border bg-white px-4 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              disabled={loading || !selectedProduct || packSizes.length === 0}
            >
              <option value="">Select Pack Size</option>
              {packSizes.map((pack) => (
                <option key={pack.packSize} value={pack.packSize}>{pack.packSize} KG</option>
              ))}
            </select>
            {stockError ? <p className="mt-1 text-xs text-rose-600">{stockError}</p> : null}
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-available-qty" className="block text-[13px] font-medium text-slate-700 mb-2">Available Quantity</label>
            <Input
              id="sale-available-qty"
              value={availableQuantity !== null && availableQuantity !== undefined ? `${availableQuantity} KG` : "—"}
              readOnly
              className="h-11.5 rounded-xl border-border bg-accentSoft font-semibold text-accent"
            />
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
              max={availableQuantity !== null && availableQuantity !== undefined ? String(availableQuantity) : undefined}
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
            {(availableQuantity !== null && availableQuantity !== undefined && Number(quantity) > availableQuantity) ? (
              <p className="mt-1 text-xs text-rose-600">Insufficient available quantity. Only {availableQuantity} KG is available.</p>
            ) : null}
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-rate" className="block text-[13px] font-medium text-slate-700 mb-2">Rate per KG</label>
            <Input
              id="sale-rate"
              value={formatCurrency(ratePerKg)}
              readOnly
              className="h-11.5 rounded-xl border-border bg-accentSoft font-semibold text-accent"
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="sale-pack-display" className="block text-[13px] font-medium text-slate-700 mb-2">Pack</label>
            <Input
              id="sale-pack-display"
              value={selectedPackSize !== null && selectedPackSize !== undefined ? `${selectedPackSize} KG` : "—"}
              readOnly
              className="h-11.5 rounded-xl border-border bg-accentSoft font-semibold text-accent"
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
      {selectedProduct && pendingSales.length > 0 ? (
        <Card className="border-border bg-white shadow-sm rounded-2xl p-4 sm:p-6">
          <div className="mb-5 pb-4 border-b border-border">
            <h3 className="text-[18px] font-semibold text-slate-900">Pending Sales ({pendingSales.length})</h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Pack</th>
                  <th className="px-4 py-3 font-semibold">Qty (KG)</th>
                  <th className="px-4 py-3 font-semibold">Rate</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSales.map((sale) => (
                  <tr key={sale._id ?? sale.createdAt} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{sale.packSize !== null && sale.packSize !== undefined ? `${sale.packSize} KG` : "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{Number(sale.quantity ?? 0).toLocaleString("en-IN")} KG</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatCurrency(sale.rate)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-950">{formatCurrency(sale.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{sale.dispatchStatus}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="primary"
                        onClick={() => dispatchSale(sale._id)}
                        disabled={dispatching === sale._id}
                        className="h-8 px-3 text-sm"
                      >
                        {dispatching === sale._id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : "Dispatch"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>);
}
