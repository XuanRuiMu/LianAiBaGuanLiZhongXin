<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 使用登录仓库 } from './stores/登录';
import { 取管理角色文案 } from './枚举映射/管理角色';
import { 我的身份 } from './api/管理';
import { 应用主题, 深色, 浅色, 读初始主题, type 主题名 } from './主题模式';
import TuBiao from './components/TuBiao.vue';
import { 通用文案 } from './文案/通用';
import { 导航文案 } from './文案/导航';

const 登录仓库 = 使用登录仓库();
const 当前路由 = useRoute();
const 路由器 = useRouter();
const 是否登录页 = computed(() => 当前路由.path === '/deng-lu');
const 主题 = ref<主题名>(浅色);
const 身份请求中 = ref(false);

const 导航 = [
  { 路径: '/zhang-hao', 文案键: '账号管理', 图标名: 'zhang-hao', 需能力: 'cha_kan' },
  { 路径: '/liao-tian', 文案键: '聊天记录', 图标名: 'liao-tian', 需能力: 'cha_kan' },
  { 路径: '/si-kao-lian', 文案键: '思考链', 图标名: 'si-kao', 需能力: 'cha_kan' },
  { 路径: '/feng-jin', 文案键: '封禁管理', 图标名: 'feng-jin', 需能力: 'cha_kan' },
  { 路径: '/shen-ji', 文案键: '审计日志', 图标名: 'shen-ji', 需能力: 'cha_kan' },
  { 路径: '/tong-ji', 文案键: '统计图表', 图标名: 'tong-ji', 需能力: 'tong_ji_xie' },
  { 路径: '/shen-he', 文案键: '审核运营', 图标名: 'jing-shi', 需能力: 'cha_kan' },
] as const;

// YH-108 菜单条目按服务端下发的能力位过滤，条目→能力的对应关系只有这一份
const 可见导航 = computed(() => 导航.filter((项) => 登录仓库.能力列表.includes(项.需能力)));

/** YH-108 权限视图重建：角色与能力只取服务端身份接口，前端隐藏入口不是安全边界 */
async function 同步身份(强制 = false): Promise<void> {
  if (!登录仓库.已登录 || (!强制 && 登录仓库.管理角色 !== null) || 身份请求中.value) {
    return;
  }
  身份请求中.value = true;
  try {
    const 身份 = await 我的身份();
    登录仓库.设置身份(身份.jiao_se, 身份.neng_li);
  } catch {
    return;
  } finally {
    身份请求中.value = false;
  }
}

watch(
  () => 当前路由.path,
  () => {
    登录仓库.同步存储();
    void 同步身份();
  },
);

watch(主题, (值) => {
  应用主题(值);
});

function 切换主题(): void {
  主题.value = 主题.value === 浅色 ? 深色 : 浅色;
}

async function 退出(): Promise<void> {
  if (登录仓库.已登录) {
    await 登录仓库.注销会话();
  }
  登录仓库.退出登录();
  void 路由器.push('/deng-lu');
}

onMounted(async () => {
  主题.value = 读初始主题();
  应用主题(主题.value);
  登录仓库.同步存储();
  // FP-03 冷启动一律先续期再复核身份：跨浏览器重开时访问令牌是否还有效只有服务端知道
  await 登录仓库.续期会话();
  // 每次装载都向服务端复核身份，本地缓存的角色只作首屏提示
  void 同步身份(true);
  登录仓库.启动续期巡查();
});

onBeforeUnmount(() => {
  登录仓库.停止续期巡查();
});
</script>

<template>
  <div
    class="外壳"
    :class="[登录仓库.已登录 && !是否登录页 ? '有栏' : '', 是否登录页 ? '登录页' : '']"
  >
    <aside
      v-if="登录仓库.已登录 && !是否登录页"
      class="侧栏"
    >
      <div class="栏头">
        <p class="栏题">
          {{ 通用文案.应用标题 }}
        </p>
      </div>
      <nav
        class="栏导航"
        :aria-label="导航文案.管理导航"
      >
        <router-link
          v-for="项 in 可见导航"
          :key="项.路径"
          :to="项.路径"
        >
          <TuBiao :ming-cheng="项.图标名" />
          {{ 导航文案[项.文案键] }}
        </router-link>
      </nav>
      <div class="栏尾">
        <p
          class="栏角色"
          data-testid="dang-qian-jiao-se"
        >
          {{ 登录仓库.管理角色 === null ? 通用文案.加载中 : 取管理角色文案(登录仓库.管理角色) }}
        </p>
        <button
          type="button"
          class="栏按钮"
          @click="切换主题"
        >
          <TuBiao :ming-cheng="主题 === 浅色 ? 'yue-liang' : 'tai-yang'" />
          {{ 主题 === 浅色 ? 导航文案.深色主题 : 导航文案.浅色主题 }}
        </button>
        <button
          type="button"
          class="栏按钮"
          @click="退出"
        >
          <TuBiao ming-cheng="tui-chu" />
          {{ 导航文案.退出登录 }}
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
  min-height: 100dvh;
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

.栏角色 {
  margin: 0;
  padding: 0 14px;
  color: var(--淡墨);
  font-size: 12.5px;
  letter-spacing: 1px;
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
  --正文距纵: clamp(20px, 4vw, 44px);
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--正文距纵) clamp(16px, 4vw, 40px) 72px;
}

.外壳.登录页 .正文 {
  min-height: 100dvh;
  display: grid;
  padding-bottom: var(--正文距纵);
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
