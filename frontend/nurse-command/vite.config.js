import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, "../.."),
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../../shared"),
        },
    },
});
