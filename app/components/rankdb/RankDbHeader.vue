<template>
  <div class="content-slide w-fit" :style="{ minWidth: fullGridWidth, transform: `translate3d(${contentTranslateX}, 0, 0)` }">
    <section class="mb-3 grid gap-3" :style="{ gridTemplateColumns: rowColumns }">
      <div
        class="top-bar-anchored col-span-2 flex h-11 items-center justify-between gap-3 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3"
        :style="{ width: topBarWidth, transform: `translate3d(${topBarOffsetX}, 0, 0)` }"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <img :src="overwatchIcon" alt="Overwatch" class="h-6 w-6 object-contain">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center text-slate-100/90 hover:bg-[#181c26]"
            :aria-label="showLeadButtons ? 'Hide lead buttons' : 'Show lead buttons'"
            @click.stop="$emit('toggle-lead-buttons')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5 transition-transform duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]"
              :class="showLeadButtons ? 'rotate-180' : ''"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>
        <div class="flex h-full items-center">
          <button
            type="button"
            class="inline-flex h-full w-9 items-center justify-center text-slate-100/90 hover:bg-[#181c26]"
            aria-label="Open settings"
            @click.stop="$emit('toggle-settings')"
          >
            <SlidersHorizontal class="h-5 w-5" :stroke-width="2.1" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="role-rank-column h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-2.5">
        <div class="role-lane role-lane-header">
          <button
            v-for="roleHeader in sortableRoleHeaders"
            :key="roleHeader.label"
            type="button"
            class="group relative mx-auto inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-100/90 transition hover:bg-[#181c26]"
            :aria-label="`Sort by ${roleHeader.label}`"
            :title="getRoleSortTitle(roleHeader.label)"
            @click="$emit('cycle-role-sort', roleHeader.index)"
            @contextmenu.prevent="$emit('restore-role-sort', roleHeader.index)"
          >
            <ChevronDown
              v-if="activeRoleSort?.roleIndex === roleHeader.index"
              class="pointer-events-none absolute right-[calc(100%+7px)] top-1/2 h-[14.4px] w-[14.4px] -translate-y-1/2 text-slate-100/90"
              :class="activeRoleSort.direction === 'asc' ? 'rotate-180' : ''"
              :stroke-width="2.35"
              aria-hidden="true"
            />
            <img :src="roleHeader.icon" :alt="roleHeader.label" class="h-7 w-7 object-contain">
            <ChevronDown
              v-if="activeRoleSort?.roleIndex === roleHeader.index"
              class="pointer-events-none absolute left-[calc(100%+7px)] top-1/2 h-[14.4px] w-[14.4px] -translate-y-1/2 text-slate-100/90"
              :class="activeRoleSort.direction === 'asc' ? 'rotate-180' : ''"
              :stroke-width="2.35"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div v-if="showSixV6" class="sixv6-rank-column h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-2">
        <div class="single-rank-lane">
          <img :src="flexRoleIcon" alt="6v6 Flex" class="h-7 w-7 object-contain">
        </div>
      </div>

      <div v-if="showNonRankColumns" class="values-a-column h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-2.5">
        <div class="values-a-lane values-lane-header">
          <img :src="mythicPrismsIcon" alt="Mythic Prisms" class="h-[38px] w-[38px] object-contain">
          <img :src="overwatchCoinsIcon" alt="Overwatch Coins" class="h-[38px] w-[38px] object-contain">
          <img :src="overwatchCreditsIcon" alt="Overwatch Credits" class="h-[38px] w-[38px] object-contain">
        </div>
      </div>

      <div v-if="showNonRankColumns" class="values-b-column h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-2.5">
        <div class="values-b-lane values-lane-header">
          <img :src="competetivePointsIcon" alt="Competitive Points" class="values-b-icon object-contain">
          <img :src="legacyPointsIcon" alt="Legacy Points" class="values-b-icon object-contain">
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, SlidersHorizontal } from 'lucide-vue-next'

import type { RoleSortState } from '~~/app/types/rankdb'

defineProps<{
  activeRoleSort: RoleSortState | null
  contentTranslateX: string
  fullGridWidth: string
  topBarOffsetX: string
  topBarWidth: string
  rowColumns: string
  showLeadButtons: boolean
  showNonRankColumns: boolean
  showSixV6: boolean
  sortableRoleHeaders: Array<{ icon: string; index: number; label: string }>
  getRoleSortTitle: (label: string) => string
  competetivePointsIcon: string
  flexRoleIcon: string
  legacyPointsIcon: string
  mythicPrismsIcon: string
  overwatchCoinsIcon: string
  overwatchCreditsIcon: string
  overwatchIcon: string
}>()

defineEmits<{
  'cycle-role-sort': [roleIndex: number]
  'restore-role-sort': [roleIndex: number]
  'toggle-lead-buttons': []
  'toggle-settings': []
}>()
</script>
