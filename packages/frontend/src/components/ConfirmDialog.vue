<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
  }>(),
  {
    title: "确认操作",
    message: "确定要执行此操作吗？",
    confirmText: "确认",
    cancelText: "取消",
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [];
  cancel: [];
}>();

function confirm() {
  emit("confirm");
  emit("update:open", false);
}

function cancel() {
  emit("cancel");
  emit("update:open", false);
}
</script>

<template>
  <Transition name="dialog">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="confirm-delete-dialog"
    >
      <div class="fixed inset-0 bg-black/40" @click="cancel" />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
        <p class="text-gray-600 mb-6">{{ message }}</p>
        <div class="flex justify-end gap-3">
          <button
            class="btn-secondary"
            data-testid="confirm-cancel-btn"
            @click="cancel"
          >
            {{ cancelText }}
          </button>
          <button
            :class="['btn-primary', confirmClass]"
            data-testid="confirm-delete-btn"
            @click="confirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
