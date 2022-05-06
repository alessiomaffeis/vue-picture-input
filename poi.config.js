module.exports = {
  entry: './PictureInput.vue',
  output: {
    fileNames: {
      js: 'vue-picture-input.js'
    },
    moduleName: 'PictureInput',
    dir: 'umd',
    sourceMap: false,
    html: false,
    format: 'umd'
  },
  css: {
    extract: false
  }
}