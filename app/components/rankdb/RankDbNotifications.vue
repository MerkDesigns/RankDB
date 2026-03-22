<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100vw-24px))] justify-end">
    <TransitionGroup name="toast-list" tag="div" class="flex w-full flex-col items-end gap-2">
      <div
        v-for="toast in notifications"
        :key="toast.id"
        class="pointer-events-auto relative w-full rounded-[10px] border bg-[#070a11]/96 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
        :class="toast.kind === 'error' ? 'border-[#73313c] text-rose-100' : toast.kind === 'success' ? 'border-[#29493c] text-emerald-100' : 'border-[#323744] text-slate-100'"
      >
        <button
          type="button"
          class="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-slate-400/80 transition hover:bg-white/5 hover:text-slate-100"
          aria-label="Dismiss notification"
          @click="$emit('remove', toast.id)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <p class="pr-5 text-[13px] font-semibold tracking-tight">{{ toast.title }}</p>
        <p v-if="toast.message" class="mt-1 pr-5 text-[12px] leading-5 text-current/75">{{ toast.message }}</p>
        <span
          v-if="toast.showTimer"
          class="toast-timer absolute bottom-0 left-0 h-[2px] w-full origin-left rounded-b-[10px] bg-current/40"
          :style="{ animationDuration: `${toast.duration}ms` }"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { NotificationToast } from '~~/app/types/rankdb'

defineProps<{
  notifications: NotificationToast[]
}>()

defineEmits<{
  remove: [notificationId: number]
}>()
</script>
