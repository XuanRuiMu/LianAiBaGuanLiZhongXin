<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { 聊天消息, 好友消息, type 表格行 } from '../api/管理';
import { 取错误展示, type 分页信息 } from '../api/请求';
import { 气泡方位码, 默认每页条数, 默认页码 } from '../配置';
import { 发送方选项, 取发送方码 } from '../枚举映射/发送方';
import { 单元格文本, 单元格原值, 取列映射, 响应行键 } from '../列定义';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 聊天文案 } from '../文案/聊天';

const 模式 = ref<'dan-liao' | 'hao-you'>('dan-liao');
const 用户编号 = ref('');
const 角色编号 = ref('');
const 发送者编号 = ref('');
const 接收者编号 = ref('');
const 发送方 = ref('');
const 排序 = ref('desc');
const 开始时间 = ref('');
const 结束时间 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 加载中 = ref(false);
const 错误提示 = ref('');
const 错误码 = ref('');

function 显示错误(错误: unknown): void {
  const 展示 = 取错误展示(错误);
  错误提示.value = 展示.提示;
  错误码.value = 展示.错误码;
}

const 单聊列 = 取列映射('单聊消息');
const 好友列 = 取列映射('好友消息');

type 气泡方位名 = (typeof 气泡方位码)[keyof typeof 气泡方位码];

function 发送方显示(行: 表格行): string {
  return 单元格文本(模式.value === 'hao-you' ? 好友列.发送者ID : 单聊列.发送者, 行);
}

function 气泡方位(行: 表格行): 气泡方位名 {
  if (模式.value === 'hao-you') {
    return 气泡方位码.右;
  }
  const 码 = 取发送方码(单元格原值(单聊列.发送者, 行));
  if (码 === 'jiaose') {
    return 气泡方位码.右;
  }
  if (码 === 'xitong') {
    return 气泡方位码.中;
  }
  return 气泡方位码.左;
}

const 当前列 = computed(() => (模式.value === 'dan-liao' ? 单聊列 : 好友列));

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  错误码.value = '';
  try {
    if (模式.value === 'dan-liao') {
      const 结果 = await 聊天消息({
        ye_ma: 页码,
        mei_ye_tiao_shu: 默认每页条数,
        yong_hu_id: 可选文本(用户编号.value),
        jiao_se_id: 可选文本(角色编号.value),
        fa_song_fang: 发送方.value === '' ? undefined : 发送方.value,
        kai_shi_shi_jian: 可选文本(开始时间.value),
        jie_shu_shi_jian: 可选文本(结束时间.value),
        pai_xu: 排序.value,
      });
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else {
      const 结果 = await 好友消息({
        ye_ma: 页码,
        mei_ye_tiao_shu: 默认每页条数,
        fa_song_zhe_id: 可选文本(发送者编号.value),
        jie_shou_zhe_id: 可选文本(接收者编号.value),
        kai_shi_shi_jian: 可选文本(开始时间.value),
        jie_shu_shi_jian: 可选文本(结束时间.value),
      });
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    }
  } catch (错误) {
    显示错误(错误);
  } finally {
    加载中.value = false;
  }
}

function 切换模式(目标: 'dan-liao' | 'hao-you'): void {
  模式.value = 目标;
  行列表.value = [];
  分页.value = undefined;
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

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei :biao-ti="聊天文案.标题" />
    <div class="标签页">
      <button
        type="button"
        :class="模式 === 'dan-liao' ? '激活' : ''"
        @click="切换模式('dan-liao')"
      >
        {{ 聊天文案.单聊消息 }}
      </button>
      <button
        type="button"
        :class="模式 === 'hao-you' ? '激活' : ''"
        @click="切换模式('hao-you')"
      >
        {{ 聊天文案.好友消息 }}
      </button>
    </div>
    <div class="账簿">
      <Transition name="组">
        <label
          v-if="模式 === 'dan-liao'"
          class="字段"
        >
          {{ 账号文案.用户编号 }}
          <input
            v-model="用户编号"
            class="输入"
          >
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="模式 === 'dan-liao'"
          class="字段"
        >
          {{ 账号文案.角色编号标签 }}
          <input
            v-model="角色编号"
            class="输入"
          >
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="模式 === 'hao-you'"
          class="字段"
        >
          {{ 聊天文案.发送者编号标签 }}
          <input
            v-model="发送者编号"
            class="输入"
          >
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="模式 === 'hao-you'"
          class="字段"
        >
          {{ 聊天文案.接收者编号标签 }}
          <input
            v-model="接收者编号"
            class="输入"
          >
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="模式 === 'dan-liao'"
          class="字段"
        >
          {{ 聊天文案.发送方标签 }}
          <select
            v-model="发送方"
            class="选择"
          >
            <option value="">{{ 聊天文案.发送方全部 }}</option>
            <option
              v-for="项 in 发送方选项"
              :key="项.值"
              :value="项.值"
            >{{ 项.文案 }}</option>
          </select>
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="模式 === 'dan-liao'"
          class="字段"
        >
          {{ 聊天文案.排序标签 }}
          <select
            v-model="排序"
            class="选择"
          >
            <option value="desc">{{ 聊天文案.倒序 }}</option>
            <option value="asc">{{ 聊天文案.正序 }}</option>
          </select>
        </label>
      </Transition>
      <label class="字段">
        {{ 聊天文案.开始时间标签 }}
        <input
          v-model="开始时间"
          class="输入"
          type="datetime-local"
        >
      </label>
      <label class="字段">
        {{ 聊天文案.结束时间标签 }}
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
    <Transition name="块">
      <div
        v-if="行列表.length > 0"
        class="气泡列"
      >
        <article
          v-for="(行, 序号) in 行列表"
          :key="String(行[响应行键.ID] ?? '')"
          :class="['气泡', 气泡方位(行)]"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <div class="气泡头">
            <span class="徽标 墨">{{ 发送方显示(行) }}</span>
            <span>{{ 单元格文本(当前列.类型, 行) }}</span>
            <time>{{ 单元格文本(当前列.创建时间, 行) }}</time>
          </div>
          <p class="气泡身">
            {{ 单元格文本(当前列.内容, 行) }}
          </p>
        </article>
      </div>
    </Transition>
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
