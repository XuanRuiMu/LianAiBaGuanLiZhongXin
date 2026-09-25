<script setup lang="ts">
import type { 表格行 } from '../api/管理';
import { 单元格文本, 单元格色调, 单元格类, 表头文本, 渲染为徽标, 渲染为链接, type 列 } from '../列定义';
import { 通用文案 } from '../文案/通用';

withDefaults(
  defineProps<{
    lie: readonly 列[];
    hang: readonly 表格行[];
    hangJian?: string | null;
    quLianJie?: ((行: 表格行) => string) | null;
  }>(),
  { hangJian: 'ID', quLianJie: null },
);
</script>

<template>
  <Transition name="块">
    <div
      v-if="hang.length > 0"
      class="表滚"
    >
      <table class="账簿表">
        <thead>
          <tr>
            <th
              v-for="(项, 序号) in lie"
              :key="序号"
            >
              {{ 表头文本(项) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(行, 序号) in hang"
            :key="String(行[hangJian ?? ''] ?? 序号)"
            :style="{ '--位': Math.min(序号, 7) }"
          >
            <td
              v-for="(项, 列号) in lie"
              :key="列号"
              :class="单元格类(项)"
            >
              <span
                v-if="渲染为徽标(项)"
                class="徽标"
                :class="单元格色调(项, 行)"
                :data-testid="项.测试标识"
              >{{ 单元格文本(项, 行) }}</span>
              <template v-else-if="渲染为链接(项)">
                <router-link
                  v-if="quLianJie"
                  :to="quLianJie(行)"
                >
                  {{ 通用文案.详情 }}
                </router-link>
                <slot
                  v-if="项.插槽"
                  :name="项.插槽"
                  :hang="行"
                  :xu-hao="序号"
                />
              </template>
              <slot
                v-else-if="项.插槽"
                :name="项.插槽"
                :hang="行"
                :xu-hao="序号"
              />
              <template v-else>
                {{ 单元格文本(项, 行) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Transition>
</template>
