<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { 账号列表, 授予角色, 回收角色, 接管角色, 结束接管, type 表格行 } from '../api/管理';
import { 使用登录仓库 } from '../stores/登录';
import { 取错误展示, type 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 列定义登记, 响应行键 } from '../列定义';
import { 管理角色选项 } from '../枚举映射/管理角色';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import ShuJuBiaoGe from '../components/ShuJuBiaoGe.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';

const 关键词 = ref('');
const 手机号 = ref('');
const 登录仓库 = 使用登录仓库();
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 加载中 = ref(false);
const 错误提示 = ref('');
const 错误码 = ref('');

const 总数 = computed(() => 分页.value?.zong_shu ?? 行列表.value.length);
const 当前页 = computed(() => 分页.value?.ye_ma ?? 默认页码);
const 管理身份数 = computed(() => 行列表.value.filter((行) => 行[响应行键.角色] !== null && 行[响应行键.角色] !== undefined).length);
const 角色编号 = ref('');
const 授予角色值 = ref<string>('chao_guan');
const 操作提示 = ref('');

function 详情链接(行: 表格行): string {
  return `/zhang-hao/${String(行[响应行键.ID] ?? '')}`;
}

function 显示错误(错误: unknown): void {
  const 展示 = 取错误展示(错误);
  错误提示.value = 展示.提示;
  错误码.value = 展示.错误码;
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  错误码.value = '';
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
    显示错误(错误);
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

async function 授予(用户编号: unknown): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  const 已二次确认 = typeof globalThis.confirm === 'function' ? globalThis.confirm(账号文案.高危二次确认) : true;
  if (!已二次确认) {
    return;
  }
  try {
    await 授予角色({ yong_hu_id: 用户编号, jiao_se: 授予角色值.value, que_ren: true });
    操作提示.value = 账号文案.授予角色成功;
    await 查询(当前页.value);
  } catch (错误) {
    显示错误(错误);
  }
}

async function 回收(用户编号: unknown): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  const 已二次确认 = typeof globalThis.confirm === 'function' ? globalThis.confirm(账号文案.高危二次确认) : true;
  if (!已二次确认) {
    return;
  }
  try {
    await 回收角色({ yong_hu_id: 用户编号, jiao_se: 授予角色值.value, que_ren: true });
    操作提示.value = 账号文案.回收角色成功;
    await 查询(当前页.value);
  } catch (错误) {
    显示错误(错误);
  }
}

async function 接管(): Promise<void> {
  const 编号 = 角色编号.value.trim();
  if (编号 === '') {
    return;
  }
  try {
    await 接管角色({ jiao_se_id: 编号 });
    操作提示.value = 账号文案.接管角色成功;
  } catch (错误) {
    显示错误(错误);
  }
}

async function 结束接管角色(): Promise<void> {
  const 编号 = 角色编号.value.trim();
  if (编号 === '') {
    return;
  }
  try {
    await 结束接管({ jiao_se_id: 编号 });
    操作提示.value = 账号文案.结束接管成功;
  } catch (错误) {
    显示错误(错误);
  }
}

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei :biao-ti="账号文案.标题">
      <div class="统计卡组">
        <div class="统计卡">
          <p class="卡名">
            {{ 账号文案.总数标签 }}
          </p>
          <p class="卡值">
            {{ 总数 }}
          </p>
        </div>
        <div class="统计卡 黛">
          <p class="卡名">
            {{ 账号文案.管理身份数标签 }}
          </p>
          <p class="卡值">
            {{ 管理身份数 }}
          </p>
        </div>
      </div>
    </YeMei>
    <p class="页眉说明">
      {{ 账号文案.检索组说明 }}
    </p>
    <div class="账簿">
      <label class="字段">
        {{ 账号文案.关键词标签 }}
        <input
          v-model="关键词"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 账号文案.手机号 }}
        <input
          v-model="手机号"
          class="输入"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="查询()"
      >
        <TuBiao ming-cheng="cha-xun" />
        {{ 通用文案.查询 }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="重置"
      >
        {{ 通用文案.重置 }}
      </button>
      <label
        v-if="登录仓库.可高危"
        class="字段"
      >
        {{ 账号文案.角色选择标签 }}
        <select
          v-model="授予角色值"
          class="输入"
          data-testid="shou-yu-jiao-se-xuan-ze"
        >
          <option
            v-for="项 in 管理角色选项"
            :key="项.值"
            :value="项.值"
          >
            {{ 项.文案 }}
          </option>
        </select>
      </label>
    </div>
    <XiaoXiTiao
      xing-tai="jia-zai"
      :xian-shi="加载中"
    />
    <XiaoXiTiao
      xing-tai="cuo-wu"
      :wen-ben="错误提示"
      :cuo-wu-ma="错误码"
    />
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="!加载中 && 行列表.length === 0"
    />
    <ShuJuBiaoGe
      :lie="列定义登记.账号列表"
      :hang="行列表"
      :qu-lian-jie="详情链接"
    >
      <template #cao-zuo="{ hang }">
        <button
          v-if="登录仓库.可高危"
          type="button"
          class="按钮次"
          data-testid="shou-yu-an-niu"
          @click="授予(hang[响应行键.ID])"
        >
          {{ 账号文案.授予角色按钮 }}
        </button>
        <button
          v-if="登录仓库.可高危"
          type="button"
          class="按钮次"
          data-testid="hui-shou-an-niu"
          @click="回收(hang[响应行键.ID])"
        >
          {{ 账号文案.回收角色按钮 }}
        </button>
      </template>
    </ShuJuBiaoGe>
    <XiaoXiTiao
      xing-tai="cheng-gong"
      :wen-ben="操作提示"
    />
    <h3>{{ 账号文案.接管组标题 }}</h3>
    <p class="页眉说明">
      {{ 账号文案.接管组说明 }}
    </p>
    <div class="账簿">
      <!-- YH-108 接管与结束接管写同一张接管记录表，服务端已同挂高危门禁，入口必须同级隐藏 -->
      <label
        v-if="登录仓库.可高危"
        class="字段"
      >
        {{ 账号文案.角色编号标签 }}
        <input
          v-model="角色编号"
          class="输入"
        >
      </label>
      <button
        v-if="登录仓库.可高危"
        type="button"
        class="按钮主"
        data-testid="jie-guan-an-niu"
        @click="接管"
      >
        {{ 账号文案.接管角色按钮 }}
      </button>
      <button
        v-if="登录仓库.可高危"
        type="button"
        class="按钮次"
        data-testid="jie-shu-jie-guan-an-niu"
        @click="结束接管角色"
      >
        {{ 账号文案.结束接管按钮 }}
      </button>
    </div>
    <Transition name="块">
      <FenYeTiao
        v-if="分页"
        :zong-shu="总数"
        :dang-qian-ye="当前页"
        :shi-fou-shou-ye="当前页 <= 1"
        @shang-ye="上一页"
        @xia-ye="下一页"
      />
    </Transition>
  </section>
</template>
