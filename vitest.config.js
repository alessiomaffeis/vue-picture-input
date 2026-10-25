import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue2";
import { fileURLToPath } from "node:url";
import { vue3 } from "./test/helpers/vue3-plugin.js";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue()],
        resolve: {
          alias: { "@test-utils": "@vue/test-utils" },
        },
        test: {
          name: "vue2",
          environment: "jsdom",
          include: ["test/**/*.spec.js"],
        },
      },
      {
        plugins: [vue3()],
        resolve: {
          alias: [
            {
              find: /^vue$/,
              replacement: fileURLToPath(
                new URL("./node_modules/vue3/dist/vue.esm-bundler.js", import.meta.url)
              ),
            },
            {
              find: "@test-utils",
              replacement: fileURLToPath(
                new URL("./node_modules/@vue/test-utils-vue3/dist/vue-test-utils.esm-bundler.mjs", import.meta.url)
              ),
            },
          ],
        },
        test: {
          name: "vue3",
          environment: "jsdom",
          include: ["test/**/*.spec.js"],
          exclude: ["test/PictureInput.spec.js"],
          server: { deps: { inline: [/@vue\/test-utils-vue3/] } },
        },
      },
    ],
  },
});
