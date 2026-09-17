<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { 账号列表, 授予管理员, 回收管理员, 夺舍角色, 归还角色, type 表格行 } from '../api/管理';
import { 使用登录仓库 } from '../stores/登录';
import type { 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import TuBiao from '../components/TuBiao.vue';

const 关键词 = ref('');
const 手机号 = ref('');
const 登录仓库 = 使用登录仓库();
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 加载中 = ref(false);
const 错误提示 = ref('');

const 总数 = computed(() => 分页.value?.zong_shu ?? 行列表.value.length);
const 当前页 = computed(() => 分页.value?.ye_ma ?? 默认页码);
const 管理员数 = computed(() => 行列表.value.filter((行) => 行['管理员'] === true).length);
const 角色编号 = ref('');
const 操作提示 = ref('');

function 显示值(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  return String(值);
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  try {
    const 结果 = await 账号列表({
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      guan_jian_ci: 关键词.value.trim() === '' ? undefined : 关键词.value.trim(),
      shou_ji_hao: 手机号.value.trim() === '' ? undefined : 手机号.value.trim(),
    });
    行列表.value = 结果.行;
    分页.value = 结果.分页;
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

function 重置(): void {
  关键词.value = '';
  手机号.value = '';
  void 查询();
}

function 上一页(): void {
  const 当前 = 分页.value?.ye_ma ?? 默认页码;
  if (当前 > 1) {
    void 查询(当前 - 1);
  }
}

function 下一页(): void {
  const 当前 = 分页.value?.ye_ma ?? 默认页码;
  void 查询(当前 + 1);
}

async function 授权(用户编号: unknown): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  const 已二次确认 = typeof globalThis.confirm === 'function' ? globalThis.confirm(取文案('账号', '高危二次确认')) : true;
  if (!已二次确认) {
    return;
  }
  try {
    await 授予管理员({ yong_hu_id: 用户编号, que_ren: true });
    操作提示.value = 取文案('封禁', '写入成功');
    await 查询(当前页.value);
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 回收(用户编号: unknown): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  const 已二次确认 = typeof globalThis.confirm === 'function' ? globalThis.confirm(取文案('账号', '高危二次确认')) : true;
  if (!已二次确认) {
    return;
  }
  try {
    await 回收管理员({ yong_hu_id: 用户编号, que_ren: true });
    操作提示.value = 取文案('封禁', '写入成功');
    await 查询(当前页.value);
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 夺舍(): Promise<void> {
  const 编号 = 角色编号.value.trim();
  if (编号 === '') {
    return;
  }
  try {
    await 夺舍角色({ jiao_se_id: 编号 });
    操作提示.value = 取文案('封禁', '写入成功');
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 归还(): Promise<void> {
  const 编号 = 角色编号.value.trim();
  if (编号 === '') {
    return;
  }
  try {
    await 归还角色({ jiao_se_id: 编号 });
    操作提示.value = 取文案('封禁', '写入成功');
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="壹 · 名册"
      :biao-ti="取文案('账号', '标题')"
    >
      <div class="统计卡组">
        <div class="统计卡">
          <p class="卡名">
            {{ 取文案('账号', '总数标签') }}
          </p>
          <p class="卡值">
            {{ 总数 }}
          </p>
        </div>
        <div class="统计卡 黛">
          <p class="卡名">
            {{ 取文案('账号', '管理员数标签') }}
          </p>
          <p class="卡值">
            {{ 管理员数 }}
          </p>
        </div>
      </div>
    </YeMei>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('账号', '关键词占位') }}
        <input
          v-model="关键词"
          class="输入"
          :placeholder="取文案('账号', '关键词占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('账号', '手机号占位') }}
        <input
          v-model="手机号"
          class="输入"
          :placeholder="取文案('账号', '手机号占位')"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="查询()"
      >
        <TuBiao ming-cheng="查询" />
        {{ 取文案('通用', '查询') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="重置"
      >
        {{ 取文案('通用', '重置') }}
      </button>
    </div>
    <p
      v-if="加载中"
      class="加载条"
    >
      {{ 取文案('通用', '加载中') }}
    </p>
    <p
      v-if="错误提示.length > 0"
      class="错误条"
    >
      {{ 错误提示 }}
    </p>
    <p
      v-if="!加载中 && 行列表.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <table
      v-if="行列表.length > 0"
      class="账簿表"
    >
      <thead>
        <tr>
          <th>{{ 取文案('账号', '昵称') }}</th>
          <th>{{ 取文案('账号', '手机号') }}</th>
          <th>{{ 取文案('账号', '是否管理员') }}</th>
          <th>{{ 取文案('账号', '封禁级别') }}</th>
          <th>{{ 取文案('账号', '创建时间') }}</th>
          <th>{{ 取文案('通用', '详情') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 行列表"
          :key="String(行['ID'] ?? '')"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td>{{ 显示值(行, '昵称') }}</td>
          <td class="数字">
            {{ 显示值(行, '手机号') }}
          </td>
          <td>
            <span
              v-if="行['管理员'] === true"
              class="徽标 警"
            >{{ 取文案('账号', '是') }}</span>
            <span
              v-else
              class="徽标 安"
            >{{ 取文案('账号', '否') }}</span>
          </td>
          <td>
            <span
              v-if="String(行['封禁级别'] ?? 'zheng_chang') !== 'zheng_chang'"
              class="徽标 危"
            >{{ 显示值(行, '封禁级别') }}</span>
            <span
              v-else
              class="徽标 安"
            >{{ 取文案('账号', '正常') }}</span>
          </td>
          <td>{{ 显示值(行, '创建时间') }}</td>
          <td>
            <router-link :to="`/zhang-hao/${String(行['ID'] ?? '')}`">
              {{ 取文案('通用', '详情') }}
            </router-link>
            <button
              v-if="登录仓库.是否超管"
              type="button"
              class="按钮次"
              @click="授权(行['ID'])"
            >
              {{ 取文案('账号', '授权按钮') }}
            </button>
            <button
              v-if="登录仓库.是否超管"
              type="button"
              class="按钮次"
              @click="回收(行['ID'])"
            >
              {{ 取文案('账号', '回收按钮') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="操作提示.length > 0"
      class="成功条"
    >
      {{ 操作提示 }}
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('账号', '角色编号占位') }}
        <input
          v-model="角色编号"
          class="输入"
          :placeholder="取文案('账号', '角色编号占位')"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="夺舍"
      >
        {{ 取文案('账号', '夺舍按钮') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="归还"
      >
        {{ 取文案('账号', '归还按钮') }}
      </button>
    </div>
    <FenYeTiao
      v-if="分页"
      :zong-shu="总数"
      :dang-qian-ye="当前页"
      :shi-fou-shou-ye="当前页 <= 1"
      @shang-ye="上一页"
      @xia-ye="下一页"
    />
  </section>
</template>
