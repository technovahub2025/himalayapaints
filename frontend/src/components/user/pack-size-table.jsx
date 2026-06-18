"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input } from "@/components/ui";
export function PackSizeTable({ onAddRow, onDeleteRow, onPackSizeChange, onQuantityChange, packGrandTotal, packRows }) {
    return (<Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-lg font-semibold">Pack Size Calculator</p>
            <p className="text-sm text-muted">Result = Pack Size x Quantity, with add and delete row support.</p>
          </div>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button variant="secondary" onClick={onAddRow}>
              <Plus className="mr-2 h-4 w-4"/>
              Add Row
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          <div className="hidden grid-cols-12 gap-3 border-b border-line bg-slate-50 px-5 py-4 text-sm font-medium text-muted md:grid">
            <div className="col-span-4">Pack Size</div>
            <div className="col-span-5">Quantity</div>
            <div className="col-span-3">Result</div>
          </div>

          <div className="divide-y divide-line">
            {packRows.map((row, index) => {
            const result = Number(row.packSize || 0) * Number(row.quantity || 0);
            return (<div key={`${index}-${row.packSize}`} className="grid gap-3 px-4 py-4 md:grid-cols-12 md:items-center md:gap-4 md:px-5">
                  <div className="md:col-span-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-muted md:hidden">PACK SIZE</label>
                    <Input type="number" min="0" step="0.01" value={row.packSize} onChange={(e) => onPackSizeChange(index, e.target.value)} placeholder="5"/>
                  </div>

                  <div className="md:col-span-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-muted md:hidden">QUANTITY</label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input type="number" min="0" step="0.01" value={row.quantity} onChange={(e) => onQuantityChange(index, e.target.value)} placeholder="20"/>
                      <button type="button" onClick={() => onDeleteRow(index)} className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:w-11 sm:px-0" aria-label="Delete pack row">
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-muted md:hidden">RESULT</label>
                    <div className="flex h-11 items-center rounded-2xl border border-line bg-slate-50 px-4 text-sm font-semibold text-ink">
                      {result.toLocaleString()}
                    </div>
                  </div>
                </div>);
        })}
          </div>
        </div>

        <div className="grid gap-3 rounded-3xl border border-line bg-slate-50 px-5 py-4 md:grid-cols-12 md:items-center">
          <div className="md:col-span-4 text-sm font-semibold text-ink">Grand Total</div>
          <div className="md:col-span-5 text-sm text-muted">Auto calculated</div>
          <div className="md:col-span-3 text-sm font-semibold text-ink">{packGrandTotal.toLocaleString()}</div>
        </div>
      </CardBody>
    </Card>);
}
