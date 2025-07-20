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
      fileName: (format) => {
        if (format === "es") return "vue-picture-input.es.js";
        if (format === "cjs") return "vue-picture-input.cjs.js";
        if (format === "umd") return "vue-picture-input.umd.js";
        return `vue-picture-input.${format}.js`;
      },
      formats: ["es", "cjs", "umd"],
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
