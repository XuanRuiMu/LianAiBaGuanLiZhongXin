<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { 审核列表, 审核新建, 审核初审, 审核复审, 审核多项处理, 处理记录列表, type 表格行 } from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 创建请求错误状态, 执行请求 } from '../api/错误展示';
import { 默认每页条数, 默认页码 } from '../配置';
import { 列定义登记 } from '../列定义';
import { 审核状态选项 } from '../枚举映射/审核状态';
import { 使用登录仓库 } from '../stores/登录';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import ShuJuBiaoGe from '../components/ShuJuBiaoGe.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 审核文案 } from '../文案/审核';

type 目标类型名 = 'ju_bao' | 'gong_dan' | 'gong_gao' | 'huo_dong' | 'shi_yan';

type 标签键 = '举报标签' | '工单标签' | '公告标签' | '活动标签' | '实验标签';

const 标签列: Array<{ 值: 目标类型名; 键: 标签键 }> = [
  { 值: 'ju_bao', 键: '举报标签' },
  { 值: 'gong_dan', 键: '工单标签' },
  { 值: 'gong_gao', 键: '公告标签' },
  { 值: 'huo_dong', 键: '活动标签' },
  { 值: 'shi_yan', 键: '实验标签' },
];

const 登录仓库 = 使用登录仓库();
const 当前标签 = ref<目标类型名>('ju_bao');
const 状态筛选 = ref('');
const 只看超时 = ref(false);
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 处理记录行 = ref<表格行[]>([]);
const 新建标题 = ref('');
const 新建内容 = ref('');
const 新建名称 = ref('');
const 新建描述 = ref('');
const 新建原因 = ref('');
const 被举报用户 = ref('');
const 被举报内容 = ref('');
const 评审目标 = ref('');
const 评审备注 = ref('');
const 多项目标 = ref('');
const 加载中 = ref(false);
const 错误状态 = 创建请求错误状态();
const {
  当前错误,
  作废: 作废错误,
} = 错误状态;
const 成功提示 = ref('');

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

async function 查询(页码: number = 默认页码): Promise<void> {
  await 执行请求(
    错误状态,
    加载中,
    async () => {
      const 结果 = await 审核列表(当前标签.value, {
        ye_ma: 页码,
        mei_ye_tiao_shu: 默认每页条数,
        zhuang_tai: 可选文本(状态筛选.value),
        chao_shi: 只看超时.value ? 'true' : undefined,
      });
      return { 结果, 记录: await 处理记录列表({ ye_ma: 1, mei_ye_tiao_shu: 默认每页条数 }) };
    },
    ({ 结果, 记录 }) => {
      行列表.value = 结果.行;
      分页.value = 结果.分页;
      处理记录行.value = 记录.行;
    },
    () => 查询(页码),
  );
}

function 切换标签(目标: 目标类型名): void {
  当前标签.value = 目标;
  行列表.value = [];
  分页.value = undefined;
  void 查询();
}

async function 提交新建(): Promise<void> {
  成功提示.value = '';
  await 执行请求(错误状态, undefined, () => 审核新建(当前标签.value, {
    bei_ju_bao_yong_hu_id: 可选文本(被举报用户.value),
    bei_ju_bao_nei_rong_id: 可选文本(被举报内容.value),
    yuan_yin: 可选文本(新建原因.value),
    biao_ti: 可选文本(新建标题.value),
    nei_rong: 可选文本(新建内容.value),
    ming_cheng: 可选文本(新建名称.value),
    miao_shu: 可选文本(新建描述.value),
  }), async () => {
    成功提示.value = 审核文案.新建成功;
    await 查询();
  }, 提交新建);
}

async function 提交评审(轮次: 'yi_shen' | 'er_shen', 通过: boolean): Promise<void> {
  const 目标 = 评审目标.value.trim();
  if (目标 === '') {
    return;
  }
  成功提示.value = '';
  await 执行请求(错误状态, undefined, () => 轮次 === 'yi_shen'
    ? 审核初审(当前标签.value, { mu_biao_id: 目标, tong_guo: 通过, bei_zhu: 可选文本(评审备注.value) })
    : 审核复审(当前标签.value, { mu_biao_id: 目标, tong_guo: 通过, bei_zhu: 可选文本(评审备注.value) }), async () => {
    成功提示.value = 审核文案.评审成功;
    await 查询();
  }, () => 提交评审(轮次, 通过));
}

