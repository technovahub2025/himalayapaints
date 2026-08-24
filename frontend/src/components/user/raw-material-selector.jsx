"use client";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
export function RawMaterialSelector({ value, options, loading = false, onSelect }) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (value) {
            const material = options.find((option) => option.code === value);
            if (material) {
                setQuery(`${material.code || ""} ${material.name || ""}`);
            }
        }
    }, [value, options]);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) => `${option.code || ""} ${option.name || ""}`.toLowerCase().includes(needle));
    }, [options, query]);
    return (<div className="relative grid w-full min-w-0 gap-2 sm:min-w-[260px]">
      <label className="text-sm font-medium text-ink">Raw Material</label>
      <Input type="search" value={query} disabled={loading} onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
        }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder={loading ? "Loading..." : "Search raw materials..."} aria-label="Raw Material"/>
      {open ? (<div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-line bg-white shadow-lg">
          {filtered.length > 0 ? (filtered.slice(0, 50).map((option) => {
              const materialCode = option.code || "-";
              const materialName = option.name || "-";
              const isSelected = option.code === value;
              return (<button key={option.code} type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                    setOpen(false);
                    setQuery(`${materialCode} — ${materialName}`);
                    onSelect(option.code);
                }}>
                  <span>{materialCode} — {materialName}</span>
                  {isSelected ? <span className="text-xs text-teal-700">Selected</span> : null}
                </button>);
            })) : (<div className="px-4 py-3 text-sm text-muted">No matching raw materials</div>)}
        </div>) : null}
    </div>);
}
