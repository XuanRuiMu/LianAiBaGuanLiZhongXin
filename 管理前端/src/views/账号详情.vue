<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 账号详情, type 表格行 } from '../api/管理';
import { 取错误展示 } from '../api/请求';
import { 取管理角色文案, 取管理角色色调 } from '../枚举映射/管理角色';
import { 单元格文本, 单元格色调, 列定义登记, 取列映射, 响应行键, 表头文本, 渲染为徽标 } from '../列定义';
import YeMei from '../components/YeMei.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';

const 当前路由 = useRoute();
const 路由器 = useRouter();
const 详情 = ref<表格行 | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');
const 错误码 = ref('');

const 详情行 = computed<表格行>(() => 详情.value ?? {});
const 概览列 = 取列映射('账号概览');

async function 查询(): Promise<void> {
  const 用户编号 = 当前路由.params.yongHuId;
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    错误提示.value = 通用文案.请求失败;
    错误码.value = '';
    return;
  }
  加载中.value = true;
  错误提示.value = '';
  错误码.value = '';
  try {
    详情.value = await 账号详情(用户编号);
  } catch (错误) {
    const 展示 = 取错误展示(错误);
    错误提示.value = 展示.提示;
    错误码.value = 展示.错误码;
    if (展示.提示 === 通用文案.登录过期) {
      void 路由器.push('/deng-lu');
    }
  } finally {
    加载中.value = false;
  }
}

function 返回(): void {
  void 路由器.push('/zhang-hao');
}

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei :biao-ti="账号文案.详情标题" />
    <XiaoXiTiao
      xing-tai="jia-zai"
      :xian-shi="加载中"
    />
    <XiaoXiTiao
      xing-tai="cuo-wu"
      :wen-ben="错误提示"
      :cuo-wu-ma="错误码"
    />
    <Transition name="块">
      <div
        v-if="详情"
        class="双栏 反"
      >
        <div class="卡片 人物卡">
          <h3 class="人物名">
            {{ 单元格文本(概览列.昵称, 详情行) }}
          </h3>
          <p class="人物号">
            {{ 单元格文本(概览列.用户名, 详情行) }}
          </p>
          <span
            class="徽标"
            :class="取管理角色色调(详情[响应行键.角色])"
            data-testid="jiao-se-hui"
          >{{ 取管理角色文案(详情[响应行键.角色]) }}</span>
        </div>
        <dl class="卷宗">
          <div
            v-for="项 in 列定义登记.账号详情"
            :key="String(项.数据键)"
          >
            <dt>{{ 表头文本(项) }}</dt>
            <dd>
              <span
                v-if="渲染为徽标(项)"
                class="徽标"
                :class="单元格色调(项, 详情行)"
              >{{ 单元格文本(项, 详情行) }}</span>
              <template v-else>
                {{ 单元格文本(项, 详情行) }}
              </template>
            </dd>
          </div>
        </dl>
      </div>
    </Transition>
    <button
      type="button"
      class="按钮次"
      @click="返回"
    >
      <TuBiao ming-cheng="fan-hui" />
      {{ 通用文案.返回 }}
    </button>
  </section>
</template>

<style scoped>
.人物卡 {
  text-align: center;
  border-top: 6px solid var(--印);
}

.人物名 {
  margin: 0;
  font-size: 24px;
  letter-spacing: 2px;
}

.人物号 {
  margin: 4px 0 12px;
  color: var(--淡墨);
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