async function 提交多项处理(通过: boolean): Promise<void> {
  const 清单 = 多项目标.value.split(/[,，\s]+/).map((项) => 项.trim()).filter((项) => 项.length > 0);
  if (清单.length === 0) {
    return;
  }
  成功提示.value = '';
  await 执行请求(错误状态, undefined, () => 审核多项处理(当前标签.value, { mu_biao_ids: 清单, lun_ci: 'yi_shen', tong_guo: 通过 }), async () => {
    成功提示.value = 审核文案.处理多项成功;
    await 查询();
  }, () => 提交多项处理(通过));
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

onBeforeUnmount(() => {
  作废错误();
});

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei :biao-ti="审核文案.标题" />
    <XiaoXiTiao
      xing-tai="cheng-gong"
      :wen-ben="成功提示"
    />
    <XiaoXiTiao
      xing-tai="cuo-wu"
      :错误状态="错误状态"
    />
    <div class="标签页">
      <button
        v-for="项 in 标签列"
        :key="项.值"
        type="button"
        :class="当前标签 === 项.值 ? '激活' : ''"
        @click="切换标签(项.值)"
      >
        {{ 审核文案[项.键] }}
      </button>
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 审核文案.状态列 }}
        <select
          v-model="状态筛选"
          class="选择"
          data-testid="lv-xuan-shen-he-zhuang-tai"
        >
          <option value="">{{ 通用文案.全部 }}</option>
          <option
            v-for="项 in 审核状态选项"
            :key="项.值"
            :value="项.值"
          >{{ 项.文案 }}</option>
        </select>
      </label>
      <label class="字段">
        {{ 审核文案.超时标签 }}
        <input
          v-model="只看超时"
          type="checkbox"
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
    </div>
    <XiaoXiTiao
      xing-tai="jia-zai"
      :xian-shi="加载中"
    />
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="当前错误 === null && !加载中 && 行列表.length === 0"
    />
    <ShuJuBiaoGe
      :lie="列定义登记.审核列表"
      :hang="行列表"
    />
    <Transition name="块">
      <FenYeTiao
        v-if="分页"
        :zong-shu="分页.zong_shu"
        :dang-qian-ye="分页.ye_ma"
        :shi-fou-shou-ye="(分页.ye_ma ?? 默认页码) <= 1"
        @shang-ye="上一页"
        @xia-ye="下一页"
      />
    </Transition>
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="!登录仓库.可高危"
      :wen-ben="账号文案.无权限提示"
      ce-shi-biao-shi="wu-gao-wei-qi-yong"
    />
    <h3
      v-if="登录仓库.可高危"
      class="记录题"
    >
      {{ 审核文案.新建按钮 }}
    </h3>
    <div
      v-if="登录仓库.可高危"
      class="账簿"
    >
      <label class="字段">
        {{ 审核文案.标题标签 }}
        <input
          v-model="新建标题"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.内容标签 }}
        <input
          v-model="新建内容"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.名称标签 }}
        <input
          v-model="新建名称"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.描述标签 }}
        <input
          v-model="新建描述"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.原因标签 }}
        <input
          v-model="新建原因"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.被举报用户编号标签 }}
        <input
          v-model="被举报用户"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.被举报内容编号标签 }}
        <input
          v-model="被举报内容"
          class="输入"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="提交新建"
      >
        {{ 通用文案.提交 }}
      </button>
    </div>
    <h3
      v-if="登录仓库.可高危"
      class="记录题"
    >
      {{ 审核文案.评审标题 }}
    </h3>
    <p
      v-if="登录仓库.可高危"
      class="页眉说明"
    >
      {{ 审核文案.评审组说明 }}
    </p>
    <div
      v-if="登录仓库.可高危"
      class="账簿"
    >
      <label class="字段">
        {{ 审核文案.目标编号列 }}
        <input
          v-model="评审目标"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审核文案.备注标签 }}
        <input
          v-model="评审备注"
          class="输入"
        >
      </label>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('yi_shen', true)"
      >
        {{ 审核文案.初审按钮 }}{{ 审核文案.通过标签 }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('yi_shen', false)"
      >
        {{ 审核文案.初审按钮 }}{{ 审核文案.驳回标签 }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('er_shen', true)"
      >
        {{ 审核文案.复审按钮 }}{{ 审核文案.通过标签 }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交评审('er_shen', false)"
      >
        {{ 审核文案.复审按钮 }}{{ 审核文案.驳回标签 }}
      </button>
    </div>
    <h3
      v-if="登录仓库.可高危"
      class="记录题"
    >
      {{ 审核文案.处理多项按钮 }}
    </h3>
    <div
      v-if="登录仓库.可高危"
      class="账簿"
    >
      <label class="字段">
        {{ 审核文案.目标编号列 }}
        <input
          v-model="多项目标"
          class="输入"
        >
      </label>
      <button
        type="button"
        class="按钮次"
        @click="提交多项处理(true)"
      >
        {{ 审核文案.通过标签 }}
      </button>
      <button
        type="button"
        class="按钮次"
        @click="提交多项处理(false)"
      >
        {{ 审核文案.驳回标签 }}
      </button>
    </div>
    <h3 class="记录题">
      {{ 审核文案.处理记录标签 }}
    </h3>
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="当前错误 === null && 处理记录行.length === 0"
    />
    <ShuJuBiaoGe
      :lie="列定义登记.审核留痕"
      :hang="处理记录行"
      :hang-jian="null"
    />
  </section>
</template>

<style scoped>
.记录题 {
  margin: 18px 0 12px;
  font-size: 19px;
  letter-spacing: 3px;
}
</style>
