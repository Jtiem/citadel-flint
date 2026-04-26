<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>

<script>
export default {
  data() {
    return { title: 'Hello Vue' }
  }
}
</script>

<style scoped>
.container { padding: 16px; }
</style>
