<script setup lang="ts">
defineProps<{ mingCheng: string }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-if="mingCheng === '账号'">
      <circle
        cx="9"
        cy="8"
        r="3.2"
      />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle
        cx="17"
        cy="9"
        r="2.4"
      />
      <path d="M15.5 14.2c2.3.3 4 1.9 4.5 4.3" />
    </g>
    <g v-else-if="mingCheng === '聊天'">
      <path d="M4 6.5h16v9.5H9l-5 4z" />
      <path d="M8 10.5h8M8 13.5h5" />
    </g>
    <g v-else-if="mingCheng === '思考'">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle
        cx="12"
        cy="12"
        r="4.2"
      />
      <path d="M12 9.8v2.4l1.6 1.6" />
    </g>
    <g v-else-if="mingCheng === '封禁'">
      <path d="M12 3.5 5 6v6c0 4.4 2.9 7.3 7 8.5 4.1-1.2 7-4.1 7-8.5V6z" />
      <path d="M9.5 12.5l5-5M14.5 12.5l-5-5" />
    </g>
    <g v-else-if="mingCheng === '审计'">
      <path d="M6 3.5h9L19 7.5V20.5H6z" />
      <path d="M14.5 3.5V8H19M9 12h6M9 15.5h6" />
    </g>
    <g v-else-if="mingCheng === '统计'">
      <path d="M4 4v16h16" />
      <path d="M8.5 15.5v-4M12.5 15.5V8M16.5 15.5v-6.5" />
    </g>
    <g v-else-if="mingCheng === '退出'">
      <path d="M14 4H6v16h8M10 12h11M18.5 8.5 22 12l-3.5 3.5" />
    </g>
    <g v-else-if="mingCheng === '太阳'">
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
    </g>
    <g v-else-if="mingCheng === '月亮'">
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </g>
    <g v-else-if="mingCheng === '返回'">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </g>
    <g v-else-if="mingCheng === '警示'">
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 9.5V14M12 17.2v.3" />
    </g>
    <g v-else>
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />
      <path d="m16 16 4.5 4.5" />
    </g>
  </svg>
</template>
