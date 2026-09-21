<script setup lang="ts">
defineProps<{ biaoTi: string; shuoMing?: string }>();
</script>

<template>
  <div class="页眉">
    <h2>{{ biaoTi }}</h2>
    <p
      v-if="shuoMing"
      class="页眉说明"
    >
      {{ shuoMing }}
    </p>
    <slot />
  </div>
</template>
