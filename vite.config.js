import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

import { resolve } from "path";

export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, "PictureInput.vue"),
      name: "PictureInput",
      fileName: "vue-picture-input",
      formats: ["umd"],
    },
    outDir: "dist",
    cssCodeSplit: false,
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
  },
});
