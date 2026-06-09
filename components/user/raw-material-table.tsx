"use client";

import { Input, Card, CardBody, CardHeader } from "@/components/ui";
import { safePercent, scaleQuantity } from "@/lib/calculations";

export type UserMaterialItem = {
  _id: string;
  name: string;
  quantity: number;
};

type RawMaterialTableProps = {
  actuals: Record<string, string>;
  distributedTotal: number;
  items: UserMaterialItem[];
  manualKgValues: Record<string, string>;
  remarks: Record<string, string>;
  signatures: Record<string, string>;
  targetKg: string;
  onActualChange: (itemId: string, value: string) => void;
  onManualKgChange: (itemId: string, value: string) => void;
  onRemarkChange: (itemId: string, value: string) => void;
  onSignatureChange: (itemId: string, value: string) => void;
  onTargetKgChange: (value: string) => void;
};

export function RawMaterialTable({
  actuals,
  distributedTotal,
  items,
  manualKgValues,
  remarks,
  signatures,
  targetKg,
  onActualChange,
  onManualKgChange,
  onRemarkChange,
  onSignatureChange,
  onTargetKgChange
}: RawMaterialTableProps) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const targetNumber = Number(targetKg || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-lg font-semibold tracking-wide">PRODUCTION RATIO TABLE</p>
            <p className="text-sm text-muted">
              Each admin item uses 100 KG as the base production. Enter a batch KG to scale the editable KG values instantly.
            </p>
          </div>
          <div className="grid w-full gap-3 md:max-w-sm">
            <label className="text-sm font-medium text-ink">Target Production KG</label>
            <Input type="number" min="0" step="0.01" value={targetKg} onChange={(e) => onTargetKgChange(e.target.value)} />
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] lg:min-w-[1200px] w-full border-collapse border border-line bg-white">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={6} className="border-b border-line px-3 py-3 text-left text-xs font-semibold tracking-[0.14em] text-ink sm:px-5 sm:text-sm">
                  RAW MATERIAL CONSUMPTION
                </th>
              </tr>
              <tr className="bg-slate-50 text-left text-sm text-muted">
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">%</th>
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">RAW MATERIAL CODE</th>
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">STD QTY</th>
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">ACTUAL QTY</th>
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">REMARKS</th>
                <th className="border-b border-line px-3 py-3 text-xs font-medium sm:px-5 sm:py-4 sm:text-sm">SIGNATURE</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const percentage = safePercent(item.quantity, totalQuantity);
                const suggestedKg = scaleQuantity(item.quantity, targetNumber);
                const kgValue = manualKgValues[item._id] ?? String(suggestedKg);
                const actualValue = actuals[item._id] ?? "";
                const remarkValue = remarks[item._id] ?? "";
                const signatureValue = signatures[item._id] ?? "";
                return (
                  <tr key={item._id} className="border-t border-line">
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <div className="inline-flex rounded-2xl border border-line bg-white px-3 py-2 text-sm font-semibold text-accent sm:px-4 sm:py-3">
                        {percentage.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <div className="text-sm font-semibold text-ink">{item.name}</div>
                      <div className="mt-1 text-xs text-muted">Master qty: {item.quantity} KG</div>
                    </td>
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={kgValue}
                          onChange={(e) => onManualKgChange(item._id, e.target.value)}
                          placeholder={suggestedKg.toString()}
                        />
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted print:text-black">kg</span>
                      </div>
                      <p className="mt-2 text-xs text-muted">Suggested based on percentage: {suggestedKg.toLocaleString()} KG</p>
                    </td>
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actualValue}
                        onChange={(e) => onActualChange(item._id, e.target.value)}
                        placeholder="Enter actuals"
                      />
                    </td>
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <Input
                        value={remarkValue}
                        onChange={(e) => onRemarkChange(item._id, e.target.value)}
                        placeholder="Enter remarks"
                      />
                    </td>
                    <td className="px-3 py-3 align-top sm:px-5 sm:py-4">
                      <Input
                        value={signatureValue}
                        onChange={(e) => onSignatureChange(item._id, e.target.value)}
                        placeholder="Enter signature"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td className="border-t border-line px-3 py-3 text-sm font-semibold text-ink sm:px-5 sm:py-4">TOTAL</td>
                <td className="border-t border-line px-3 py-3 text-sm text-muted sm:px-5 sm:py-4">Dynamic source list</td>
                <td className="border-t border-line px-3 py-3 text-sm font-semibold text-ink sm:px-5 sm:py-4">{distributedTotal.toLocaleString()} KG</td>
                <td className="border-t border-line px-3 py-3 text-sm text-muted sm:px-5 sm:py-4">Manual actuals only</td>
                <td className="border-t border-line px-3 py-3 text-sm text-muted sm:px-5 sm:py-4">Remarks</td>
                <td className="border-t border-line px-3 py-3 text-sm text-muted sm:px-5 sm:py-4">Signature</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
