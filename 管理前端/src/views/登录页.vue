<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { 使用登录仓库 } from '../stores/登录';
import { 管理登录 } from '../api/管理';
import { 取文案 } from '../文案';

const 登录仓库 = 使用登录仓库();
const 路由器 = useRouter();
const 手机号 = ref('');
const 密码 = ref('');
const 错误提示 = ref('');
const 提交中 = ref(false);

async function 提交(): Promise<void> {
  if (手机号.value.trim().length === 0 || 密码.value.length === 0) {
    错误提示.value = 取文案('登录', '账号或密码为空');
    return;
  }
  提交中.value = true;
  错误提示.value = '';
  try {
    const 结果 = await 管理登录({ shou_ji_hao: 手机号.value.trim(), mi_ma: 密码.value });
    if (!登录仓库.设置令牌('yi_deng_lu')) {
      错误提示.value = 取文案('登录', '令牌过长');
      return;
    }
    void 结果;
    密码.value = '';
    void 路由器.push('/zhang-hao');
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    提交中.value = false;
  }
}
</script>

<template>
  <section class="登录栅">
    <div class="宣言">
      <p class="眉题">
        <span class="眉题序号">执印 · 监察</span>
      </p>
      <h2 class="宣言题">
        {{ 取文案('通用', '应用标题') }}
      </h2>
      <p class="宣言文">
        账号、聊天、思考链、封禁、审计、统计——六部卷宗，一印通行。
      </p>
      <dl class="宣言例">
        <div>
          <dt>壹</dt>
          <!-- YH-106 自称读写：读写分离管理，读掩码写留痕 -->
          <dd>读写分离监察，读掩码写留痕</dd>
        </div>
        <div>
          <dt>贰</dt>
          <dd>账号密码登录，管理后端直连同库验密签发</dd>
        </div>
        <div>
          <dt>叁</dt>
          <dd>思考链落库回放为准，缺失能力如实标待补充</dd>
        </div>
      </dl>
    </div>
    <div class="印卡">
      <span
        class="印章 印卡章"
        aria-hidden="true"
      >恋管</span>
      <h2>{{ 取文案('登录', '标题') }}</h2>
      <p class="印卡说明">
        {{ 取文案('登录', '说明') }}
      </p>
      <label class="字段">
        {{ 取文案('登录', '手机号标签') }}
        <input
          v-model="手机号"
          class="输入"
          type="tel"
          autocomplete="username"
          :placeholder="取文案('登录', '手机号占位')"
          data-testid="shou-ji-hao-shu-ru"
        >
      </label>
      <label class="字段">
        {{ 取文案('登录', '密码标签') }}
        <input
          v-model="密码"
          class="输入"
          type="password"
          autocomplete="current-password"
          :placeholder="取文案('登录', '密码占位')"
          data-testid="mi-ma-shu-ru"
          @keyup.enter="提交"
        >
      </label>
      <p
        v-if="错误提示.length > 0"
        class="错误条"
        data-testid="cuo-wu-ti-shi"
      >
        {{ 错误提示 }}
      </p>
      <button
        type="button"
        class="按钮主 印卡钮"
        data-testid="deng-lu-an-niu"
        :disabled="提交中"
        @click="提交"
      >
        {{ 取文案('登录', '登录按钮') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.登录栅 {
  display: grid;
  gap: 26px;
  grid-template-columns: 1fr;
  align-items: start;
  max-width: 960px;
  margin: clamp(8px, 4vh, 48px) auto 0;
}

.宣言 {
  padding: 12px 4px;
}

.宣言题 {
  margin: 0;
  font-size: clamp(38px, 7vw, 64px);
  font-weight: 900;
  letter-spacing: 6px;
}

.宣言文 {
  margin: 12px 0 0;
  color: var(--淡墨);
  font-size: 16px;
  max-width: 40ch;
}

.宣言例 {
  margin: 22px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 2px solid var(--印);
}

.宣言例 > div {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
  padding: 11px 2px;
  border-bottom: 1px solid var(--线);
  align-items: baseline;
}

.宣言例 dt {
  font-family: var(--展示字);
  font-weight: 900;
  color: var(--印);
  font-size: 18px;
}

.宣言例 dd {
  margin: 0;
  font-size: 14px;
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

.印卡章 {
  position: absolute;
  top: -22px;
  right: 24px;
  transform: rotate(6deg);
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

.印卡钮 {
  width: 100%;
  margin-top: 4px;
}

.错误条 {
  margin: 0;
}

@media (min-width: 900px) {
  .登录栅 {
    grid-template-columns: 7fr 6fr;
    gap: 40px;
  }

  .宣言 {
    padding-top: 34px;
  }
}
</style>
