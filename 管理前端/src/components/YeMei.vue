<script setup lang="ts">
defineProps<{ xuHao: string; biaoTi: string; shuoMing?: string }>();
</script>

<template>
  <div class="页眉">
    <p class="眉题">
      <span class="眉题序号">{{ xuHao }}</span>
    </p>
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
