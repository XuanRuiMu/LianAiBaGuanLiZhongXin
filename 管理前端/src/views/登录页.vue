<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { 管理登录 } from '../api/管理';
import { 取错误展示 } from '../api/请求';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import { 登录文案 } from '../文案/登录';

const 登录仓库 = 使用登录仓库();
const 路由器 = useRouter();
const 手机号 = ref(读记住账号());
const 密码 = ref('');
const 草稿选项 = ref<登录选项>(读登录选项());
const 错误提示 = ref('');
const 错误码 = ref('');
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
  if (手机号.value.trim().length === 0 || 密码.value.length === 0) {
    错误提示.value = 登录文案.账号或密码为空;
    错误码.value = '';
    return;
  }
  提交中.value = true;
  错误提示.value = '';
  错误码.value = '';
  try {
    const 结果 = await 管理登录({
      shou_ji_hao: 手机号.value.trim(),
      mi_ma: 密码.value,
      chi_jiu_hui_hua: 选项.value.记住密码,
    });
    if (!登录仓库.设置令牌('yi_deng_lu', 选项.value.记住密码)) {
      错误提示.value = 登录文案.令牌过长;
      错误码.value = '';
      return;
    }
    写记住账号(选项.value.记住账号 ? 手机号.value : '');
    // YH-108 首屏权限视图直接取登录响应的服务端角色与能力，不等身份接口回来
    登录仓库.设置身份(结果.jiao_se, 结果.neng_li);
    密码.value = '';
    void 路由器.push('/zhang-hao');
  } catch (错误) {
    const 展示 = 取错误展示(错误);
    错误提示.value = 展示.提示;
    错误码.value = 展示.错误码;
  } finally {
    提交中.value = false;
  }
}
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
        :wen-ben="错误提示"
        :cuo-wu-ma="错误码"
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
