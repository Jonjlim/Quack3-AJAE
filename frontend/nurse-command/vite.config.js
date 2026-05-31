import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    appType: "spa",
    envDir: path.resolve(__dirname, "../.."),
    server: {
        host: true,
    },
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../../shared"),
        },
    },
});
