<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    status: string;
    size?: "sm" | "md";
  }>(),
  {
    size: "sm",
  },
);

const colorClass = computed(() => {
  switch (props.status) {
    case "active":
    case "healthy":
    case "normal":
      return "bg-green-100 text-green-700";
    case "suspended":
    case "unhealthy":
    case "limited":
    case "exceeded":
      return "bg-red-100 text-red-700";
    case "warning":
    case "near-limit":
    case "approaching":
      return "bg-yellow-100 text-yellow-700";
    case "unknown":
    case "inactive":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
});

const dotClass = computed(() => {
  switch (props.status) {
    case "active":
    case "healthy":
    case "normal":
      return "bg-green-500";
    case "suspended":
    case "unhealthy":
    case "limited":
    case "exceeded":
      return "bg-red-500";
    case "warning":
    case "near-limit":
    case "approaching":
      return "bg-yellow-500";
    case "unknown":
    case "inactive":
      return "bg-gray-50 dark:bg-gray-700";
    default:
      return "bg-gray-50 dark:bg-gray-700";
  }
});

const label = computed(() => {
  switch (props.status) {
    case "active":
    case "healthy":
    case "normal":
      return "正常";
    case "suspended":
    case "unhealthy":
    case "limited":
    case "exceeded":
      return "超限";
    case "warning":
    case "near-limit":
    case "approaching":
      return "接近";
    case "unknown":
      return "未知";
    case "inactive":
      return "未激活";
    default:
      return props.status;
  }
});
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1.5 rounded-full text-xs font-medium', colorClass, size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1']"
    data-testid="auth-status-badge"
  >
    <span :class="['w-1.5 h-1.5 rounded-full shrink-0', dotClass]" />
    {{ label }}
  </span>
</template>
