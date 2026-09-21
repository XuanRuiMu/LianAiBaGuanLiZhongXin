import {
  createRouter,
  createWebHistory,
  type Router,
  type RouteRecordRaw,
} from 'vue-router';
import { 可免登录进入, 读令牌 } from '../stores/登录';

export const 路由表: RouteRecordRaw[] = [
  { path: '/', redirect: '/zhang-hao' },
  {
    path: '/deng-lu',
    name: 'dengLu',
    component: () => import('../views/登录页.vue'),
    meta: { xuYaoDengLu: false },
  },
  {
    path: '/zhang-hao',
    name: 'zhangHaoLieBiao',
    component: () => import('../views/账号列表.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/zhang-hao/:yongHuId',
    name: 'zhangHaoXiangQing',
    component: () => import('../views/账号详情.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/liao-tian',
    name: 'liaoTianJiLu',
    component: () => import('../views/聊天记录.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/si-kao-lian',
    name: 'siKaoLian',
    component: () => import('../views/思考链.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/feng-jin',
    name: 'fengJinGuanLi',
    component: () => import('../views/封禁管理.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/shen-ji',
    name: 'shenJiRiZhi',
    component: () => import('../views/审计日志.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/tong-ji',
    name: 'tongJiTuBiao',
    component: () => import('../views/统计图表.vue'),
    meta: { xuYaoDengLu: true },
  },
  {
    path: '/shen-he',
    name: 'shenHeYunYing',
    component: () => import('../views/审核运营.vue'),
    meta: { xuYaoDengLu: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/deng-lu' },
];

export function 守卫判定(目标路径: string, 令牌: string | null, 可免登录 = true): string | null {
  const 已登录 = 令牌 !== null && 令牌.length > 0 && 可免登录;
  if (目标路径 === '/deng-lu') {
    return 已登录 ? '/zhang-hao' : null;
  }
  const 匹配 = 路由表.find((路由) => 路由.path === 目标路径);
  const 元信息 = 匹配?.meta as { xuYaoDengLu?: boolean } | undefined;
  const 需登录 = 元信息?.xuYaoDengLu ?? true;
  if (需登录 && !已登录) {
    return '/deng-lu';
  }
  return null;
}

export function 注册守卫(路由实例: Router): void {
  路由实例.beforeEach((目标) => {
    const 跳转 = 守卫判定(目标.path, 读令牌(), 可免登录进入());
    if (跳转 !== null) {
      return 跳转;
    }
    return true;
  });
}

const 路由器 = createRouter({
  history: createWebHistory(),
  routes: 路由表,
});

注册守卫(路由器);

export default 路由器;
