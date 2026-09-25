<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  记忆列表,
  对话摘要列表,
  关键事件列表,
  接管记录列表,
  评估列表,
  思考记录列表,
  思考记录详情,
  思考说明,
  type 表格行,
  type 思考说明 as 思考说明类型,
} from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 创建请求错误状态, 执行请求 } from '../api/错误展示';
import { 默认每页条数, 默认页码 } from '../配置';
import { 单元格文本, 单元格色调, 取列映射, 行快照文本, 响应行键, 页签快照表, type 思考页签 } from '../列定义';
import { 思考事件选项 } from '../枚举映射/思考事件';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 思考文案 } from '../文案/思考';

type 标签页 = 思考页签;

type 标签键 = '思考记录标签' | '记忆标签' | '对话摘要标签' | '关键事件标签' | '接管记录标签' | '评估标签';

const 标签列: Array<{ 值: 标签页; 键: 标签键 }> = [
  { 值: 'si-kao-ji-lu', 键: '思考记录标签' },
  { 值: 'ji-yi', 键: '记忆标签' },
  { 值: 'dui-hua-zhai-yao', 键: '对话摘要标签' },
  { 值: 'guan-jian-shi-jian', 键: '关键事件标签' },
  { 值: 'duo-she-ri-zhi', 键: '接管记录标签' },
  { 值: 'ping-gu', 键: '评估标签' },
];

const 当前标签 = ref<标签页>('si-kao-ji-lu');
const 用户编号 = ref('');
const 角色编号 = ref('');
const 管理员编号 = ref('');
const 事件筛选 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 说明 = ref<思考说明类型 | null>(null);
const 原文内容 = ref<Record<string, string>>({});
const 加载中 = ref(false);
const 错误状态 = 创建请求错误状态();
const {
  当前错误,
  作废: 作废错误,
} = 错误状态;
const 说明错误状态 = 创建请求错误状态();
const {
  当前错误: 说明错误,
  作废: 作废说明错误,
} = 说明错误状态;

const 记录列 = 取列映射('思考记录');

function 行快照(行: 表格行): string {
  return 行快照文本(页签快照表[当前标签.value], 行);
}

function 取原文(值: unknown): string {
  return typeof 值 === 'string' && 值.length > 0 ? 值 : 通用文案.未记录;
}

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

function 当前查询参数(): { yong_hu_id?: string; jiao_se_id?: string; guan_li_yuan_id?: string; shi_jian?: string } {
  return {
    yong_hu_id: 可选文本(用户编号.value),
    jiao_se_id: 可选文本(角色编号.value),
    guan_li_yuan_id: 可选文本(管理员编号.value),
    shi_jian: 可选文本(事件筛选.value),
  };
}

async function 展开思考记录(记录编号: unknown): Promise<void> {
  if (typeof 记录编号 !== 'string' || 记录编号.length === 0) {
    return;
  }
  await 执行请求(
    错误状态,
    undefined,
    () => 思考记录详情(记录编号),
    (详情) => {
      原文内容.value = { ...原文内容.value, [记录编号]: 取原文(详情[响应行键.内容]) };
    },
    () => 展开思考记录(记录编号),
  );
}

async function 查询(页码: number = 默认页码): Promise<void> {
  await 执行请求(
    错误状态,
    加载中,
    async () => {
      const 基础 = {
        ye_ma: 页码,
        mei_ye_tiao_shu: 默认每页条数,
        ...当前查询参数(),
      };
      if (当前标签.value === 'si-kao-ji-lu') {
        return 思考记录列表({ ye_ma: 基础.ye_ma, mei_ye_tiao_shu: 基础.mei_ye_tiao_shu, yong_hu_id: 基础.yong_hu_id, jiao_se_id: 基础.jiao_se_id, shi_jian: 基础.shi_jian });
      }
      if (当前标签.value === 'ji-yi') {
        return 记忆列表(基础);
      }
      if (当前标签.value === 'dui-hua-zhai-yao') {
        return 对话摘要列表(基础);
      }
      if (当前标签.value === 'guan-jian-shi-jian') {
        return 关键事件列表(基础);
      }
      if (当前标签.value === 'duo-she-ri-zhi') {
        return 接管记录列表(基础);
      }
      return 评估列表(基础);
    },
    (结果) => {
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    },
    () => 查询(页码),
  );
}

async function 查询说明(): Promise<void> {
  await 执行请求(说明错误状态, undefined, 思考说明, (结果) => {
    说明.value = 结果;
  }, 查询说明);
}

