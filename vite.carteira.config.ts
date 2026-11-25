import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// App do filiado (carteira.armascon.com.br). Fica no mesmo repositório do
// app de OS para reaproveitar componentes, tipos e regras (src/), mas é
// um build separado: npm run dev:carteira / npm run build:carteira
export default defineConfig({
  root: path.resolve(__dirname, "carteira"),
  publicDir: path.resolve(__dirname, "carteira/public"),
  // O .env (VITE_SUPABASE_*) fica na raiz do repositório
  envDir: __dirname,
  server: { host: "::", port: 5173 },
  plugins: [react()],
  // Telas do painel de filiação (src/) sabem que estão dentro da carteira
  define: { "import.meta.env.VITE_APP_VARIANT": JSON.stringify("carteira") },
  css: { postcss: __dirname },
  resolve: {
    alias: {
      "@carteira": path.resolve(__dirname, "carteira/src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-carteira"),
    emptyOutDir: true,
  },
});
