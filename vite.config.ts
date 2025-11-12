import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// .env(.local) пример:
// VITE_HOST=0.0.0.0
// VITE_PORT=8080
export default defineConfig(({ mode }) => {
  const HOST = process.env.VITE_HOST || "0.0.0.0";   // можно поставить "192.168.8.79" или "med-alatau.local"
  const PORT = Number(process.env.VITE_PORT || 8080);

  return {
    server: {
      host: HOST,         // фиксируем хост
      port: PORT,         // фиксируем порт
      strictPort: true,   // если порт занят — не прыгать на другой, а упасть с ошибкой
      // при работе по LAN иногда полезно:
      // hmr: { host: HOST, clientPort: PORT },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});













// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import { componentTagger } from "lovable-tagger";
//
// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",
//     port: 8080,
//   },
//   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));
