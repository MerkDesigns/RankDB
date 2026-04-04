<template>
  <div v-if="props.accountId !== null" class="fixed inset-0 z-[86] bg-black/60" @click="handleBackdropClick">
    <div
      class="absolute left-1/2 top-1/2 w-[400px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      @click.stop
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] text-slate-100/90">
            <Info class="h-[17px] w-[17px]" :stroke-width="2.1" aria-hidden="true" />
          </div>
          <div class="flex items-center gap-2 text-[16px] tracking-tight">
            <h2 class="font-semibold text-slate-100">Account Info</h2>
            <span class="text-slate-500">|</span>
            <p class="max-w-[220px] truncate text-[15px] text-slate-300">{{ props.accountName }}</p>
          </div>
        </div>
        <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]" aria-label="Close account info" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Country</label>
        <div class="group relative inline-flex">
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-300"
            aria-label="Country info"
          >
            <Info class="h-[12px] w-[12px]" :stroke-width="2.3" aria-hidden="true" />
          </button>
          <div class="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-10 w-[250px] -translate-x-1/2 rounded-[8px] border border-[#2b3140] bg-[#0f141d] px-3 py-2 text-[11px] leading-4 text-slate-300 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.4)] transition duration-150 group-hover:opacity-100">
            Save the country tied to this Battle.net account so you know which phone number region to use if it needs to be verified again.
          </div>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <select
            :value="props.countryDraft"
            class="h-11 w-full appearance-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-10 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
            @change="$emit('update:countryDraft', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">No country selected</option>
            <option v-for="option in props.countryOptions" :key="option.code" :value="option.code">
              {{ option.label }} ({{ option.dialCode }})
            </option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-slate-400/80" :stroke-width="2.2" aria-hidden="true" />
        </div>
        <div class="flex h-11 w-[74px] shrink-0 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b]">
          <span
            v-if="props.getCountryOption(props.countryDraft)"
            :class="props.getFlagClass(props.countryDraft)"
            class="rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            :style="{ width: '34px', height: '27px' }"
            aria-hidden="true"
          />
          <span v-else class="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500" />
        </div>
      </div>
      <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Notes</label>
      <textarea
        :value="props.notesDraft"
        rows="3"
        class="mt-2 min-h-[88px] w-full resize-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-2.5 text-[14px] leading-5 text-slate-100 outline-none focus:border-slate-400/70"
        placeholder="Add notes for this account"
        @input="$emit('update:notesDraft', ($event.target as HTMLTextAreaElement).value)"
      />
      <div v-if="selectedArchivedSnapshot" class="mt-4 space-y-2">
        <div class="flex items-center gap-2 text-[12px]">
          <label class="font-semibold uppercase tracking-[0.14em] text-slate-400/80">Past Ranks</label>
          <span class="text-slate-500">|</span>
          <div class="relative min-w-0 flex-1">
            <button
              type="button"
              class="inline-flex h-7 w-full items-center justify-between rounded-[6px] border border-[#272b35] bg-[#11141b] px-2.5 text-[12px] text-slate-300 outline-none hover:bg-[#171c25]"
              @click="archivedSnapshotMenuOpen = !archivedSnapshotMenuOpen"
            >
              <span class="truncate">{{ formatSnapshotDate(selectedArchivedSnapshot.createdAt) }}</span>
              <ChevronDown class="h-[14px] w-[14px] shrink-0 text-slate-400/80" :stroke-width="2.2" aria-hidden="true" />
            </button>
            <div v-if="archivedSnapshotMenuOpen" class="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-[8px] border border-[#2a3040] bg-[#0f141d] p-1 shadow-[0_16px_38px_rgba(0,0,0,0.45)]">
              <div class="max-h-[176px] overflow-y-auto">
                <div v-for="snapshot in props.archivedRankSnapshots" :key="snapshot.id" class="flex items-center gap-1">
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-[6px] px-2.5 py-1.5 text-left text-[12px] transition hover:bg-[#1a2130]"
                    :class="snapshot.id === selectedArchivedSnapshotId ? 'bg-[#1a2130] text-slate-100' : 'text-slate-300'"
                    @click="selectArchivedSnapshot(snapshot.id)"
                  >
                    <span class="truncate">{{ formatSnapshotDate(snapshot.createdAt) }}</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-rose-300/90 transition hover:bg-rose-500/12 hover:text-rose-200"
                    :aria-label="`Delete rank reset from ${formatSnapshotDate(snapshot.createdAt)}`"
                    @click.stop="deleteArchivedSnapshot(snapshot.createdAt)"
                  >
                    <X class="h-[13px] w-[13px]" :stroke-width="2.4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="rounded-[8px] border border-[#232835] bg-[#0d121a] px-2.5 py-2">
          <div class="flex items-start justify-between gap-1">
            <div v-for="rank in selectedArchivedSnapshot.ranks" :key="`${selectedArchivedSnapshot.id}-${rank.role}`" class="flex min-w-0 flex-col items-center gap-1">
              <span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400/85">{{ getSnapshotRoleLabel(rank.role) }}</span>
              <div class="relative h-[31px] w-[74px] shrink-0">
                <img :src="rankIcons[rank.tier]" :alt="formatSnapshotRank(rank.tier, rank.division)" class="h-full w-full object-contain" draggable="false">
                <span v-if="rank.tier !== 'Unranked'" class="absolute left-[calc(76.5%-4px)] top-[calc(45%-6px)] text-[16px] font-semibold leading-none text-black [text-shadow:0_0_4px_rgba(255,255,255,0.18)]">{{ rank.division }}</span>
              </div>
            </div>
            <div class="flex min-w-0 flex-col items-center gap-1">
              <span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400/85">6v6</span>
              <div class="relative h-[31px] w-[74px] shrink-0">
                <img :src="rankIcons[selectedArchivedSnapshot.sixV6Rank.tier]" :alt="formatSnapshotRank(selectedArchivedSnapshot.sixV6Rank.tier, selectedArchivedSnapshot.sixV6Rank.division)" class="h-full w-full object-contain" draggable="false">
                <span v-if="selectedArchivedSnapshot.sixV6Rank.tier !== 'Unranked'" class="absolute left-[calc(76.5%-4px)] top-[calc(45%-6px)] text-[16px] font-semibold leading-none text-black [text-shadow:0_0_4px_rgba(255,255,255,0.18)]">{{ selectedArchivedSnapshot.sixV6Rank.division }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="mx-0 mt-4 h-px bg-[#272b35]" aria-hidden="true" />
      <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Status</label>
      <button
        type="button"
        class="mt-2 flex w-full items-center justify-between rounded-[8px] border px-3 py-3 text-left transition"
        :class="props.bannedDraft ? 'border-rose-500/40 bg-rose-500/12 text-rose-100' : 'border-[#272b35] bg-[#11141b] text-slate-100'"
        @click="$emit('toggle-banned')"
      >
        <div class="min-w-0 flex-1 pr-4">
          <div class="text-[14px] font-semibold">{{ props.bannedDraft ? 'Banned :(' : 'Clean :)' }}</div>
          <p class="mt-1 text-[12px] leading-5" :class="props.bannedDraft ? 'text-rose-100/70' : 'text-slate-400/80'">
            Banned accounts stay in their own section.
            That way you know but dont have to delete them.
          </p>
        </div>
        <span class="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-200" :class="props.bannedDraft ? 'border-rose-300/60 bg-rose-400/70' : 'border-[#3b4150] bg-[#29303d]'" aria-hidden="true">
          <span class="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-200" :style="{ transform: `translateX(${props.bannedDraft ? 20 : 2}px)` }" />
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
import { computed, ref, watch } from 'vue'
import { ChevronDown, Info, X } from 'lucide-vue-next'

import { rankIcons } from '~~/app/constants/rankdb'
import type { ArchivedRankSnapshot, CountryOption } from '~~/app/types/rankdb'

const props = defineProps<{
  accountId: number | null
  accountName: string
  archivedRankSnapshots: ArchivedRankSnapshot[]
  bannedDraft: boolean
  countryDraft: string
  countryOptions: CountryOption[]
  notesDraft: string
  getCountryOption: (countryCode: string) => CountryOption | null
  getFlagClass: (countryCode: string) => string
}>()

const snapshotDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

const formatSnapshotDate = (value: string) => snapshotDateFormatter.format(new Date(value))

const selectedArchivedSnapshotId = ref('')
const archivedSnapshotMenuOpen = ref(false)

const emit = defineEmits<{
  close: []
  save: []
  'toggle-banned': []
  'delete:archivedRankSnapshot': [createdAt: string]
  'update:countryDraft': [value: string]
  'update:notesDraft': [value: string]
}>()

watch(
  () => props.archivedRankSnapshots,
  (snapshots) => {
    if (snapshots.length === 0) {
      selectedArchivedSnapshotId.value = ''
      archivedSnapshotMenuOpen.value = false
      return
    }

    if (!snapshots.some((snapshot) => snapshot.id === selectedArchivedSnapshotId.value)) {
      selectedArchivedSnapshotId.value = snapshots[0].id
    }
  },
  { immediate: true }
)

const selectedArchivedSnapshot = computed(() => {
  if (props.archivedRankSnapshots.length === 0) {
    return null
  }

  return props.archivedRankSnapshots.find((snapshot) => snapshot.id === selectedArchivedSnapshotId.value) ?? props.archivedRankSnapshots[0]
})

const handleBackdropClick = () => {
  archivedSnapshotMenuOpen.value = false
  emit('close')
}

const selectArchivedSnapshot = (snapshotId: string) => {
  selectedArchivedSnapshotId.value = snapshotId
  archivedSnapshotMenuOpen.value = false
}

const deleteArchivedSnapshot = (createdAt: string) => {
  emit('delete:archivedRankSnapshot', createdAt)
}

const getSnapshotRoleLabel = (role: string) => {
  if (role === 'T') {
    return 'Tank'
  }
  if (role === 'D') {
    return 'Damage'
  }
  return 'Support'
}

const formatSnapshotRank = (tier: string, division: number) => tier === 'Unranked' ? 'Unranked' : `${tier} ${division}`
</script>
