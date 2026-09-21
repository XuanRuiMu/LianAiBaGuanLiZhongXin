<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { 封禁记录, 写入封禁, 账号封禁列表, 解封账号, 审核申诉, type 表格行 } from '../api/管理';
import { 使用登录仓库 } from '../stores/登录';
import { 取错误展示, type 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 封禁级别默认, 封禁级别选项 } from '../枚举映射/封禁级别';
import { 严重程度选项, 严重程度默认 } from '../枚举映射/严重程度';
import { 列定义登记, 响应行键 } from '../列定义';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import ShuJuBiaoGe from '../components/ShuJuBiaoGe.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import TuBiao from '../components/TuBiao.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 封禁文案 } from '../文案/封禁';

const 查询地址 = ref('');
const 登录仓库 = 使用登录仓库();
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 加载中 = ref(false);
const 错误提示 = ref('');
const 错误码 = ref('');
const 成功提示 = ref('');
const 写入用户 = ref('');
const 写入地址 = ref('');
const 写入原因 = ref('');
const 写入级别 = ref<string>(封禁级别默认);
const 写入严重程度 = ref<string>(严重程度默认);
const 写入解封时间 = ref('');
const 账号封禁行 = ref<表格行[]>([]);
const 账号封禁分页 = ref<分页信息 | undefined>(undefined);

function 显示错误(错误: unknown): void {
  const 展示 = 取错误展示(错误);
  错误提示.value = 展示.提示;
  错误码.value = 展示.错误码;
}

function 提示错误(文本: string): void {
  错误提示.value = 文本;
  错误码.value = '';
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  错误码.value = '';
  try {
    const 结果 = await 封禁记录({
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      ip: 查询地址.value.trim() === '' ? undefined : 查询地址.value.trim(),
    });
    行列表.value = 结果.行;
    分页.value = 结果.分页;
  } catch (错误) {
    显示错误(错误);
  } finally {
    加载中.value = false;
  }
}

async function 提交封禁(): Promise<void> {
  错误提示.value = '';
  错误码.value = '';
  成功提示.value = '';
  const 用户编号 = 写入用户.value.trim() === '' ? undefined : 写入用户.value.trim();
  const 地址 = 写入地址.value.trim() === '' ? undefined : 写入地址.value.trim();
  const 原因 = 写入原因.value.trim();
  if (用户编号 === undefined && 地址 === undefined) {
    提示错误(封禁文案.缺少目标);
    return;
  }
  if (原因 === '') {
    提示错误(封禁文案.缺少原因);
    return;
  }
  try {
    await 写入封禁({
      yong_hu_id: 用户编号,
      ip: 地址,
      yuan_yin: 原因,
      ji_bie: 写入级别.value,
      yan_zhong_cheng_du: 写入严重程度.value,
      jie_feng_shi_jian: 写入解封时间.value.trim() === '' ? undefined : 写入解封时间.value.trim(),
    });
    成功提示.value = 封禁文案.封禁成功;
    写入用户.value = '';
    写入地址.value = '';
    写入原因.value = '';
    写入解封时间.value = '';
    await 查询();
  } catch (错误) {
    显示错误(错误);
  }
}

async function 查询账号封禁(页码: number = 默认页码): Promise<void> {
  try {
    const 结果 = await 账号封禁列表({ ye_ma: 页码, mei_ye_tiao_shu: 默认每页条数 });
    账号封禁行.value = 结果.行;
    账号封禁分页.value = 结果.分页;
  } catch (错误) {
    显示错误(错误);
  }
}

async function 解封(用户编号: unknown): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  try {
    await 解封账号({ yong_hu_id: 用户编号 });
    成功提示.value = 封禁文案.解封成功;
    await 查询账号封禁();
  } catch (错误) {
    显示错误(错误);
  }
}

async function 审核(用户编号: unknown, 通过: boolean): Promise<void> {
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    return;
  }
  try {
    await 审核申诉({ yong_hu_id: 用户编号, tong_guo: 通过 });
    成功提示.value = 通过 ? 封禁文案.申诉通过成功 : 封禁文案.申诉驳回成功;
    await 查询账号封禁();
  } catch (错误) {
    显示错误(错误);
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
  void 查询账号封禁();
});
</script>

