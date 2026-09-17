<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 使用登录仓库 } from './stores/登录';
import { 取文案 } from './文案';
import { 应用主题, 读初始主题, type 主题名 } from './主题模式';
import TuBiao from './components/TuBiao.vue';

const 登录仓库 = 使用登录仓库();
const 当前路由 = useRoute();
const 路由器 = useRouter();
const 是否登录页 = computed(() => 当前路由.path === '/deng-lu');
const 主题 = ref<主题名>('浅');

const 导航 = [
  { 路径: '/zhang-hao', 文案键: '账号管理', 图标名: '账号' },
  { 路径: '/liao-tian', 文案键: '聊天记录', 图标名: '聊天' },
  { 路径: '/si-kao-lian', 文案键: '思考链', 图标名: '思考' },
  { 路径: '/feng-jin', 文案键: '封禁管理', 图标名: '封禁' },
  { 路径: '/shen-ji', 文案键: '审计日志', 图标名: '审计' },
  { 路径: '/tong-ji', 文案键: '统计图表', 图标名: '统计' },
  { 路径: '/shen-he', 文案键: '审核运营', 图标名: '警示' },
] as const;

watch(
  () => 当前路由.path,
  () => {
    登录仓库.同步存储();
  },
);

watch(主题, (值) => {
  应用主题(值);
});

function 切换主题(): void {
  主题.value = 主题.value === '浅' ? '深' : '浅';
}

function 退出(): void {
  登录仓库.退出登录();
  void 路由器.push('/deng-lu');
}

onMounted(() => {
  主题.value = 读初始主题();
  应用主题(主题.value);
});
</script>

<template>
  <div
    class="外壳"
    :class="登录仓库.已登录 && !是否登录页 ? '有栏' : ''"
  >
    <aside
      v-if="登录仓库.已登录 && !是否登录页"
      class="侧栏"
    >
      <div class="栏头">
        <span
          class="印章"
          aria-hidden="true"
        >恋管</span>
        <p class="栏题">
          {{ 取文案('通用', '应用标题') }}
        </p>
      </div>
      <nav
        class="栏导航"
        aria-label="管理导航"
      >
        <router-link
          v-for="项 in 导航"
          :key="项.路径"
          :to="项.路径"
        >
          <TuBiao :ming-cheng="项.图标名" />
          {{ 取文案('导航', 项.文案键) }}
        </router-link>
      </nav>
      <div class="栏尾">
        <button
          type="button"
          class="栏按钮"
          @click="切换主题"
        >
          <TuBiao :ming-cheng="主题 === '浅' ? '月亮' : '太阳'" />
          {{ 主题 === '浅' ? '深色' : '浅色' }}
        </button>
        <button
          type="button"
          class="栏按钮"
          @click="退出"
        >
          <TuBiao ming-cheng="退出" />
          {{ 取文案('导航', '退出登录') }}
        </button>
      </div>
    </aside>
    <div class="正文区">
      <main class="正文">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.外壳 {
  min-height: 100vh;
}

.侧栏 {
  background: var(--面);
  border-right: 1px solid var(--线);
}

.栏头 {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px 16px;
  border-bottom: 2px solid var(--印);
}

.栏题 {
  margin: 0;
  font-family: var(--展示字);
  font-weight: 900;
  font-size: 17px;
  letter-spacing: 3px;
}

.栏导航 {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 12px;
}

.栏导航 a {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 14px;
  border-radius: var(--圆小);
  border-left: 4px solid transparent;
  color: var(--墨);
  text-decoration: none;
  font-weight: 700;
  font-size: 14.5px;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.栏导航 a:hover {
  background: var(--印淡);
  color: var(--印);
}

.栏导航 a.路由激活,
.栏导航 a.router-link-active {
  background: var(--印淡);
  border-left-color: var(--印);
  color: var(--印);
}

.栏尾 {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-top: 1px solid var(--线);
}

.栏按钮 {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--圆小);
  cursor: pointer;
  color: var(--淡墨);
  font-size: 14px;
  transition: border-color 160ms ease, color 160ms ease;
}

.栏按钮:hover {
  border-color: var(--线);
  color: var(--墨);
}

.正文区 {
  min-width: 0;
}

.正文 {
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 40px) 72px;
}

@media (min-width: 960px) {
  .外壳.有栏 {
    display: grid;
    grid-template-columns: 248px minmax(0, 1fr);
    align-items: start;
  }

  .侧栏 {
    position: sticky;
    top: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .栏导航 {
    flex: 1;
  }
}
</style>
