<template>
  <div v-if="accountId !== null" class="fixed inset-0 z-[80] bg-black/60" @click="$emit('close')">
    <div
      class="absolute left-1/2 top-1/2 w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      @click.stop
    >
      <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Delete Account</h2>
      <p class="mt-3 text-[13px] leading-5 text-slate-300">
        Delete
        <span class="font-semibold text-slate-100">{{ accountName }}</span>
        permanently?
      </p>
      <div class="mt-5 flex justify-end gap-3">
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]" @click="$emit('close')">
          Cancel
        </button>
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-rose-400/20 bg-rose-500/15 px-4 text-[13px] font-semibold text-rose-100 hover:bg-rose-500/25" @click="$emit('confirm')">
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  accountId: number | null
  accountName: string
}>()

defineEmits<{
  close: []
  confirm: []
}>()
</script>
