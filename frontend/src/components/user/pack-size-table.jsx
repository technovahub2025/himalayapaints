"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";

export function PackSizeTable({
    onAddRow,
    onDeleteRow,
    onPackSizeChange,
    onQuantityChange,
    onUnitChange,
    packRows,
    totalLitre,
    totalKg,
    litreOpKg,
    litreYieldPercent,
    kgYieldPercent,
    finalYieldPercent,
    specificGravity,
    actualKg
}) {
    const hasRows = packRows.length > 0;

    const validSG =
        String(specificGravity ?? "").trim() !== "" &&
        Number.isFinite(Number(specificGravity)) &&
        Number(specificGravity) > 0;

    const validActualKg = Number(actualKg) > 0;

    function handleEnterKey(rowIndex, row) {
        const isLastRow = rowIndex === packRows.length - 1;
        const hasContent =
            row.packSize.trim() !== "" ||
            row.quantity.trim() !== "";

        if (!isLastRow || !hasContent) {
            return;
        }

        onAddRow();
    }

    const formatNumber = (value, digits = 3) =>
        Number(value || 0).toLocaleString(undefined, {
            maximumFractionDigits: digits
        });

    return (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 lg:p-6">

            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-base font-semibold text-slate-900 sm:text-[18px]">
                    Pack Size Calculator
                </h3>

                <Button
                    variant="secondary"
                    onClick={onAddRow}
                    className="h-9 w-full rounded-lg px-4 text-xs font-medium sm:w-auto"
                >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Row
                </Button>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                        Total Litre
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatNumber(totalLitre)}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                        Litre OP KG
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                        {validSG ? formatNumber(litreOpKg) : "—"}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                        Total KG
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatNumber(totalKg)}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                        Final Yield
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                        {validActualKg
                            ? `${Number(finalYieldPercent || 0).toLocaleString(undefined, {
                                maximumFractionDigits: 2
                            })}%`
                            : "—"}
                    </p>
                </div>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">
                        Litre Yield
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                        {validActualKg && validSG
                            ? `${Number(litreYieldPercent || 0).toLocaleString(undefined, {
                                maximumFractionDigits: 2
                            })}%`
                            : "—"}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">
                        KG Yield
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                        {validActualKg
                            ? `${Number(kgYieldPercent || 0).toLocaleString(undefined, {
                                maximumFractionDigits: 2
                            })}%`
                            : "—"}
                    </p>
                </div>
            </div>

            {!validSG && (
                <p className="mb-4 text-xs text-amber-700">
                    Enter a valid Specific Gravity greater than zero to calculate
                    Litre OP KG and Litre Yield.
                </p>
            )}

            {!validActualKg && (
                <p className="mb-4 text-xs text-amber-700">
                    Actual KG must be greater than zero to calculate Yield.
                </p>
            )}

            {!hasRows ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="mb-4 text-sm text-slate-500">
                        No pack sizes added yet.
                    </p>

                    <Button
                        variant="secondary"
                        onClick={onAddRow}
                        className="h-8 rounded-lg px-4 text-xs font-medium"
                    >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Pack Size
                    </Button>
                </div>
            ) : (
                <>
                    {/* MOBILE */}
                    <div className="grid gap-3 md:hidden">
                        {packRows.map((row, index) => {
                            const result =
                                Number(row.packSize || 0) *
                                Number(row.quantity || 0);

                            const unit =
                                row.unit === "kg" ? "kg" : "litre";

                            return (
                                <div
                                    key={index}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                Pack Row {index + 1}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                                {row.packSize || "-"} {unit}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onDeleteRow(index)}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                            aria-label="Delete pack row"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-700">
                                                Pack Size
                                            </label>

                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.packSize}
                                                onChange={(e) =>
                                                    onPackSizeChange(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        handleEnterKey(index, row);
                                                    }
                                                }}
                                                placeholder="0"
                                                className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-700">
                                                Quantity
                                            </label>

                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.quantity}
                                                onChange={(e) =>
                                                    onQuantityChange(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        handleEnterKey(index, row);
                                                    }
                                                }}
                                                placeholder="0"
                                                className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-700">
                                                Unit
                                            </label>

                                            <select
                                                value={unit}
                                                onChange={(e) =>
                                                    onUnitChange(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-slate-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                            >
                                                <option value="litre">
                                                    Litre
                                                </option>
                                                <option value="kg">
                                                    KG
                                                </option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                        Result: {formatNumber(result)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* DESKTOP */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full w-full divide-y divide-slate-200">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    <th className="h-12 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">
                                        Pack Size
                                    </th>

                                    <th className="h-12 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">
                                        Quantity
                                    </th>

                                    <th className="h-12 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">
                                        Unit
                                    </th>

                                    <th className="h-12 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">
                                        Result
                                    </th>

                                    <th className="h-12 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-slate-700 sm:px-6 sm:text-[13px]">
                                        Action
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {packRows.map((row, index) => {
                                    const result =
                                        Number(row.packSize || 0) *
                                        Number(row.quantity || 0);

                                    const unit =
                                        row.unit === "kg"
                                            ? "kg"
                                            : "litre";

                                    return (
                                        <tr
                                            key={index}
                                        >
                                            <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.packSize}
                                                    onChange={(e) =>
                                                        onPackSizeChange(
                                                            index,
                                                            e.target.value
                                                        )
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleEnterKey(index, row);
                                                        }
                                                    }}
                                                    placeholder="0"
                                                    className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                                                />
                                            </td>

                                            <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.quantity}
                                                    onChange={(e) =>
                                                        onQuantityChange(
                                                            index,
                                                            e.target.value
                                                        )
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleEnterKey(index, row);
                                                        }
                                                    }}
                                                    placeholder="0"
                                                    className="h-11 w-full rounded-xl border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                                                />
                                            </td>

                                            <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                                                <select
                                                    value={unit}
                                                    onChange={(e) =>
                                                        onUnitChange(
                                                            index,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                                >
                                                    <option value="litre">
                                                        Litre
                                                    </option>
                                                    <option value="kg">
                                                        KG
                                                    </option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                                                <div className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                                                    {formatNumber(result)}
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 align-middle sm:px-6 sm:py-6">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onDeleteRow(index)
                                                    }
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                                    aria-label="Delete pack row"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                            <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                                    <td className="px-4 py-5 text-[15px] font-semibold text-slate-900 sm:px-6">
                                        Totals
                                    </td>

                                    <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">
                                        Litre / KG
                                    </td>

                                    <td className="px-4 py-5 text-sm font-semibold text-slate-700 sm:px-6">
                                        {formatNumber(totalLitre)} L
                                        <br />
                                        {formatNumber(totalKg)} KG
                                    </td>

                                    <td className="px-4 py-5 text-sm font-semibold text-slate-900 sm:px-6">
                                        Final Yield
                                        <br />
                                        {validActualKg
                                            ? `${Number(finalYieldPercent || 0).toLocaleString(undefined, {
                                                maximumFractionDigits: 2
                                            })}%`
                                            : "—"}
                                    </td>

                                    <td className="px-4 py-5 sm:px-6" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            <div className="mt-6 text-xs text-slate-500">
                Total Packs:{" "}
                {
                    packRows.filter(
                        (r) =>
                            r.packSize.trim() !== "" ||
                            r.quantity.trim() !== ""
                    ).length
                }
            </div>
        </div>
    );
}

