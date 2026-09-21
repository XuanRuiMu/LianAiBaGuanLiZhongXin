<script setup lang="ts">
import { 通用文案 } from '../文案/通用';

defineProps<{ zongShu: number; dangQianYe: number; shiFouShouYe: boolean }>();

defineEmits<{ (事件: 'shangYe' | 'xiaYe'): void }>();
</script>

<template>
  <div class="分页条">
    <span class="总数">
      {{ 通用文案.总数前缀 }}{{ zongShu }}{{ 通用文案.总数后缀 }} · {{ dangQianYe }}
    </span>
    <button
      type="button"
      class="按钮次"
      :disabled="shiFouShouYe"
      @click="$emit('shangYe')"
    >
      {{ 通用文案.上一页 }}
    </button>
    <button
      type="button"
      class="按钮次"
      @click="$emit('xiaYe')"
    >
      {{ 通用文案.下一页 }}
    </button>
  </div>
</template>
