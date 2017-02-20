<template>
  <div id="app">
    <picture-input @change="onChange()" width="600" height="600" margin="16" accept="image/jpeg,image/png"></picture-input>
  </div>
</template>

<script>

import PictureInput from 'vue-picture-input'

export default {
  name: 'app',
  data () {
    return {
      msg: 'Welcome to Your Vue.js App'
    }
  },
  components: {
    PictureInput
  },
  methods: {
    onChange () {
      console.log("Picture changed!")
    }
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

h1, h2 {
  font-weight: normal;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

a {
  color: #42b983;
}
</style>
