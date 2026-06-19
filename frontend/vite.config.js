import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiBaseUrl = env.VITE_API_BASE_URL || "http://localhost:3001";
    return {
        plugins: [react()],
        build: {
            chunkSizeWarningLimit: 1000
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src")
            }
        },
        server: {
            proxy: {
                "/api": {
                    target: apiBaseUrl,
                    changeOrigin: true,
                    secure: false
                }
            }
        }
    };
});
