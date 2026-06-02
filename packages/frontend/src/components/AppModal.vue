<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    width?: string;
  }>(),
  {
    title: "",
    width: "max-w-lg",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

function close() {
  emit("update:open", false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) {
    close();
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        data-testid="modal-backdrop"
        @click="close"
      />
      <!-- Dialog -->
      <div
        :class="['relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full mx-4 max-h-[90vh] overflow-auto border border-gray-100 dark:border-gray-700', width]"
      >
        <div v-if="title" class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
          <button
            class="btn btn-sm btn-ghost w-7 h-7 rounded-lg text-lg p-0 dark:text-gray-400 dark:hover:bg-gray-700"
            data-testid="modal-close-btn"
            @click="close"
          >
            ×
          </button>
        </div>
        <div class="px-6 py-5">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
