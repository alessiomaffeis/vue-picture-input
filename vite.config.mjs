import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./PictureInput.vue", import.meta.url)),
      name: "PictureInput",
      fileName: "vue-picture-input",
      formats: ["umd"],
    },
    outDir: "dist",
    cssCodeSplit: false,
    rolldownOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
  },
});
