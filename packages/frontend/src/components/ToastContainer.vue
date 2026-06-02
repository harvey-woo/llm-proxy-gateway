<script setup lang="ts">
import { toastInstance } from "../composables/useToast";
</script>

<template>
  <div class="fixed top-4 right-4 z-[60] flex flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastInstance.toasts.value"
        :key="toast.id"
        :class="[
          'px-4 py-3 rounded-lg shadow-lg text-sm font-medium min-w-[280px] flex items-center justify-between',
          toast.type === 'success' ? 'bg-green-600 text-white' : '',
          toast.type === 'error' ? 'bg-red-600 text-white' : '',
          toast.type === 'info' ? 'bg-blue-600 text-white' : '',
        ]"
        :data-testid="toast.type === 'success' ? 'success-toast' : toast.type === 'error' ? 'error-toast' : ''"
      >
        <span>{{ toast.message }}</span>
        <button class="ml-3 opacity-70 hover:opacity-100" @click="toastInstance.remove(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
