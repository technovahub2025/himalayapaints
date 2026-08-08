"use client";
import { Input } from "@/components/ui";
import { safePercent, scaleQuantity } from "@/lib/calculations";
export function RawMaterialTable({ actuals, distributedTotal, items, manualKgValues, remarks, signatures, targetKg, onActualChange, onManualKgChange, onRemarkChange, onSignatureChange, onTargetKgChange }) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const targetNumber = Number(targetKg || 0);
    return (<div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-base font-semibold text-slate-900 sm:text-[18px]">Production Ratio Table</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="text-[13px] font-medium text-slate-700">Target Production KG</label>
          <div className="relative">
            <Input type="number" min="0" step="0.01" value={targetKg} onChange={(e) => onTargetKgChange(e.target.value)} className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none sm:w-32" style={{ paddingRight: "40px" }}/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">KG</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {items.map((item, index) => {
          const percentage = safePercent(item.quantity, totalQuantity);
          const suggestedKg = scaleQuantity(item.quantity, targetNumber);
          const kgValue = manualKgValues[item._id] ?? String(suggestedKg);
          const actualValue = actuals[item._id] ?? "";
          const remarkValue = remarks[item._id] ?? "";
          const signatureValue = signatures[item._id] ?? "";
          return (
            <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Raw Material</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{percentage.toFixed(2)}% | Master Qty: {item.quantity} KG</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">{percentage.toFixed(2)}%</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">Standard Qty</label>
                  <Input type="number" min="0" step="0.01" value={kgValue} onChange={(e) => onManualKgChange(item._id, e.target.value)} placeholder={suggestedKg.toString()} className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">Actual Qty</label>
                  <Input type="number" min="0" step="0.01" value={actualValue} onChange={(e) => onActualChange(item._id, e.target.value)} placeholder="Enter actuals" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">Remarks</label>
                  <Input value={remarkValue} onChange={(e) => onRemarkChange(item._id, e.target.value)} placeholder="Enter remarks" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">Signature</label>
                  <Input value={signatureValue} onChange={(e) => onSignatureChange(item._id, e.target.value)} placeholder="Enter signature" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto hidden md:block">
        <table className="min-w-full w-full divide-y divide-slate-200">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">%</th>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">Raw Material</th>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">Standard Qty</th>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">Actual Qty</th>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">Remarks</th>
              <th className="h-13 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">Signature</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {items.map((item, index) => {
            const percentage = safePercent(item.quantity, totalQuantity);
            const suggestedKg = scaleQuantity(item.quantity, targetNumber);
            const kgValue = manualKgValues[item._id] ?? String(suggestedKg);
            const actualValue = actuals[item._id] ?? "";
            const remarkValue = remarks[item._id] ?? "";
            const signatureValue = signatures[item._id] ?? "";
            return (<tr key={item._id} className="transition-colors duration-150 hover:bg-slate-50/50">
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-700">{percentage.toFixed(2)}%</span>
                      </td>
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <div className="text-sm font-medium text-slate-900">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Master Qty: {item.quantity} KG</div>
                      </td>
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <div className="flex items-center gap-2">
                          <Input type="number" min="0" step="0.01" value={kgValue} onChange={(e) => onManualKgChange(item._id, e.target.value)} placeholder={suggestedKg.toString()} className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <Input type="number" min="0" step="0.01" value={actualValue} onChange={(e) => onActualChange(item._id, e.target.value)} placeholder="Enter actuals" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <Input value={remarkValue} onChange={(e) => onRemarkChange(item._id, e.target.value)} placeholder="Enter remarks" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                        <Input value={signatureValue} onChange={(e) => onSignatureChange(item._id, e.target.value)} placeholder="Enter signature" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                    </tr>);
        })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/80 border-t-2 border-slate-200">
              <td className="px-4 py-5 text-[15px] font-semibold text-slate-900 sm:px-6">TOTAL</td>
              <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">Total Suggested Qty</td>
              <td className="px-4 py-5 text-[15px] font-semibold text-slate-900 sm:px-6">{distributedTotal.toLocaleString()} KG</td>
              <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">Total Actual Qty</td>
              <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">Remarks</td>
              <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">Signature</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>);
}
