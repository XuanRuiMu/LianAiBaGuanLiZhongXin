<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 账号详情, type 表格行 } from '../api/管理';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import TuBiao from '../components/TuBiao.vue';

const 当前路由 = useRoute();
const 路由器 = useRouter();
const 详情 = ref<表格行 | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');

const 首字 = computed(() => {
  const 名 = String(详情.value?.['昵称'] ?? 详情.value?.['用户名'] ?? '管');
  return 名.trim().charAt(0) || '管';
});

function 显示值(键: string): string {
  const 值 = 详情.value?.[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  return String(值);
}

async function 查询(): Promise<void> {
  const 用户编号 = 当前路由.params.yongHuId;
  if (typeof 用户编号 !== 'string' || 用户编号.length === 0) {
    错误提示.value = 取文案('通用', '请求失败');
    return;
  }
  加载中.value = true;
  错误提示.value = '';
  try {
    详情.value = await 账号详情(用户编号);
  } catch (错误) {
    if (错误 instanceof Error && 错误.message === 取文案('通用', '登录过期')) {
      错误提示.value = 取文案('通用', '登录过期');
      void 路由器.push('/deng-lu');
      return;
    }
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

function 返回(): void {
  void 路由器.push('/zhang-hao');
}

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="壹 · 卷宗"
      :biao-ti="取文案('账号', '详情标题')"
    />
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
    <div
      v-if="详情"
      class="双栏 反"
    >
      <div class="卡片 人物卡">
        <span
          class="印章 人物章"
          aria-hidden="true"
        >{{ 首字 }}</span>
        <h3 class="人物名">
          {{ 显示值('昵称') }}
        </h3>
        <p class="人物号">
          {{ 显示值('用户名') }}
        </p>
        <span
          v-if="详情['管理员'] === true"
          class="徽标 警"
        >{{ 取文案('账号', '是') }}</span>
        <span
          v-else
          class="徽标 墨"
        >{{ 取文案('账号', '否') }}</span>
      </div>
      <dl class="卷宗">
        <div>
          <dt>{{ 取文案('账号', '用户编号') }}</dt>
          <dd>{{ 显示值('ID') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '手机号') }}</dt>
          <dd>{{ 显示值('手机号') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '性别') }}</dt>
          <dd>{{ 显示值('性别') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '人设标签') }}</dt>
          <dd>{{ 显示值('人设标签') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '签名') }}</dt>
          <dd>{{ 显示值('签名') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '是否管理员') }}</dt>
          <dd>{{ 详情['管理员'] === true ? 取文案('账号', '是') : 取文案('账号', '否') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '封禁级别') }}</dt>
          <dd>{{ 显示值('封禁级别') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '违规次数') }}</dt>
          <dd>{{ 显示值('违规次数') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '申诉状态') }}</dt>
          <dd>{{ 显示值('申诉状态') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '账号解封时间') }}</dt>
          <dd>{{ 显示值('账号解封时间') }}</dd>
        </div>
        <div>
          <dt>{{ 取文案('账号', '创建时间') }}</dt>
          <dd>{{ 显示值('创建时间') }}</dd>
        </div>
      </dl>
    </div>
    <button
      type="button"
      class="按钮次"
      @click="返回"
    >
      <TuBiao ming-cheng="返回" />
      {{ 取文案('通用', '返回') }}
    </button>
  </section>
</template>

<style scoped>
.人物卡 {
  text-align: center;
  border-top: 6px solid var(--印);
}

.人物章 {
  width: 64px;
  height: 64px;
  font-size: 28px;
  margin: 6px auto 12px;
}

.人物名 {
  margin: 0;
  font-size: 24px;
  letter-spacing: 2px;
}

.人物号 {
  margin: 4px 0 12px;
  color: var(--淡墨);
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
