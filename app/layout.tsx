import type { Metadata } from "next";
import Script from "next/script";
import fs from "fs";
import path from "path";
import { Manrope, Fraunces } from "next/font/google";
import "@/app/globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

function getBuildId() {
  try {
    return fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "";
  }
}

export const metadata: Metadata = {
  title: "Himalaya Paints Dashboard",
  description: "Role-based admin and user dashboard with live calculations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buildId = getBuildId();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Script
          id="chunk-reload-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var flagKey = "__himalaya_chunk_reload_attempted";
                var buildId = ${JSON.stringify(buildId)};

                function reloadOnce() {
                  try {
                    if (sessionStorage.getItem(flagKey) === "1") return;
                    sessionStorage.setItem(flagKey, "1");
                  } catch (error) {}
                  window.location.reload();
                }

                if (!buildId || buildId === "development") {
                  return;
                }

                try {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", "/api/build-id?ts=" + Date.now(), false);
                  xhr.send(null);
                  var latestBuildId = (xhr.status === 200 && xhr.responseText ? xhr.responseText : "").trim();
                  if (latestBuildId && buildId && latestBuildId !== buildId) {
                    reloadOnce();
                    return;
                  }
                } catch (error) {}

                function toMessage(value) {
                  if (!value) return "";
                  if (typeof value === "string") return value;
                  if (value instanceof Error) return value.name + ": " + value.message;
                  try {
                    return JSON.stringify(value);
                  } catch (error) {
                    return String(value);
                  }
                }

                function shouldReload(value) {
                  var message = toMessage(value);
                  return /ChunkLoadError|Loading chunk \\d+ failed|Loading CSS chunk \\d+ failed|\\/_next\\/static\\/chunks/i.test(message);
                }

                function markAndReload() {
                  try {
                    if (sessionStorage.getItem(flagKey) === "1") return;
                    sessionStorage.setItem(flagKey, "1");
                  } catch (error) {}
                  window.location.reload();
                }

                window.addEventListener("load", function () {
                  try {
                    sessionStorage.removeItem(flagKey);
                  } catch (error) {}
                });

                window.addEventListener(
                  "error",
                  function (event) {
                    if (shouldReload(event.error || event.message)) {
                      markAndReload();
                    }
                  },
                  true
                );

                window.addEventListener("unhandledrejection", function (event) {
                  if (shouldReload(event.reason)) {
                    markAndReload();
                  }
                });
              })();
            `
          }}
        />
      </head>
      <body className={`${manrope.variable} ${fraunces.variable} font-sans antialiased`}>
        <Providers />
        {children}
      </body>
    </html>
  );
}
