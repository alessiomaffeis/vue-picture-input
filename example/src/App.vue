<template>
  <div id="app">
    <picture-input name="profilePic" @change="onChange()" width="600" height="600" margin="16" accept="image/jpeg,image/png"></picture-input>
  </div>
</template>

<script>
import PictureInput from './components/PictureInput'

export default {
  name: 'app',
  components: {
    PictureInput
  },
  methods: {
    onChange () {
      console.log('Picture Changed')
    }
  }
}
</script>

<style>
#app {
  font-family: 'Futura', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
