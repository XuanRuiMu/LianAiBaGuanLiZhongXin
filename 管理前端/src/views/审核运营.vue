<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { 审核列表, 审核新建, 审核一审, 审核二审, 审核批量, 审核留痕, type 表格行 } from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import TuBiao from '../components/TuBiao.vue';

type 目标类型名 = 'ju_bao' | 'gong_dan' | 'gong_gao' | 'huo_dong' | 'shi_yan';

type 标签键 = '举报标签' | '工单标签' | '公告标签' | '活动标签' | '实验标签';

const 标签列: Array<{ 值: 目标类型名; 键: 标签键 }> = [
  { 值: 'ju_bao', 键: '举报标签' },
  { 值: 'gong_dan', 键: '工单标签' },
  { 值: 'gong_gao', 键: '公告标签' },
  { 值: 'huo_dong', 键: '活动标签' },
  { 值: 'shi_yan', 键: '实验标签' },
];

const 当前标签 = ref<目标类型名>('ju_bao');
const 状态筛选 = ref('');
const 只看超时 = ref(false);
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 留痕行 = ref<表格行[]>([]);
const 新建标题 = ref('');
const 新建内容 = ref('');
const 新建名称 = ref('');
const 新建描述 = ref('');
const 新建原因 = ref('');
const 被举报用户 = ref('');
const 被举报内容 = ref('');
const 评审目标 = ref('');
const 评审备注 = ref('');
const 批量目标 = ref('');
const 加载中 = ref(false);
const 错误提示 = ref('');
const 成功提示 = ref('');

