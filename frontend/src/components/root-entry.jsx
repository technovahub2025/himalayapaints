"use client";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardBody, Subtitle, Title, cx } from "@/components/ui";
export function RootEntry({ destination, heading, subtitle, ctaLabel, autoRedirect = true }) {
    const navigate = useNavigate();
    useEffect(() => {
        if (!autoRedirect)
            return;
        const timer = window.setTimeout(() => {
            navigate(destination, { replace: true });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [autoRedirect, destination, navigate]);
    return (<div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.12),_transparent_32%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)] px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardBody className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <Title className="text-2xl sm:text-3xl">{heading}</Title>
            <Subtitle className="mt-0 text-base">{subtitle}</Subtitle>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={destination} className={cx("inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 sm:w-auto")}>
              <ArrowRight className="mr-2 h-4 w-4"/>
              {ctaLabel}
            </Link>
          </div>
          <p className="text-xs text-muted">
            If the page does not continue automatically, use the button above.
          </p>
        </CardBody>
      </Card>
    </div>);
}
