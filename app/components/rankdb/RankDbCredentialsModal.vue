<template>
  <div v-if="accountId !== null" class="fixed inset-0 z-[85] bg-black/60" @click="$emit('close')">
    <div
      class="absolute left-1/2 top-1/2 w-[380px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      @click.stop
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Edit Credentials</h2>
        <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]" aria-label="Close credentials editor" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <p class="mb-4 text-[17px] text-slate-300">{{ accountName }}</p>
      <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Email</label>
      <div class="relative mt-2">
        <input
          :value="emailDraft"
          :type="emailVisible ? 'text' : 'password'"
          class="h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-11 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
          placeholder="Enter email"
          @input="$emit('update:emailDraft', ($event.target as HTMLInputElement).value)"
        >
        <button type="button" class="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400/80 hover:text-slate-100" :aria-label="emailVisible ? 'Hide email' : 'Show email'" @click="$emit('toggle-email-visibility')">
          <Eye v-if="emailVisible" class="h-[16.5px] w-[16.5px]" :stroke-width="2.1" aria-hidden="true" />
          <EyeOff v-else class="h-[16.5px] w-[16.5px]" :stroke-width="2.1" aria-hidden="true" />
        </button>
      </div>
      <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Password</label>
      <div class="relative mt-2">
        <input
          :value="passwordDraft"
          :type="passwordVisible ? 'text' : 'password'"
          class="h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-11 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
          placeholder="Enter password"
          @input="$emit('update:passwordDraft', ($event.target as HTMLInputElement).value)"
        >
        <button type="button" class="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400/80 hover:text-slate-100" :aria-label="passwordVisible ? 'Hide password' : 'Show password'" @click="$emit('toggle-password-visibility')">
          <Eye v-if="passwordVisible" class="h-[16.5px] w-[16.5px]" :stroke-width="2.1" aria-hidden="true" />
          <EyeOff v-else class="h-[16.5px] w-[16.5px]" :stroke-width="2.1" aria-hidden="true" />
        </button>
      </div>
      <div class="mt-5 flex justify-end gap-3">
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]" @click="$emit('close')">
          Cancel
        </button>
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25" @click="$emit('save')">
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  accountId: number | null
  accountName: string
  emailDraft: string
  emailVisible: boolean
  passwordDraft: string
  passwordVisible: boolean
}>()

defineEmits<{
  close: []
  save: []
  'toggle-email-visibility': []
  'toggle-password-visibility': []
  'update:emailDraft': [value: string]
  'update:passwordDraft': [value: string]
}>()
</script>
