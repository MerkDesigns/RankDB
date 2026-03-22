<template>
  <div v-if="accountId !== null" class="fixed inset-0 z-[86] bg-black/60" @click="$emit('close')">
    <div
      class="absolute left-1/2 top-1/2 w-[400px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      @click.stop
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] text-slate-100/90">
            <Info class="h-[17px] w-[17px]" :stroke-width="2.1" aria-hidden="true" />
          </div>
          <div>
            <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Account Info</h2>
          </div>
        </div>
        <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]" aria-label="Close account info" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <p class="mb-4 break-all text-[17px] text-slate-300">{{ accountName }}</p>
      <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Country</label>
      <div class="mt-2 flex items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <select
            :value="countryDraft"
            class="h-11 w-full appearance-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-10 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
            @change="$emit('update:countryDraft', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">No country selected</option>
            <option v-for="option in countryOptions" :key="option.code" :value="option.code">
              {{ option.label }} ({{ option.dialCode }})
            </option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-slate-400/80" :stroke-width="2.2" aria-hidden="true" />
        </div>
        <div class="flex h-11 w-[74px] shrink-0 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b]">
          <span
            v-if="getCountryOption(countryDraft)"
            :class="getFlagClass(countryDraft)"
            class="rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            :style="{ width: '34px', height: '27px' }"
            aria-hidden="true"
          />
          <span v-else class="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500" />
        </div>
      </div>
      <p class="mt-4 text-[12px] leading-5 text-slate-400/80">
        Save the country tied to this Battle.net account so you know which phone number region to use if it needs to be verified again.
      </p>
      <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Notes</label>
      <textarea
        :value="notesDraft"
        rows="3"
        class="mt-2 min-h-[88px] w-full resize-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-2.5 text-[14px] leading-5 text-slate-100 outline-none focus:border-slate-400/70"
        placeholder="Add notes for this account"
        @input="$emit('update:notesDraft', ($event.target as HTMLTextAreaElement).value)"
      />
      <div class="mx-0 mt-4 h-px bg-[#272b35]" aria-hidden="true" />
      <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Status</label>
      <button
        type="button"
        class="mt-2 flex w-full items-center justify-between rounded-[8px] border px-3 py-3 text-left transition"
        :class="bannedDraft ? 'border-rose-500/40 bg-rose-500/12 text-rose-100' : 'border-[#272b35] bg-[#11141b] text-slate-100'"
        @click="$emit('toggle-banned')"
      >
        <div class="min-w-0 flex-1 pr-4">
          <div class="text-[14px] font-semibold">{{ bannedDraft ? 'Banned :(' : 'Clean :)' }}</div>
          <p class="mt-1 text-[12px] leading-5" :class="bannedDraft ? 'text-rose-100/70' : 'text-slate-400/80'">
            Banned accounts stay in their own section.
            That way you know but dont have to delete them.
          </p>
        </div>
        <span class="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-200" :class="bannedDraft ? 'border-rose-300/60 bg-rose-400/70' : 'border-[#3b4150] bg-[#29303d]'" aria-hidden="true">
          <span class="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-200" :style="{ transform: `translateX(${bannedDraft ? 20 : 2}px)` }" />
        </span>
      </button>
      <div class="mt-5 flex justify-end gap-3">
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]" @click="$emit('close')">
          Cancel
        </button>
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-[8px] border border-emerald-400/20 bg-emerald-500/15 px-4 text-[13px] font-semibold text-emerald-100 hover:bg-emerald-500/25" @click="$emit('save')">
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, Info } from 'lucide-vue-next'

import type { CountryOption } from '~~/app/types/rankdb'

defineProps<{
  accountId: number | null
  accountName: string
  bannedDraft: boolean
  countryDraft: string
  countryOptions: CountryOption[]
  notesDraft: string
  getCountryOption: (countryCode: string) => CountryOption | null
  getFlagClass: (countryCode: string) => string
}>()

defineEmits<{
  close: []
  save: []
  'toggle-banned': []
  'update:countryDraft': [value: string]
  'update:notesDraft': [value: string]
}>()
</script>
