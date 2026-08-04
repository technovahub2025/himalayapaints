"use client";
import { LoaderCircle } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
export function LoadingScreen({ title = "Loading", subtitle = "Please wait while we get everything ready." }) {
    return (<div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)]">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white/90 p-6 text-center shadow-soft backdrop-blur">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-accent"/>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <SiteFooter />
    </div>);
}
