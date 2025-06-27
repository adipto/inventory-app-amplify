import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react"; // ✅ Add this
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      jsxRuntime: "classic", // ✅ Forces classic React import behavior
    }),
  ],
});
