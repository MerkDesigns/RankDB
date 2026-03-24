<template>
  <div
    v-if="accountId !== null"
    class="fixed inset-0 z-[70]"
    @click="$emit('close')"
    @contextmenu.prevent="$emit('close')"
  >
    <div
      class="absolute min-w-[180px] rounded-[10px] border border-[#323744] bg-[#0c1018] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      :style="positionStyle"
      @click.stop
      @contextmenu.stop
    >
      <div class="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400/85">
        LAST EDIT: <span class="text-slate-200/95 tracking-normal">{{ lastRankModifiedLabel }}</span>
      </div>
      <div class="mx-2 mb-1 h-px bg-[#272b35]" aria-hidden="true" />
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]" @click="$emit('edit-battletag', accountId)">
        <PencilLine class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Edit Battletag
      </button>
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]" @click="$emit('edit-credentials', accountId)">
        <ShieldEllipsis class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Edit Credentials
      </button>
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26] disabled:cursor-wait disabled:opacity-65" :disabled="rankRefreshBusy" @click="$emit('refresh-rank', accountId)">
        <RefreshCw class="h-[15px] w-[15px] shrink-0" :class="rankRefreshBusy ? 'animate-spin' : ''" :stroke-width="2.2" aria-hidden="true" />
        {{ rankRefreshBusy ? 'Refreshing Rank...' : 'Refresh Rank' }}
      </button>
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]" @click="$emit('account-info', accountId)">
        <IdCard class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Account Info
      </button>
      <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-red-300 transition hover:bg-[#181c26]" @click="$emit('delete-account', accountId)">
        <Trash2 class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Delete Account
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IdCard, PencilLine, RefreshCw, ShieldEllipsis, Trash2 } from 'lucide-vue-next'

defineProps<{
  accountId: number | null
  lastRankModifiedLabel: string
  positionStyle: Record<string, string>
  rankRefreshBusy: boolean
}>()

defineEmits<{
  'account-info': [accountId: number]
  close: []
  'delete-account': [accountId: number]
  'edit-battletag': [accountId: number]
  'edit-credentials': [accountId: number]
  'refresh-rank': [accountId: number]
}>()
</script>
