<script setup lang="ts">
import { useExchangeRates } from "../composables/useExchangeRates";

const {
  preferredCurrency,
  supportedCurrencies,
  setCurrency,
} = useExchangeRates();

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  setCurrency(target.value);
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <label for="currency-select" class="hidden lg:inline text-xs text-gray-500 dark:text-gray-400">货币</label>
    <select
      id="currency-select"
      :value="preferredCurrency"
      class="select-sm max-w-[80px] dark:bg-gray-700 cursor-pointer"
      data-testid="currency-select"
      @change="handleChange"
    >
      <option
        v-for="c in supportedCurrencies"
        :key="c"
        :value="c"
      >
        {{ c }}
      </option>
    </select>
  </div>
</template>