function 切换标签(目标: 标签页): void {
  当前标签.value = 目标;
  行列表.value = [];
  原文内容.value = {};
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

onBeforeUnmount(() => {
  作废错误();
  作废说明错误();
});

onMounted(() => {
  void 查询说明();
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      :biao-ti="思考文案.标题"
      :shuo-ming="思考文案.实时推送提示"
    />
    <div
      class="卡片 说明卡"
      data-testid="shi-shi-shuo-ming"
    >
      <h3>{{ 思考文案.实时说明标签 }}</h3>
      <Transition name="块">
        <p v-if="说明">
          {{ 说明.sheng_ming }}
        </p>
      </Transition>
      <Transition name="块">
        <p v-if="说明">
          {{ 说明.shi_shi_shuo_ming }}
        </p>
      </Transition>
      <Transition name="块">
        <div v-if="说明 && 说明.dai_bu_chong.length > 0">
          <span class="待补题">{{ 思考文案.待补充项标签 }}</span>
          <ul class="待补列">
            <li
              v-for="项 in 说明.dai_bu_chong"
              :key="项"
              data-testid="dai-bu-chong"
            >
              <span class="徽标 警">{{ 通用文案.待补充 }}</span>
              {{ 项 }}
            </li>
          </ul>
        </div>
      </Transition>
      <XiaoXiTiao
        xing-tai="cuo-wu"
        :错误状态="说明错误状态"
      />
      <XiaoXiTiao
        xing-tai="kong"
        :xian-shi="说明错误 === null && (!说明 || 说明.dai_bu_chong.length === 0)"
        :wen-ben="通用文案.待补充"
        ce-shi-biao-shi="kong-tai-dai-bu-chong"
      />
    </div>
    <div class="标签页">
      <button
        v-for="项 in 标签列"
        :key="项.值"
        type="button"
        :class="当前标签 === 项.值 ? '激活' : ''"
        @click="切换标签(项.值)"
      >
        {{ 思考文案[项.键] }}
      </button>
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 账号文案.用户编号 }}
        <input
          v-model="用户编号"
          class="输入"
        >
      </label>
      <label class="字段">
        {{ 账号文案.角色编号标签 }}
        <input
          v-model="角色编号"
          class="输入"
        >
      </label>
      <Transition name="组">
        <label
          v-if="当前标签 === 'duo-she-ri-zhi'"
          class="字段"
        >
          {{ 思考文案.管理员编号标签 }}
          <input
            v-model="管理员编号"
            class="输入"
          >
        </label>
      </Transition>
      <Transition name="组">
        <label
          v-if="当前标签 === 'si-kao-ji-lu'"
          class="字段"
        >
          {{ 思考文案.事件标签 }}
          <select
            v-model="事件筛选"
            class="选择"
            data-testid="lv-xuan-si-kao-shi-jian"
          >
            <option value="">{{ 通用文案.全部 }}</option>
            <option
              v-for="项 in 思考事件选项"
              :key="项.值"
              :value="项.值"
            >{{ 项.文案 }}</option>
          </select>
        </label>
      </Transition>
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
      :错误状态="错误状态"
    />
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="当前错误 === null && !加载中 && 行列表.length === 0"
    />
    <Transition name="块">
      <ol
        v-if="行列表.length > 0"
        class="时间线"
      >
        <li
          v-for="(行, 序号) in 行列表"
          :key="序号"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <div class="节点卡">
            <div class="节点元">
              <span class="徽标 墨">{{ 思考文案.序号列 }} {{ 序号 + 1 }}</span>
              <time>{{ 单元格文本(记录列.创建时间, 行) }}</time>
              <span
                v-if="当前标签 === 'si-kao-ji-lu'"
                class="徽标"
                :class="单元格色调(记录列.事件, 行)"
              >{{ 单元格文本(记录列.事件, 行) }}</span>
            </div>
            <p v-if="当前标签 === 'si-kao-ji-lu'">
              {{ 单元格文本(记录列.摘要, 行) }}
            </p>
            <button
              v-if="当前标签 === 'si-kao-ji-lu'"
              type="button"
              class="按钮次"
              @click="展开思考记录(行[响应行键.ID])"
            >
              {{ 通用文案.详情 }}
            </button>
            <Transition name="组">
              <p
                v-if="原文内容[String(行[响应行键.ID] ?? '')]"
                class="原文行"
              >
                <span class="原文名">{{ 思考文案.内容标签 }}</span>
                <span>{{ 原文内容[String(行[响应行键.ID] ?? '')] }}</span>
              </p>
            </Transition>
            <pre class="快照码">{{ 行快照(行) }}</pre>
          </div>
        </li>
      </ol>
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

<style scoped>
.说明卡 {
  border-left: 5px solid var(--印);
  margin-bottom: 18px;
}

.说明卡 h3 {
  margin: 0 0 8px;
  font-size: 17px;
  letter-spacing: 2px;
}

.说明卡 p {
  margin: 6px 0;
  font-size: 14px;
}

.待补题 {
  font-weight: 700;
  color: var(--警);
}

.待补列 {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.待补列 li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 14px;
}

.空态 {
  margin-bottom: 0;
}

.原文行 {
  margin: 10px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.原文名 {
  color: var(--淡墨);
  margin-right: 8px;
}
</style>
