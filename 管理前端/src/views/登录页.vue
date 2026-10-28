<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  使用登录仓库,
  归一登录选项,
  读登录选项,
  读记住账号,
  写登录选项,
  写记住账号,
  type 登录选项,
} from '../stores/登录';
import { 管理登录 } from '../api/会话';
import { 创建前端错误, 前端错误码 } from '../api/请求';
import { 创建请求错误状态, 执行请求 } from '../api/错误展示';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import { 登录文案 } from '../文案/登录';
import { 通用文案 } from '../文案/通用';

const 登录仓库 = 使用登录仓库();
const 路由器 = useRouter();
/** 手机号口径与后端 校验.ts:26 `手机号表达式` 完全一致，前端预检不另造一套 */
const 手机号表达式 = /^1[3-9]\d{9}$/;
const 手机号 = ref(读记住账号());
const 密码 = ref('');
const 草稿选项 = ref<登录选项>(读登录选项());
const 错误状态 = 创建请求错误状态();
const {
  错误闸门,
  清空: 清空错误,
  作废: 作废错误,
} = 错误状态;
const 提交中 = ref(false);

/** 生效值只由唯一归一点派生，勾选/取消/回读三条路径共用同一条不变量 */
const 选项 = computed(() => 归一登录选项(草稿选项.value));

watch(
  草稿选项,
  (值) => {
    const 规范 = 归一登录选项(值);
    写登录选项(规范);
    if (规范.自动登录 !== 值.自动登录) {
      草稿选项.value = 规范;
    }
  },
  { deep: true },
);

async function 提交(): Promise<void> {
  错误闸门.开始();
  const 手机号文本 = 手机号.value.trim();
  if (手机号文本.length === 0 || 密码.value.length === 0) {
    清空错误(创建前端错误(登录文案.账号或密码为空));
    提交中.value = false;
    return;
  }
  if (!手机号表达式.test(手机号文本)) {
    清空错误(创建前端错误(通用文案.请求失败, 前端错误码.本地校验));
    提交中.value = false;
    return;
  }
  await 执行请求(
    错误状态,
    提交中,
    () => 管理登录({
      shou_ji_hao: 手机号文本,
      mi_ma: 密码.value,
      chi_jiu_hui_hua: 选项.value.记住密码,
    }),
    (结果) => {
      if (!登录仓库.设置令牌('yi_deng_lu', 选项.value.记住密码)) {
        throw 创建前端错误(登录文案.令牌过长);
      }
      写记住账号(选项.value.记住账号 ? 手机号.value : '');
      登录仓库.设置身份(结果.jiao_se, 结果.neng_li);
      密码.value = '';
      void 路由器.push('/zhang-hao');
    },
    提交,
  );
}

onBeforeUnmount(() => {
  作废错误();
});
</script>

<template>
  <section class="登录栅">
    <div class="印卡">
      <h2>{{ 登录文案.标题 }}</h2>
      <p class="印卡说明">
        {{ 登录文案.说明 }}
      </p>
      <label class="字段">
        {{ 登录文案.手机号标签 }}
        <input
          v-model="手机号"
          class="输入"
          type="tel"
          maxlength="11"
          autocomplete="username"
          data-testid="shou-ji-hao-shu-ru"
        >
      </label>
      <label class="字段">
        {{ 登录文案.密码标签 }}
        <input
          v-model="密码"
          class="输入"
          type="password"
          maxlength="200"
          autocomplete="current-password"
          data-testid="mi-ma-shu-ru"
          @keyup.enter="提交"
        >
      </label>
      <label class="字段 选项">
        {{ 登录文案.记住账号 }}
        <input
          v-model="草稿选项.记住账号"
          type="checkbox"
          data-testid="ji-zhu-zhang-hao-gou"
        >
      </label>
      <label class="字段 选项">
        {{ 登录文案.记住密码 }}
        <input
          v-model="草稿选项.记住密码"
          type="checkbox"
          data-testid="ji-zhu-mi-ma-gou"
        >
      </label>
      <label class="字段 选项">
        {{ 登录文案.自动登录 }}
        <input
          v-model="草稿选项.自动登录"
          type="checkbox"
          :disabled="!选项.记住密码"
          data-testid="zi-dong-deng-lu-gou"
        >
      </label>
      <XiaoXiTiao
        xing-tai="cuo-wu"
        :错误状态="错误状态"
        ce-shi-biao-shi="cuo-wu-ti-shi"
      />
      <button
        type="button"
        class="按钮主 印卡钮"
        data-testid="deng-lu-an-niu"
        :disabled="提交中"
        @click="提交"
      >
        {{ 登录文案.登录按钮 }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.登录栅 {
  display: grid;
  gap: 26px;
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  max-height: 100%;
  width: 100%;
  max-width: 960px;
  margin: auto;
}

.印卡 {
  position: relative;
  background: var(--面);
  border: 1px solid var(--线);
  border-top: 6px solid var(--印);
  border-radius: var(--圆大);
  box-shadow: var(--影);
  padding: 30px 28px;
  min-height: 0;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.印卡 h2 {
  margin: 0;
  font-size: 26px;
  letter-spacing: 3px;
}

.印卡说明 {
  margin: 0;
  font-size: 13.5px;
  color: var(--淡墨);
}

.错误条 {
  margin: 0;
}

.印卡钮 {
  width: 100%;
  margin-top: 4px;
}

.选项 {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
</style>