function 显示值(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  if (typeof 值 === 'object') {
    try {
      return JSON.stringify(值);
    } catch {
      return 取文案('通用', '暂无数据');
    }
  }
  return String(值);
}

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  try {
    const 结果 = await 审核列表(当前标签.value, {
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      zhuang_tai: 可选文本(状态筛选.value),
      chao_shi: 只看超时.value ? 'true' : undefined,
    });
    行列表.value = 结果.行;
    分页.value = 结果.分页;
    const 留痕 = await 审核留痕({ ye_ma: 1, mei_ye_tiao_shu: 默认每页条数 });
    留痕行.value = 留痕.行;
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

function 切换标签(目标: 目标类型名): void {
  当前标签.value = 目标;
  行列表.value = [];
  分页.value = undefined;
  void 查询();
}

async function 提交新建(): Promise<void> {
  错误提示.value = '';
  成功提示.value = '';
  try {
    await 审核新建(当前标签.value, {
      bei_ju_bao_yong_hu_id: 可选文本(被举报用户.value),
      bei_ju_bao_nei_rong_id: 可选文本(被举报内容.value),
      yuan_yin: 可选文本(新建原因.value),
      biao_ti: 可选文本(新建标题.value),
      nei_rong: 可选文本(新建内容.value),
      ming_cheng: 可选文本(新建名称.value),
      miao_shu: 可选文本(新建描述.value),
    });
    成功提示.value = 取文案('封禁', '写入成功');
    await 查询();
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 提交评审(轮次: 'yi_shen' | 'er_shen', 通过: boolean): Promise<void> {
  const 目标 = 评审目标.value.trim();
  if (目标 === '') {
    return;
  }
  try {
    if (轮次 === 'yi_shen') {
      await 审核一审(当前标签.value, { mu_biao_id: 目标, tong_guo: 通过, bei_zhu: 可选文本(评审备注.value) });
    } else {
      await 审核二审(当前标签.value, { mu_biao_id: 目标, tong_guo: 通过, bei_zhu: 可选文本(评审备注.value) });
    }
    成功提示.value = 取文案('封禁', '写入成功');
    await 查询();
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 提交批量(通过: boolean): Promise<void> {
  const 清单 = 批量目标.value.split(/[,，\s]+/).map((项) => 项.trim()).filter((项) => 项.length > 0);
  if (清单.length === 0) {
    return;
  }
  try {
    await 审核批量(当前标签.value, { mu_biao_ids: 清单, lun_ci: 'yi_shen', tong_guo: 通过 });
    成功提示.value = 取文案('封禁', '写入成功');
    await 查询();
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
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

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="柒 · 衡鉴"
      :biao-ti="取文案('审核', '标题')"
    />
    <p
      v-if="成功提示.length > 0"
      class="成功条"
    >
      {{ 成功提示 }}
    </p>
    <p
      v-if="错误提示.length > 0"
      class="错误条"
    >
      {{ 错误提示 }}
    </p>
    <div class="标签页">
      <button
        v-for="项 in 标签列"
        :key="项.值"
        type="button"
        :class="当前标签 === 项.值 ? '激活' : ''"
        @click="切换标签(项.值)"
      >
        {{ 取文案('审核', 项.键) }}
      </button>
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('审核', '状态占位') }}
        <input
          v-model="状态筛选"
          class="输入"
          :placeholder="取文案('审核', '状态占位')"
        >
      </label>
      <label class="字段">
        <input
          v-model="只看超时"
          type="checkbox"
        >
        {{ 取文案('审核', '超时占位') }}
      </label>
      <button
        type="button"
        class="按钮主"
        @click="查询()"
      >
        <TuBiao ming-cheng="查询" />
        {{ 取文案('通用', '查询') }}
      </button>
    </div>
    <p
      v-if="加载中"
      class="加载条"
    >
      {{ 取文案('通用', '加载中') }}
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
          <th>{{ 取文案('审核', '目标编号占位') }}</th>
          <th>{{ 取文案('审核', '状态占位') }}</th>
          <th>{{ 取文案('统计', '创建时间列') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 行列表"
          :key="String(行['ID'] ?? '')"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td class="数字">
            {{ 显示值(行, 'ID') }}
          </td>
          <td>{{ 显示值(行, '状态') }}</td>
          <td>{{ 显示值(行, '创建时间') }}</td>
        </tr>
      </tbody>
    </table>
    <FenYeTiao
      v-if="分页"
      :zong-shu="分页.zong_shu"
      :dang-qian-ye="分页.ye_ma"
      :shi-fou-shou-ye="(分页.ye_ma ?? 默认页码) <= 1"
      @shang-ye="上一页"
      @xia-ye="下一页"
    />
    <h3 class="记录题">
      {{ 取文案('审核', '新建按钮') }}
    </h3>    <div class="账簿">
      <label class="字段">
        {{ 取文案('审核', '标题占位') }}
        <input
          v-model="新建标题"
          class="输入"
          :placeholder="取文案('审核', '标题占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '内容占位') }}
        <input
          v-model="新建内容"
          class="输入"
          :placeholder="取文案('审核', '内容占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '名称占位') }}
        <input
          v-model="新建名称"
          class="输入"
          :placeholder="取文案('审核', '名称占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '描述占位') }}
        <input
          v-model="新建描述"
          class="输入"
          :placeholder="取文案('审核', '描述占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '原因占位') }}
        <input
          v-model="新建原因"
          class="输入"
          :placeholder="取文案('审核', '原因占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '被举报用户占位') }}
        <input
          v-model="被举报用户"
          class="输入"
          :placeholder="取文案('审核', '被举报用户占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '被举报内容占位') }}
        <input
          v-model="被举报内容"
          class="输入"
          :placeholder="取文案('审核', '被举报内容占位')"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="提交新建"
      >
        {{ 取文案('通用', '提交') }}
      </button>
    </div>
    <h3 class="记录题">
      {{ 取文案('审核', '一审按钮') }}·{{ 取文案('审核', '二审按钮') }}
    </h3>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('审核', '目标编号占位') }}
        <input
          v-model="评审目标"
          class="输入"
          :placeholder="取文案('审核', '目标编号占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审核', '备注占位') }}
        <input
          v-model="评审备注"
          class="输入"
          :placeholder="取文案('审核', '备注占位')"
        >
      </label>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('yi_shen', true)"
      >
        {{ 取文案('审核', '一审按钮') }}{{ 取文案('审核', '通过标签') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('yi_shen', false)"
      >
        {{ 取文案('审核', '一审按钮') }}{{ 取文案('审核', '驳回标签') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('er_shen', true)"
      >
        {{ 取文案('审核', '二审按钮') }}{{ 取文案('审核', '通过标签') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('er_shen', false)"
      >
        {{ 取文案('审核', '二审按钮') }}{{ 取文案('审核', '驳回标签') }}
      </button>
    </div>
    <h3 class="记录题">
      {{ 取文案('审核', '批量按钮') }}
    </h3>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('审核', '目标编号占位') }}
        <input
          v-model="批量目标"
          class="输入"
          :placeholder="取文案('审核', '目标编号占位')"
        >
      </label>
      <button
        type="button"
        class="按钮次"
        @click="提交批量(true)"
      >
        {{ 取文案('审核', '通过标签') }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交批量(false)"
      >
        {{ 取文案('审核', '驳回标签') }}
      </button>
    </div>
    <h3 class="记录题">
      {{ 取文案('审核', '留痕标签') }}
    </h3>
    <p
      v-if="留痕行.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <table
      v-else
      class="账簿表"
    >
      <thead>
        <tr>
          <th>{{ 取文案('审核', '目标编号占位') }}</th>
          <th>{{ 取文案('统计', '创建时间列') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 留痕行"
          :key="序号"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td class="数字">
            {{ 显示值(行, '目标ID') }}
          </td>
          <td>{{ 显示值(行, '创建时间') }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.记录题 {
  margin: 18px 0 12px;
  font-size: 19px;
  letter-spacing: 3px;
}
</style>
