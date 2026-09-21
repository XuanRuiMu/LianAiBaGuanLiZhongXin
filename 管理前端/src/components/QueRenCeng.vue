<script lang="ts">
let 层实例计数 = 0;
</script>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { 通用文案 } from '../文案/通用';

const props = withDefaults(
  defineProps<{
    xianShi: boolean;
    biaoTi: string;
    zhengWen?: string;
    queRenWenBen?: string;
    quXiaoWenBen?: string;
    weiXian?: boolean;
    ceShiBiaoShi?: string | null;
  }>(),
  { zhengWen: '', queRenWenBen: 通用文案.确认, quXiaoWenBen: 通用文案.取消, weiXian: false, ceShiBiaoShi: null },
);

const 发射 = defineEmits<{ (事件: 'queRen' | 'quXiao'): void }>();

层实例计数 += 1;
const 本层序号 = 层实例计数;
const 标题锚 = `que-ren-ceng-biao-ti-${本层序号}`;
const 正文锚 = `que-ren-ceng-zheng-wen-${本层序号}`;
const 层本体 = ref<HTMLElement | null>(null);
const 默认动作 = ref<HTMLElement | null>(null);
const 取消动作 = ref<HTMLElement | null>(null);
let 触发元素: HTMLElement | null = null;

function 层内按钮(): HTMLElement[] {
  return [...(层本体.value?.querySelectorAll<HTMLElement>('button') ?? [])];
}

function 开窗落点(): HTMLElement | null {
  return props.weiXian ? 取消动作.value : 默认动作.value;
}

watch(
  () => props.xianShi,
  async (开) => {
    if (开) {
      const 当前 = document.activeElement;
      触发元素 = 当前 instanceof HTMLElement && 当前 !== document.body ? 当前 : null;
      await nextTick();
      开窗落点()?.focus();
    } else {
      触发元素?.focus();
      触发元素 = null;
    }
  },
  { immediate: true, flush: 'post' },
);

function 键控(事件: KeyboardEvent): void {
  if (事件.key === 'Escape') {
    事件.preventDefault();
    发射('quXiao');
    return;
  }
  if (事件.key !== 'Tab') {
    return;
  }
  const 按钮们 = 层内按钮();
  if (按钮们.length === 0) {
    return;
  }
  const 首 = 按钮们[0];
  const 末 = 按钮们[按钮们.length - 1];
  const 当前 = document.activeElement;
  if (事件.shiftKey && (当前 === 首 || 当前 === 层本体.value)) {
    事件.preventDefault();
    末.focus();
  } else if (!事件.shiftKey && 当前 === 末) {
    事件.preventDefault();
    首.focus();
  }
}

function 遮罩点击(事件: MouseEvent): void {
  if (props.weiXian || 事件.target !== 事件.currentTarget) {
    return;
  }
  发射('quXiao');
}
</script>

<template>
  <Transition name="层">
    <div
      v-if="xianShi"
      class="确认遮罩"
      :data-testid="ceShiBiaoShi"
      @click="遮罩点击"
    >
      <div
        ref="层本体"
        class="确认框"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="标题锚"
        :aria-describedby="正文锚"
        @keydown="键控"
      >
        <h3 :id="标题锚">
          {{ biaoTi }}
        </h3>
        <p :id="正文锚">
          {{ zhengWen }}
        </p>
        <div class="确认操作">
          <button
            ref="取消动作"
            type="button"
            class="按钮次"
            data-testid="que-ren-qu-xiao"
            @click="$emit('quXiao')"
          >
            {{ quXiaoWenBen }}
          </button>
          <button
            ref="默认动作"
            type="button"
            :class="weiXian ? '按钮危' : '按钮主'"
            data-testid="que-ren-que-ren"
            @click="$emit('queRen')"
          >
            {{ queRenWenBen }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
