import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

import { resolve } from "path";

export default defineConfig({
  plugins: [
    vue(),
    ...(process.env.BUILD_FORMAT === "umd" ? [cssInjectedByJsPlugin()] : []),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "PictureInput.vue"),
      name: "PictureInput",
      fileName: (format) => {
        if (format === "es") return "vue-picture-input.es.js";
        if (format === "umd") return "vue-picture-input.umd.js";
        return `vue-picture-input.${format}.js`;
      },
      formats: process.env.BUILD_FORMAT
        ? [process.env.BUILD_FORMAT]
        : ["es", "umd"],
    },
    outDir: "dist",
    emptyOutDir: process.env.BUILD_FORMAT ? false : true,
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
