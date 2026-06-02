<script setup lang="ts">
defineProps<{
  message: string;
  actionText?: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center py-16 text-gray-400"
    :data-testid="$attrs['data-testid'] || 'empty-state'"
  >
    <svg class="w-16 h-16 mb-4 text-gray-300 i-tabler-inbox" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <p class="text-base mb-4">{{ message }}</p>
    <button
      v-if="actionText"
      class="btn-primary"
      @click="emit('action')"
    >
      {{ actionText }}
    </button>
  </div>
</template>