<template>
  <section>
    <YeMei
      :biao-ti="封禁文案.标题"
      :shuo-ming="封禁文案.操作记录说明"
    />
    <XiaoXiTiao
      xing-tai="cheng-gong"
      :wen-ben="成功提示"
    />
    <XiaoXiTiao
      xing-tai="cuo-wu"
      :wen-ben="错误提示"
      :cuo-wu-ma="错误码"
    />
    <div class="双栏">
      <!-- FP-17 封禁写入按矩阵归 feng_jin（运营/超管）可见，级别以迁移为准禁正常态 -->
      <div
        v-if="登录仓库.可封禁"
        class="卡片 封禁卡"
      >
        <h3>{{ 封禁文案.写入标题 }}</h3>
        <p class="页眉说明">
          {{ 封禁文案.目标组说明 }}
        </p>
        <label class="字段">
          {{ 账号文案.用户编号 }}
          <input
            v-model="写入用户"
            class="输入"
          >
        </label>
        <label class="字段">
          {{ 封禁文案.地址标签 }}
          <input
            v-model="写入地址"
            class="输入"
          >
        </label>
        <label class="字段">
          {{ 封禁文案.原因标签 }}
          <input
            v-model="写入原因"
            class="输入"
          >
        </label>
        <label class="字段">
          {{ 封禁文案.级别标签 }}
          <select
            v-model="写入级别"
            class="选择"
          >
            <option
              v-for="项 in 封禁级别选项"
              :key="项.值"
              :value="项.值"
            >{{ 项.文案 }}</option>
          </select>
        </label>
        <label class="字段">
          {{ 封禁文案.严重程度标签 }}
          <select
            v-model="写入严重程度"
            class="选择"
          >
            <option
              v-for="项 in 严重程度选项"
              :key="项.值"
              :value="项.值"
            >{{ 项.文案 }}</option>
          </select>
        </label>
        <label class="字段">
          {{ 封禁文案.解封时间标签 }}
          <input
            v-model="写入解封时间"
            class="输入"
          >
        </label>
        <button
          type="button"
          class="按钮危"
          @click="提交封禁"
        >
          {{ 通用文案.提交 }}
        </button>
      </div>
      <div>
        <h3 class="记录题">
          {{ 封禁文案.记录标题 }}
        </h3>
        <div class="账簿">
          <label class="字段">
            {{ 封禁文案.地址标签 }}
            <input
              v-model="查询地址"
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
        </div>
        <XiaoXiTiao
          xing-tai="jia-zai"
          :xian-shi="加载中"
        />
        <XiaoXiTiao
          xing-tai="kong"
          :xian-shi="!加载中 && 行列表.length === 0"
        />
        <ShuJuBiaoGe
          :lie="列定义登记.封禁记录"
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
      </div>
    </div>
    <h3 class="记录题">
      {{ 封禁文案.账号封禁标题 }}
    </h3>
    <XiaoXiTiao
      xing-tai="kong"
      :xian-shi="账号封禁行.length === 0"
    />
    <ShuJuBiaoGe
      :lie="列定义登记.账号封禁"
      :hang="账号封禁行"
      hang-jian="用户ID"
    >
      <template #cao-zuo="{ hang }">
        <!-- FP-17 解封归 feng_jin（运营/超管），申诉通过/驳回归 feng_jin_shen_he（审核员/超管） -->
        <button
          v-if="登录仓库.可封禁"
          type="button"
          class="按钮次"
          data-testid="jie-feng-an-niu"
          @click="解封(hang[响应行键.用户ID])"
        >
          {{ 封禁文案.解封按钮 }}
        </button>
        <button
          v-if="登录仓库.可封禁审核"
          type="button"
          class="按钮次"
          data-testid="tong-guo-shen-su-an-niu"
          @click="审核(hang[响应行键.用户ID], true)"
        >
          {{ 封禁文案.通过按钮 }}
        </button>
        <button
          v-if="登录仓库.可封禁审核"
          type="button"
          class="按钮次"
          data-testid="bo-hui-shen-su-an-niu"
          @click="审核(hang[响应行键.用户ID], false)"
        >
          {{ 封禁文案.驳回按钮 }}
        </button>
      </template>
    </ShuJuBiaoGe>
    <Transition name="块">
      <FenYeTiao
        v-if="账号封禁分页"
        :zong-shu="账号封禁分页.zong_shu"
        :dang-qian-ye="账号封禁分页.ye_ma"
        :shi-fou-shou-ye="(账号封禁分页.ye_ma ?? 默认页码) <= 1"
        @shang-ye="查询账号封禁((账号封禁分页?.ye_ma ?? 默认页码) > 1 ? (账号封禁分页?.ye_ma ?? 默认页码) - 1 : 默认页码)"
        @xia-ye="查询账号封禁((账号封禁分页?.ye_ma ?? 默认页码) + 1)"
      />
    </Transition>
  </section>
</template>

<style scoped>
.封禁卡 {
  border-top: 6px solid var(--印);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.封禁卡 h3 {
  margin: 0;
  font-size: 19px;
  letter-spacing: 3px;
}

.记录题 {
  margin: 0 0 12px;
  font-size: 19px;
  letter-spacing: 3px;
}
</style>
