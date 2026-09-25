<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { 创建请求错误状态, 执行请求 } from '../api/错误展示';
import { 就绪检查 } from '../api/探针';
import XiaoXiTiao from './XiaoXiTiao.vue';

const 错误状态 = 创建请求错误状态();

function 检查(): Promise<void> {
  return 执行请求(错误状态, undefined, 就绪检查, () => undefined, 检查);
}

onMounted(() => {
  void 检查();
});

onBeforeUnmount(() => {
  错误状态.作废();
});
</script>

<template>
  <XiaoXiTiao
    xing-tai="cuo-wu"
    :错误状态="错误状态"
    ce-shi-biao-shi="ji-dui-jian-kong"
  />
</template>
