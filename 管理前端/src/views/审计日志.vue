<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { 审计日志, 审计保留, type 表格行 } from '../api/管理';
import { 取错误展示, type 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 列定义登记, 命名值文本 } from '../列定义';
import { 审计事件选项 } from '../枚举映射/审计事件';
import { 审计分类选项 } from '../枚举映射/审计分类';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import ShuJuBiaoGe from '../components/ShuJuBiaoGe.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 审计文案 } from '../文案/审计';

const 事件类型 = ref('');
const 用户编号 = ref('');
const 类型名 = ref('');
const 开始时间 = ref('');
const 结束时间 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 保留信息 = ref<表格行 | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');
const 错误码 = ref('');

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
    const 结果 = await 审计日志({
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      shi_jian_lei_xing: 事件类型.value.trim() === '' ? undefined : 事件类型.value.trim(),
      yong_hu_id: 用户编号.value.trim() === '' ? undefined : 用户编号.value.trim(),
      lei_xing: 类型名.value.trim() === '' ? undefined : 类型名.value.trim(),
      kai_shi_shi_jian: 开始时间.value.trim() === '' ? undefined : 开始时间.value.trim(),
      jie_shu_shi_jian: 结束时间.value.trim() === '' ? undefined : 结束时间.value.trim(),
    });
    行列表.value = 结果.行;
    分页.value = 结果.分页;
  } catch (错误) {
    显示错误(错误);
  } finally {
    加载中.value = false;
  }
}

async function 查询保留(): Promise<void> {
  try {
    保留信息.value = await 审计保留();
  } catch {
    保留信息.value = null;
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
  void 查询保留();
  void 查询();
});
</script>

<template>
  <section>
    <YeMei :biao-ti="审计文案.标题" />
    <div class="账簿">
      <label class="字段">
        {{ 审计文案.事件类型列 }}
        <select
          v-model="事件类型"
          class="选择"
          data-testid="lv-xuan-shi-jian-lei-xing"
        >
          <option value="">{{ 通用文案.全部 }}</option>
          <option
            v-for="项 in 审计事件选项"
            :key="项.值"
            :value="项.值"
          >{{ 项.文案 }}</option>
        </select>
      </label>
      <label class="字段">
        {{ 账号文案.用户编号 }}
        <input
          v-model="用户编号"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 审计文案.类型列 }}
        <select
          v-model="类型名"
          class="选择"
          data-testid="lv-xuan-shen-ji-fen-lei"
        >
          <option value="">{{ 通用文案.全部 }}</option>
          <option
            v-for="项 in 审计分类选项"
            :key="项.值"
            :value="项.值"
          >{{ 项.文案 }}</option>
        </select>
      </label>
      <label class="字段">
        {{ 审计文案.开始时间标签 }}
        <input
          v-model="开始时间"
          class="输入"
          type="datetime-local"
        >
      </label>
      <label class="字段">
        {{ 审计文案.结束时间标签 }}
        <input
          v-model="结束时间"
          class="输入"
          type="datetime-local"
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
    <Transition name="条">
      <p
        v-if="保留信息"
        class="加载条"
      >
        {{ 命名值文本(审计文案.保留标题, 保留信息['zong_shu']) }}
      </p>
    </Transition>
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
      :lie="列定义登记.审计日志"
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
  </section>
</template>
