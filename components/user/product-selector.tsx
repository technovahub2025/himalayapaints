"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { formatProductLabel } from "@/lib/product-label";

type ProductSelectorProps = {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
};

export function ProductSelector({
  value,
  options,
  onSelect,
  disabled = false,
  label = "Product Name",
  placeholder = "Search products..."
}: ProductSelectorProps) {
  const [query, setQuery] = useState(formatProductLabel(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(formatProductLabel(value));
  }, [value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => formatProductLabel(option).toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <div className="relative grid w-full gap-2 sm:min-w-[260px]">
      <label className="text-sm font-medium text-ink">{label}</label>
      <Input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        aria-label={label}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-line bg-white shadow-lg">
          {filtered.length > 0 ? (
            filtered.slice(0, 50).map((option) => {
              const displayName = formatProductLabel(option);
              return (
                <button
                  key={option}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    setQuery(displayName);
                    onSelect(option);
                  }}
                >
                  <span>{displayName}</span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-sm text-muted">No matching products</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
