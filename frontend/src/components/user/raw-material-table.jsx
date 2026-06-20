"use client";
import { Input } from "@/components/ui";
import { safePercent, scaleQuantity } from "@/lib/calculations";
export function RawMaterialTable({ actuals, distributedTotal, items, manualKgValues, remarks, signatures, targetKg, onActualChange, onManualKgChange, onRemarkChange, onSignatureChange, onTargetKgChange }) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const targetNumber = Number(targetKg || 0);
    return (<div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm" style={{ padding: "24px" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-[18px] font-semibold text-slate-900">Production Ratio Table</h3>
        <div className="flex items-center gap-3">
          <label className="text-[13px] font-medium text-slate-700">Target Production KG</label>
          <div className="relative">
            <Input type="number" min="0" step="0.01" value={targetKg} onChange={(e) => onTargetKgChange(e.target.value)} className="h-11 w-32 rounded-xl border-[#E5E7EB] bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" style={{ paddingRight: "40px" }}/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">KG</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto md:overflow-visible">
        <table className="min-w-full w-full divide-y divide-slate-200">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">%</th>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Raw Material</th>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Standard Qty</th>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Actual Qty</th>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Remarks</th>
              <th className="h-13 px-6 text-left text-[13px] font-medium text-slate-700 uppercase tracking-wide">Signature</th>
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
                      <td className="px-6 py-6 align-middle">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-700">{percentage.toFixed(2)}%</span>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <div className="text-sm font-medium text-slate-900">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Master Qty: {item.quantity} KG</div>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <div className="flex items-center gap-2">
                          <Input type="number" min="0" step="0.01" value={kgValue} onChange={(e) => onManualKgChange(item._id, e.target.value)} placeholder={suggestedKg.toString()} className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                        </div>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <Input type="number" min="0" step="0.01" value={actualValue} onChange={(e) => onActualChange(item._id, e.target.value)} placeholder="Enter actuals" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <Input value={remarkValue} onChange={(e) => onRemarkChange(item._id, e.target.value)} placeholder="Enter remarks" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                      <td className="px-6 py-6 align-middle">
                        <Input value={signatureValue} onChange={(e) => onSignatureChange(item._id, e.target.value)} placeholder="Enter signature" className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"/>
                      </td>
                    </tr>);
        })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/80 border-t-2 border-slate-200">
              <td className="px-6 py-5 text-[15px] font-semibold text-slate-900">TOTAL</td>
              <td className="px-6 py-5 text-sm text-slate-600">Total Suggested Qty</td>
              <td className="px-6 py-5 text-[15px] font-semibold text-slate-900">{distributedTotal.toLocaleString()} KG</td>
              <td className="px-6 py-5 text-sm text-slate-600">Total Actual Qty</td>
              <td className="px-6 py-5 text-sm text-slate-600">Remarks</td>
              <td className="px-6 py-5 text-sm text-slate-600">Signature</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>);
}