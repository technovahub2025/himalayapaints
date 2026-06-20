"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
export function PackSizeTable({ onAddRow, onDeleteRow, onPackSizeChange, onQuantityChange, packGrandTotal, packRows }) {
    const hasRows = packRows.length > 0;
    function handleEnterKey(rowIndex, row) {
        const isLastRow = rowIndex === packRows.length - 1;
        const hasContent = row.packSize.trim() !== "" || row.quantity.trim() !== "";
        if (!isLastRow || !hasContent) {
            return;
        }
        onAddRow();
    }
    return (<div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm" style={{ padding: "24px" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-[18px] font-semibold text-slate-900">Pack Size Calculator</h3>
        <Button variant="secondary" onClick={onAddRow} className="h-9 px-4 text-xs font-medium rounded-lg">
          <Plus className="mr-1.5 h-3.5 w-3.5"/>
          Add Row
        </Button>
      </div>

      {!hasRows ? (<div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-slate-500 mb-4">No pack sizes added yet.</p>
          <Button variant="secondary" onClick={onAddRow} className="h-8 px-4 text-xs font-medium rounded-lg">
            <Plus className="mr-1.5 h-3.5 w-3.5"/>
            Add Pack Size
          </Button>
        </div>) : (<div className="overflow-x-auto">
          <table className="min-w-full w-full divide-y divide-slate-200">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="h-12 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Pack Size</th>
                <th className="h-12 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Quantity</th>
                <th className="h-12 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Result</th>
                <th className="h-12 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {packRows.map((row, index) => {
              const result = Number(row.packSize || 0) * Number(row.quantity || 0);
              return (<tr key={`${index}-${row.packSize}`}>
                      <td className="px-6 py-6 align-middle">
                        <Input type="number" min="0" step="0.01" value={row.packSize} onChange={(e) => onPackSizeChange(index, e.target.value)} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleEnterKey(index, row);
                        }
                    }} placeholder="0" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <Input type="number" min="0" step="0.01" value={row.quantity} onChange={(e) => onQuantityChange(index, e.target.value)} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleEnterKey(index, row);
                        }
                    }} placeholder="0" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <div className="h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">{result.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <button type="button" onClick={() => onDeleteRow(index)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete pack row">
                          <Trash2 className="h-4 w-4"/>
                        </button>
                      </td>
                    </tr>);
            })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                <td className="px-6 py-5 text-[15px] font-semibold text-slate-900">Grand Total</td>
                <td className="px-6 py-5 text-sm text-slate-600">Auto calculated</td>
                <td className="px-6 py-5 text-[15px] font-semibold text-slate-900">{packGrandTotal.toLocaleString()}</td>
                <td className="px-6 py-5"></td>
              </tr>
            </tfoot>
          </table>
        </div>)}

      <div className="mt-6 text-xs text-slate-500">
        Total Packs: {packRows.filter(r => r.packSize.trim() !== "" || r.quantity.trim() !== "").length}
      </div>
    </div>);
}
