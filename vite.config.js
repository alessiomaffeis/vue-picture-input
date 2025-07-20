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
      fileName: (format) =>
        `vue-picture-input.${format === "umd" ? "js" : format}`,
      formats: ["umd"],
    },
    outDir: "umd",
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
