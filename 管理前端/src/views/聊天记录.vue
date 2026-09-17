<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { 聊天消息, 好友消息, type 表格行 } from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import TuBiao from '../components/TuBiao.vue';

const 模式 = ref<'dan-liao' | 'hao-you'>('dan-liao');
const 用户编号 = ref('');
const 角色编号 = ref('');
const 对端编号 = ref('');
const 发送方 = ref('');
const 排序 = ref('desc');
const 开始时间 = ref('');
const 结束时间 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 加载中 = ref(false);
const 错误提示 = ref('');

function 显示值(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  return String(值);
}

function 发送方名(行: 表格行): string {
  return 显示值(行, 模式.value === 'dan-liao' ? '发送者' : '发送者ID');
}

function 气泡方位(行: 表格行): string {
  const 名 = 发送方名(行);
  if (名 === 'yonghu' || 名.includes('用户')) {
    return '左';
  }
  if (名 === 'jiaose' || 名.includes('角色')) {
    return '右';
  }
  if (名 === 'xitong' || 名.includes('系统')) {
    return '中';
  }
  return 模式.value === 'dan-liao' ? '左' : '右';
}

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
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
        fa_song_zhe_id: 可选文本(用户编号.value),
        jie_shou_zhe_id: 可选文本(对端编号.value),
        kai_shi_shi_jian: 可选文本(开始时间.value),
        jie_shu_shi_jian: 可选文本(结束时间.value),
      });
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    }
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
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
    <YeMei
      xu-hao="贰 · 往来"
      :biao-ti="取文案('聊天', '标题')"
    />
    <div class="标签页">
      <button
        type="button"
        :class="模式 === 'dan-liao' ? '激活' : ''"
        @click="切换模式('dan-liao')"
      >
        {{ 取文案('聊天', '单聊消息') }}
      </button>
      <button
        type="button"
        :class="模式 === 'hao-you' ? '激活' : ''"
        @click="切换模式('hao-you')"
      >
        {{ 取文案('聊天', '好友消息') }}
      </button>
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('聊天', '用户编号占位') }}
        <input
          v-model="用户编号"
          class="输入"
          :placeholder="取文案('聊天', '用户编号占位')"
        >
      </label>
      <label
        v-if="模式 === 'dan-liao'"
        class="字段"
      >
        {{ 取文案('聊天', '角色编号占位') }}
        <input
          v-model="角色编号"
          class="输入"
          :placeholder="取文案('聊天', '角色编号占位')"
        >
      </label>
      <label
        v-else
        class="字段"
      >
        {{ 取文案('聊天', '接收者编号占位') }}
        <input
          v-model="对端编号"
          class="输入"
          :placeholder="取文案('聊天', '接收者编号占位')"
        >
      </label>
      <label
        v-if="模式 === 'dan-liao'"
        class="字段"
      >
        {{ 取文案('聊天', '发送方标签') }}
        <select
          v-model="发送方"
          class="选择"
        >
          <option value="">{{ 取文案('聊天', '发送方全部') }}</option>
          <option value="yonghu">yonghu</option>
          <option value="jiaose">jiaose</option>
          <option value="xitong">xitong</option>
        </select>
      </label>
      <label
        v-if="模式 === 'dan-liao'"
        class="字段"
      >
        {{ 取文案('聊天', '排序标签') }}
        <select
          v-model="排序"
          class="选择"
        >
          <option value="desc">{{ 取文案('聊天', '倒序') }}</option>
          <option value="asc">{{ 取文案('聊天', '正序') }}</option>
        </select>
      </label>
      <label class="字段">
        {{ 取文案('聊天', '开始时间标签') }}
        <input
          v-model="开始时间"
          class="输入"
          type="datetime-local"
        >
      </label>
      <label class="字段">
        {{ 取文案('聊天', '结束时间标签') }}
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
    <div
      v-if="行列表.length > 0"
      class="气泡列"
    >
      <article
        v-for="(行, 序号) in 行列表"
        :key="String(行['ID'] ?? '')"
        :class="['气泡', 气泡方位(行)]"
        :style="{ '--位': Math.min(序号, 7) }"
      >
        <div class="气泡头">
          <span class="徽标 墨">{{ 发送方名(行) }}</span>
          <span>{{ 显示值(行, '类型') }}</span>
          <time>{{ 显示值(行, '创建时间') }}</time>
        </div>
        <p class="气泡身">
          {{ 显示值(行, '内容') }}
        </p>
      </article>
    </div>
    <FenYeTiao
      v-if="分页"
      :zong-shu="分页.zong_shu"
      :dang-qian-ye="分页.ye_ma"
      :shi-fou-shou-ye="(分页.ye_ma ?? 默认页码) <= 1"
      @shang-ye="上一页"
      @xia-ye="下一页"
    />
  </section>
</template>
