<script setup lang="ts">
import { 取文案 } from '../文案';

defineProps<{ zongShu: number; dangQianYe: number; shiFouShouYe: boolean }>();

defineEmits<{ (事件: 'shangYe' | 'xiaYe'): void }>();
</script>

<template>
  <div class="分页条">
    <span class="总数">
      {{ 取文案('通用', '总数前缀') }}{{ zongShu }}{{ 取文案('通用', '总数后缀') }} · {{ dangQianYe }}
    </span>
    <button
      type="button"
      class="按钮次"
      :disabled="shiFouShouYe"
      @click="$emit('shangYe')"
    >
      {{ 取文案('通用', '上一页') }}
    </button>
    <button
      type="button"
      class="按钮次"
      @click="$emit('xiaYe')"
    >
      {{ 取文案('通用', '下一页') }}
    </button>
  </div>
</template>
