<template>
  <div class="min-h-screen bg-[#0b0d13] text-slate-100" @contextmenu.prevent>
    <NuxtRouteAnnouncer />
    <main class="px-3 py-5 lg:px-5">
      <div class="overflow-x-auto">
        <div class="w-fit" :style="{ minWidth: gridMinWidth, zoom: `${uiZoom / 100}` }">
          <section class="mb-3 grid gap-3" :style="{ gridTemplateColumns: rowColumns }">
            <div class="h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 flex items-center justify-between gap-2.5">
              <div class="flex min-w-0 items-center gap-2.5">
                <img :src="overwatchIcon" alt="Overwatch" class="h-6 w-6 object-contain">
                <span class="truncate text-[15px] font-semibold tracking-tight text-slate-100/95">Overwatch Accounts</span>
              </div>
              <button
                type="button"
                class="inline-flex h-full w-9 items-center justify-center text-slate-100/90 hover:bg-[#181c26]"
                aria-label="Open settings"
                @click.stop="toggleSettingsMenu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-5 w-5"
                  aria-hidden="true"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>
            </div>

            <div class="role-rank-column h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-2.5">
              <div class="role-lane role-lane-header">
                <img :src="tankRoleIcon" alt="Tank" class="mx-auto h-7 w-7 object-contain">
                <img :src="damageRoleIcon" alt="Damage" class="mx-auto h-7 w-7 object-contain">
                <img :src="supportRoleIcon" alt="Support" class="mx-auto h-7 w-7 object-contain">
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

          <TransitionGroup tag="section" name="bar-list" class="space-y-4">
            <article
              v-for="account in accounts"
              :key="account.id"
              :data-bar-id="account.id"
              class="relative h-16 w-full cursor-grab touch-none select-none"
              :class="[draggedAccountId === account.id ? 'cursor-grabbing' : '']"
              @pointerdown="handleBarPointerDown(account.id, $event)"
            >
              <div
                class="pointer-events-none absolute inset-y-0 left-0 rounded-[8px] border border-[#323744] bg-[#10131a]"
                :style="{ width: primarySectionWidth }"
              />
              <div
                v-if="showSixV6"
                class="pointer-events-none absolute inset-y-0 rounded-[8px] border border-[#323744] bg-[#0d1118]"
                :style="{ left: sixV6SectionLeft, width: sixV6SectionWidth }"
              />
              <div
                v-if="showNonRankColumns"
                class="pointer-events-none absolute inset-y-0 rounded-[8px] border border-[#323744] bg-[#0d1118]"
                :style="{ left: creditsSectionLeft, width: creditsSectionWidth }"
              />
              <div class="relative z-[1] grid h-full items-center gap-3" :style="{ gridTemplateColumns: rowColumns }">
                <div class="min-w-0 flex items-center gap-3 px-2.5">
                  <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-[#323744] text-[30px] font-semibold leading-none text-slate-100/90 hover:bg-[#181c26]" title="Copy account name" @click="copyAccountName(account.accountName)">#</button>
                  <div class="min-w-0 flex-1">
                    <input v-if="isEditingName(account.id)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="text" class="h-auto w-full border-b border-slate-400/80 bg-transparent px-0 pb-0.5 text-[24px] font-semibold leading-none text-slate-100 outline-none" @blur="commitActiveEditor" @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                    <span v-else class="truncate text-[24px] font-semibold text-slate-100" @contextmenu.prevent.stop="beginNameEdit(account.id)">{{ getDisplayAccountName(account.accountName) }}</span>
                  </div>
                </div>
                <div class="role-rank-column h-full px-2">
                  <div class="role-lane role-lane-body">
                    <div v-for="(rank, rankIndex) in account.ranks" :key="`${account.id}-${rank.role}`" class="flex items-center justify-center">
                      <button type="button" class="relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="rank.predicted ? 'opacity-[0.35]' : rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100'" @click="openRankPicker(account.id, rankIndex, $event)">
                        <img :src="rankIcons[rank.tier]" :alt="`${rank.tier} ${rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                        <span v-if="rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] -translate-x-1/2 -translate-y-1/2 rank-division-number">{{ rank.division }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="showSixV6" class="sixv6-rank-column h-full px-2">
                  <div class="single-rank-lane">
                    <button type="button" class="relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="account.sixV6Rank.predicted ? 'opacity-[0.35]' : account.sixV6Rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100'" @click="openSixV6Picker(account.id, $event)">
                      <img :src="rankIcons[account.sixV6Rank.tier]" :alt="`${account.sixV6Rank.tier} ${account.sixV6Rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                      <span v-if="account.sixV6Rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] -translate-x-1/2 -translate-y-1/2 rank-division-number">{{ account.sixV6Rank.division }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="showNonRankColumns" class="values-a-column h-full px-2.5">
                  <div class="values-a-lane values-lane-body">
                    <span v-for="(value, valueIndex) in account.valuesA" :key="`${account.id}-a-${valueIndex}`" class="flex h-full w-full items-center justify-center text-[15px] font-semibold text-slate-100/95">
                      <input v-if="isEditingValue(account.id, 'valuesA', valueIndex)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="number" class="h-auto w-full border-b border-slate-400/80 bg-transparent px-0 pb-0.5 text-center text-[20px] font-semibold leading-none tabular-nums text-slate-100 outline-none" @blur="commitActiveEditor" @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                      <span v-else class="inline-flex h-9 items-center text-[20px] font-semibold leading-none tabular-nums" @contextmenu.prevent.stop="beginValueEdit(account.id, 'valuesA', valueIndex)">{{ value }}</span>
                    </span>
                  </div>
                </div>
                <div v-if="showNonRankColumns" class="values-b-column h-full px-2.5">
                  <div class="values-b-lane values-lane-body">
                    <span v-for="(value, valueIndex) in account.valuesB" :key="`${account.id}-b-${valueIndex}`" class="flex h-full w-full min-w-0 items-center justify-center text-[15px] font-semibold text-slate-100/95">
                      <input v-if="isEditingValue(account.id, 'valuesB', valueIndex)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="number" class="h-auto w-full min-w-0 border-b border-slate-400/80 bg-transparent px-0 pb-0.5 text-center text-[20px] font-semibold leading-none tabular-nums text-slate-100 outline-none" @blur="commitActiveEditor" @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                      <span v-else class="inline-flex h-9 items-center text-[20px] font-semibold leading-none tabular-nums" @contextmenu.prevent.stop="beginValueEdit(account.id, 'valuesB', valueIndex)">{{ value }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <button type="button" class="h-16 w-full rounded-[8px] border border-dashed border-[#323744] bg-transparent text-[16px] font-semibold tracking-tight text-slate-100/70 hover:border-slate-500 hover:bg-[#11141b]/80 hover:text-slate-100/90" @click="addRow">
              + Add New Bar
            </button>
          </TransitionGroup>

        </div>
      </div>
    </main>

    <div
      v-if="settingsMenuOpen"
      class="fixed inset-0 z-40 bg-black/55"
      @click="closeSettingsMenu"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Settings</h2>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close settings"
            @click="closeSettingsMenu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[13px] font-semibold text-slate-100/95 hover:bg-[#181c26]"
          @click="showNonRankColumns = !showNonRankColumns"
        >
          <span class="tracking-tight">Credits</span>
          <span
            class="inline-flex h-5 w-10 items-center rounded-full p-0.5 transition"
            :class="showNonRankColumns ? 'bg-cyan-500/80' : 'bg-slate-600/80'"
          >
            <span
              class="h-4 w-4 rounded-full bg-white transition"
              :class="showNonRankColumns ? 'translate-x-5' : 'translate-x-0'"
            />
          </span>
        </button>

        <button
          type="button"
          class="mt-3 inline-flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[13px] font-semibold text-slate-100/95 hover:bg-[#181c26]"
          @click="showSixV6 = !showSixV6"
        >
          <span class="tracking-tight">6v6 Column</span>
          <span
            class="inline-flex h-5 w-10 items-center rounded-full p-0.5 transition"
            :class="showSixV6 ? 'bg-cyan-500/80' : 'bg-slate-600/80'"
          >
            <span
              class="h-4 w-4 rounded-full bg-white transition"
              :class="showSixV6 ? 'translate-x-5' : 'translate-x-0'"
            />
          </span>
        </button>

        <div class="mt-4 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-3">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="text-[13px] font-semibold tracking-tight text-slate-100/95">UI Zoom</span>
            <span class="text-[12px] font-semibold tabular-nums text-slate-300/90">{{ uiZoom }}%</span>
          </div>
          <input
            v-model.number="uiZoom"
            type="range"
            min="80"
            max="125"
            step="5"
            class="w-full accent-cyan-400"
          >
        </div>

        <div class="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500/55">
          made by merk
        </div>
      </div>
    </div>

    <div
      v-if="rankPicker"
      class="fixed inset-0 z-50 bg-black/55"
      @click.self="closeRankPicker"
    >
      <div
        class="absolute w-[224px] rounded-[7px] border-2 border-slate-300/55 bg-[#080c13] px-3 py-4 shadow-[0_0_30px_rgba(0,0,0,0.82)] relative"
        :style="rankPickerPositionStyle"
      >
        <div class="flex items-stretch justify-center gap-3">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="option in modalOptions"
              :key="option.key"
              type="button"
              class="flex h-[52px] w-[52px] items-center justify-center rounded-[5px] border transition"
              :class="isModalOptionSelected(option) ? 'border-2 border-slate-300/70 bg-[#1b222c]' : 'border border-transparent bg-[#121925] hover:bg-[#1a2230]'"
              @click="selectModalOption(option)"
            >
                <img
                  :src="option.icon"
                  :alt="option.key"
                  class="h-[38px] w-[38px] object-contain"
                  :class="getModalOptionOpacityClass(option)"
                  draggable="false"
                >
            </button>
          </div>

          <div class="w-[64px]">
            <div class="h-[230px] rounded-[5px] bg-[#171d27] p-1">
              <button
                v-for="division in divisions"
                :key="`division-${division}`"
                type="button"
                class="flex h-[20%] w-full items-center justify-center rounded-[4px] font-normal leading-none text-slate-100"
                :class="pickerDivision === division ? 'border-2 border-slate-300/70 bg-slate-200/8' : 'border-2 border-transparent'"
                @click="pickerDivision = division"
              >
                <span class="rank-division-number rank-picker-division-number">{{ division }}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="absolute bottom-4 right-[15px] h-[48px] w-[64px] rounded-[6px] border-2 border-slate-300/70 bg-[#0b1017] text-[26px] font-semibold text-slate-100 transition hover:bg-slate-300/10"
          @click="applyRankPicker"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mx-auto h-6 w-6"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import bronzeIcon from '~~/assets/Ranks/Rank_Icon_Bronze.png'
import silverIcon from '~~/assets/Ranks/Rank_Icon_Silver.png'
import goldIcon from '~~/assets/Ranks/Rank_Icon_Gold.png'
import platinumIcon from '~~/assets/Ranks/Rank_Icon_Platinum.png'
import diamondIcon from '~~/assets/Ranks/Rank_Icon_Diamond.png'
import masterIcon from '~~/assets/Ranks/Rank_Icon_Master.png'
import grandmasterIcon from '~~/assets/Ranks/Rank_Icon_Grandmaster.png'
import championIcon from '~~/assets/Ranks/Rank_Icon_Champ.png'
import bronzeModalIcon from '~~/assets/Ranks/Bronze.png'
import silverModalIcon from '~~/assets/Ranks/Silver.png'
import goldModalIcon from '~~/assets/Ranks/Gold.png'
import platinumModalIcon from '~~/assets/Ranks/Platinum.png'
import diamondModalIcon from '~~/assets/Ranks/Diamond.png'
import masterModalIcon from '~~/assets/Ranks/Master.png'
import grandmasterModalIcon from '~~/assets/Ranks/Grandmaster.png'
import championModalIcon from '~~/assets/Ranks/Champion.png'
import unrankedModalIcon from '~~/assets/Ranks/Unranked.png'
import predictedModalIcon from '~~/assets/Ranks/Predicted.png'
import tankRoleIcon from '~~/assets/Icons/Tank_Icon.png'
import damageRoleIcon from '~~/assets/Icons/Damage_Icon.png'
import supportRoleIcon from '~~/assets/Icons/Support_Icon.png'
import flexRoleIcon from '~~/assets/Icons/Flex_Icon.png'
import overwatchIcon from '~~/assets/Icons/Overwatch_Icon.png'
import mythicPrismsIcon from '~~/assets/Icons/MythicPrisms.png'
import overwatchCoinsIcon from '~~/assets/Icons/OverwatchCoins.png'
import overwatchCreditsIcon from '~~/assets/Icons/OverwatchCredits.png'
import competetivePointsIcon from '~~/assets/Icons/CompetetivePoints.png'
import legacyPointsIcon from '~~/assets/Icons/LegacyPoints.png'
import unrankedIcon from '~~/assets/Ranks/Rank_Icon_Unranked.png'

type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster' | 'Champion' | 'Unranked'
type RankEntry = { role: string; tier: RankTier; division: number; color: string; predicted: boolean }
type ModalOption = { key: string; icon: string; tier?: RankTier; predictedToggle?: boolean; dimmed?: boolean }

type AccountRow = {
  id: number
  accountName: string
  ranks: RankEntry[]
  sixV6Rank: RankEntry
  valuesA: number[]
  valuesB: number[]
}

type EditableField =
  | { accountId: number; kind: 'name' }
  | { accountId: number; kind: 'valuesA'; index: number }
  | { accountId: number; kind: 'valuesB'; index: number }

const rankTiers: RankTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Champion', 'Unranked']
const divisions = [1, 2, 3, 4, 5]
const rankIcons: Record<RankTier, string> = {
  Bronze: bronzeIcon,
  Silver: silverIcon,
  Gold: goldIcon,
  Platinum: platinumIcon,
  Diamond: diamondIcon,
  Master: masterIcon,
  Grandmaster: grandmasterIcon,
  Champion: championIcon,
  Unranked: unrankedIcon
}
const modalRankIcons: Record<RankTier, string> = {
  Bronze: bronzeModalIcon,
  Silver: silverModalIcon,
  Gold: goldModalIcon,
  Platinum: platinumModalIcon,
  Diamond: diamondModalIcon,
  Master: masterModalIcon,
  Grandmaster: grandmasterModalIcon,
  Champion: championModalIcon,
  Unranked: unrankedModalIcon
}
const modalOptions: ModalOption[] = [
  { key: 'Champion', icon: modalRankIcons.Champion, tier: 'Champion' },
  { key: 'Grandmaster', icon: modalRankIcons.Grandmaster, tier: 'Grandmaster' },
  { key: 'Master', icon: modalRankIcons.Master, tier: 'Master' },
  { key: 'Diamond', icon: modalRankIcons.Diamond, tier: 'Diamond' },
  { key: 'Platinum', icon: modalRankIcons.Platinum, tier: 'Platinum' },
  { key: 'Gold', icon: modalRankIcons.Gold, tier: 'Gold' },
  { key: 'Silver', icon: modalRankIcons.Silver, tier: 'Silver' },
  { key: 'Bronze', icon: modalRankIcons.Bronze, tier: 'Bronze' },
  { key: 'Unranked', icon: modalRankIcons.Unranked, tier: 'Unranked', dimmed: true },
  { key: 'Predicted', icon: predictedModalIcon, predictedToggle: true, dimmed: true }
]

const rankPicker = ref<{ accountId: number; target: 'role' | 'sixv6'; rankIndex?: number } | null>(null)
const settingsMenuOpen = ref(false)
const activeEditor = ref<EditableField | null>(null)
const activeEditorValue = ref('')
const draggedAccountId = ref<number | null>(null)
const pointerDrag = ref<{
  accountId: number
  pointerId: number
  startY: number
  currentY: number
  height: number
  anchorOffsetY: number
} | null>(null)
const dragLayout = ref<Array<{ accountId: number; top: number; height: number }>>([])
let dragElements = new Map<number, HTMLElement>()
let dragCloneElement: HTMLElement | null = null
let dragSourceElement: HTMLElement | null = null
let dragPointerElement: HTMLElement | null = null
let pendingPointerY: number | null = null
let pointerFrameId: number | null = null
const pickerTier = ref<RankTier>('Bronze')
const pickerDivision = ref<number>(1)
const pickerPredicted = ref(false)
const rankPickerPositionStyle = ref<Record<string, string>>({})
const STORAGE_KEY = 'rankdb_accounts_v2'
const UI_SETTINGS_KEY = 'rankdb_ui_settings_v1'
const roleTemplate = [
  { role: 'T', color: 'text-emerald-300' },
  { role: 'D', color: 'text-lime-400' },
  { role: 'S', color: 'text-violet-400' }
] as const
const emptyRankTier: RankTier = 'Unranked'
const emptyDivision = 1
const emptyValuesA = [0, 0, 0]
const emptyValuesB = [0, 0]
const DEFAULT_ROW_COUNT = 5
const DEFAULT_UI_ZOOM = 100
const MIN_UI_ZOOM = 80
const MAX_UI_ZOOM = 125
const UI_ZOOM_STEP = 5

const buildEmptyAccount = (id: number): AccountRow => ({
  id,
  accountName: 'Battletag',
  ranks: roleTemplate.map((role) => ({
    role: role.role,
    color: role.color,
    tier: emptyRankTier,
    division: emptyDivision,
    predicted: false
  })),
  sixV6Rank: {
    role: '6v6',
    color: 'text-slate-300',
    tier: emptyRankTier,
    division: emptyDivision,
    predicted: false
  },
  valuesA: [...emptyValuesA],
  valuesB: [...emptyValuesB]
})

const buildEmptyAccounts = (count = DEFAULT_ROW_COUNT) => Array.from({ length: count }, (_, idx) => buildEmptyAccount(idx + 1))

const normalizeTier = (value: unknown): RankTier => (
  rankTiers.includes(value as RankTier) ? value as RankTier : emptyRankTier
)

const normalizeDivision = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return emptyDivision
  }

  return Math.min(5, Math.max(1, Math.trunc(numberValue)))
}

const normalizeUiZoom = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_UI_ZOOM
  }

  const steppedValue = Math.round(numberValue / UI_ZOOM_STEP) * UI_ZOOM_STEP
  return Math.min(MAX_UI_ZOOM, Math.max(MIN_UI_ZOOM, steppedValue))
}

const loadStoredUiSettings = () => {
  if (!import.meta.client) {
    return {
      showSixV6: true,
      showNonRankColumns: true,
      uiZoom: DEFAULT_UI_ZOOM
    }
  }

  try {
    const rawSettings = localStorage.getItem(UI_SETTINGS_KEY)
    if (!rawSettings) {
      return {
        showSixV6: true,
        showNonRankColumns: true,
        uiZoom: DEFAULT_UI_ZOOM
      }
    }

    const parsed = JSON.parse(rawSettings)
    return {
      showSixV6: typeof parsed?.showSixV6 === 'boolean' ? parsed.showSixV6 : true,
      showNonRankColumns: typeof parsed?.showNonRankColumns === 'boolean' ? parsed.showNonRankColumns : true,
      uiZoom: normalizeUiZoom(parsed?.uiZoom)
    }
  } catch {
    return {
      showSixV6: true,
      showNonRankColumns: true,
      uiZoom: DEFAULT_UI_ZOOM
    }
  }
}

const normalizeStoredAccount = (fromStorage: any, fallbackId: number): AccountRow => {
  const emptyAccount = buildEmptyAccount(fallbackId)
  const fromStorageRanks = Array.isArray(fromStorage?.ranks) ? fromStorage.ranks : []
  const fromStorageValuesA = Array.isArray(fromStorage?.valuesA) ? fromStorage.valuesA : []
  const fromStorageValuesB = Array.isArray(fromStorage?.valuesB) ? fromStorage.valuesB : []
  const fromStorageSixV6 = (fromStorage?.sixV6Rank && typeof fromStorage.sixV6Rank === 'object') ? fromStorage.sixV6Rank : null

  return {
    ...emptyAccount,
    id: Number.isFinite(Number(fromStorage?.id)) ? Number(fromStorage.id) : fallbackId,
    accountName: typeof fromStorage?.accountName === 'string' ? fromStorage.accountName : emptyAccount.accountName,
    ranks: roleTemplate.map((role, rankIdx) => {
      const rank = fromStorageRanks[rankIdx]

      return {
        role: role.role,
        color: role.color,
        tier: normalizeTier(rank?.tier),
        division: normalizeDivision(rank?.division),
        predicted: normalizeTier(rank?.tier) === 'Unranked' ? false : Boolean(rank?.predicted)
      }
    }),
    sixV6Rank: {
      role: '6v6',
      color: 'text-slate-300',
      tier: normalizeTier(fromStorageSixV6?.tier),
      division: normalizeDivision(fromStorageSixV6?.division),
      predicted: normalizeTier(fromStorageSixV6?.tier) === 'Unranked' ? false : Boolean(fromStorageSixV6?.predicted)
    },
    valuesA: emptyValuesA.map((fallbackValue, valueIdx) => {
      const value = Number(fromStorageValuesA[valueIdx])
      return Number.isFinite(value) ? value : fallbackValue
    }),
    valuesB: emptyValuesB.map((fallbackValue, valueIdx) => {
      const value = Number(fromStorageValuesB[valueIdx])
      return Number.isFinite(value) ? value : fallbackValue
    })
  }
}

const loadStoredAccounts = () => {
  if (!import.meta.client) {
    return buildEmptyAccounts()
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return buildEmptyAccounts()
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return buildEmptyAccounts()
    }

    const rowsFromStorage = parsed.filter((entry) => entry && typeof entry === 'object')
    if (rowsFromStorage.length === 0) {
      return buildEmptyAccounts()
    }

    return rowsFromStorage.map((entry, idx) => normalizeStoredAccount(entry, idx + 1))
  } catch {
    return buildEmptyAccounts()
  }
}

const initialUiSettings = loadStoredUiSettings()
const showSixV6 = ref(initialUiSettings.showSixV6)
const showNonRankColumns = ref(initialUiSettings.showNonRankColumns)
const uiZoom = ref(initialUiSettings.uiZoom)
const rowColumns = computed(() => {
  const columns: number[] = [250, 390]
  if (showSixV6.value) {
    columns.push(130)
  }
  if (showNonRankColumns.value) {
    columns.push(210, 138)
  }
  return columns.map((value) => `${value}px`).join(' ')
})
const gridMinWidth = computed(() => {
  const columns = rowColumns.value.split(' ').map((value) => Number.parseInt(value, 10))
  const columnTotal = columns.reduce((sum, value) => sum + value, 0)
  const gaps = Math.max(columns.length - 1, 0) * 12
  return `${columnTotal + gaps}px`
})
const primarySectionWidth = computed(() => `${250 + 390 + 12}px`)
const sixV6SectionLeft = computed(() => `${250 + 390 + 24}px`)
const sixV6SectionWidth = computed(() => '130px')
const creditsSectionLeft = computed(() => {
  const offset = showSixV6.value ? 250 + 390 + 130 + 36 : 250 + 390 + 24
  return `${offset}px`
})
const creditsSectionWidth = computed(() => {
  if (!showNonRankColumns.value) {
    return '0px'
  }

  const columns = [210, 138]
  const columnTotal = columns.reduce((sum, value) => sum + value, 0)
  const gaps = 12
  return `${columnTotal + gaps}px`
})

const accounts = ref<AccountRow[]>(loadStoredAccounts())

const saveAccounts = () => {
  if (!import.meta.client) {
    return
  }

  const payload = accounts.value.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    ranks: account.ranks.map((rank) => ({
      tier: rank.tier,
      division: rank.division,
      predicted: rank.predicted
    })),
    sixV6Rank: {
      tier: account.sixV6Rank.tier,
      division: account.sixV6Rank.division,
      predicted: account.sixV6Rank.predicted
    },
    valuesA: [...account.valuesA],
    valuesB: [...account.valuesB]
  }))

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

onMounted(() => {
  if (!import.meta.client) {
    return
  }

  if (!localStorage.getItem(STORAGE_KEY)) {
    saveAccounts()
  }

  window.addEventListener('click', closeMenus)
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  window.removeEventListener('click', closeMenus)
  resetDragState()
})

watch(accounts, () => {
  saveAccounts()
}, { deep: true })

watch([showSixV6, showNonRankColumns, uiZoom], ([sixV6Value, nonRankColumnsValue, zoomValue]) => {
  if (!import.meta.client) {
    return
  }
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({
    showSixV6: sixV6Value,
    showNonRankColumns: nonRankColumnsValue,
    uiZoom: normalizeUiZoom(zoomValue)
  }))
})

const getEditorId = (editor: EditableField | null | undefined) => {
  if (!editor) {
    return ''
  }

  return editor.kind === 'name'
    ? `editor-name-${editor.accountId}`
    : `editor-${editor.kind}-${editor.accountId}-${editor.index}`
}

const focusActiveEditor = async () => {
  await nextTick()

  if (!import.meta.client || !activeEditor.value) {
    return
  }

  const element = document.querySelector<HTMLInputElement>(`[data-editor-id="${getEditorId(activeEditor.value)}"]`)
  element?.focus()
  element?.select()
}

const isEditingName = (accountId: number) => (
  activeEditor.value?.accountId === accountId && activeEditor.value.kind === 'name'
)

const isEditingValue = (accountId: number, kind: 'valuesA' | 'valuesB', index: number) => (
  activeEditor.value?.accountId === accountId
  && activeEditor.value.kind === kind
  && activeEditor.value.index === index
)

const getDisplayAccountName = (accountName: string) => {
  const hashIndex = accountName.indexOf('#')
  return hashIndex === -1 ? accountName : accountName.slice(0, hashIndex)
}

const cancelActiveEditor = () => {
  activeEditor.value = null
  activeEditorValue.value = ''
}

const commitActiveEditor = () => {
  if (!activeEditor.value) {
    return
  }

  const editor = activeEditor.value
  const account = accounts.value.find((entry) => entry.id === editor.accountId)
  if (!account) {
    cancelActiveEditor()
    return
  }

  if (editor.kind === 'name') {
    account.accountName = activeEditorValue.value
  } else {
    const parsedValue = Number(activeEditorValue.value)
    const normalizedValue = Number.isFinite(parsedValue) ? parsedValue : 0

    if (editor.kind === 'valuesA') {
      account.valuesA[editor.index] = normalizedValue
    } else {
      account.valuesB[editor.index] = normalizedValue
    }
  }

  cancelActiveEditor()
}

const beginNameEdit = (accountId: number) => {
  commitActiveEditor()
  closeMenus()
  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }

  activeEditor.value = { accountId, kind: 'name' }
  activeEditorValue.value = account.accountName
  focusActiveEditor()
}

const beginValueEdit = (accountId: number, kind: 'valuesA' | 'valuesB', index: number) => {
  commitActiveEditor()
  closeMenus()
  const account = accounts.value.find((entry) => entry.id === accountId)
  const value = kind === 'valuesA' ? account?.valuesA[index] : account?.valuesB[index]

  if (account === undefined || value === undefined) {
    return
  }

  activeEditor.value = { accountId, kind, index }
  activeEditorValue.value = String(value)
  focusActiveEditor()
}

const closeSettingsMenu = () => {
  settingsMenuOpen.value = false
}

const closeMenus = () => {
  closeSettingsMenu()
}

const toggleSettingsMenu = () => {
  settingsMenuOpen.value = !settingsMenuOpen.value
}

const moveBar = (sourceAccountId: number, targetAccountId: number, position: 'before' | 'after') => {
  if (sourceAccountId === targetAccountId) {
    return
  }

  const sourceIndex = accounts.value.findIndex((account) => account.id === sourceAccountId)
  const targetIndex = accounts.value.findIndex((account) => account.id === targetAccountId)
  if (sourceIndex === -1 || targetIndex === -1) {
    return
  }

  const nextAccounts = [...accounts.value]
  const [movedAccount] = nextAccounts.splice(sourceIndex, 1)
  if (!movedAccount) {
    return
  }

  const adjustedTargetIndex = nextAccounts.findIndex((account) => account.id === targetAccountId)
  const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1
  nextAccounts.splice(insertIndex, 0, movedAccount)
  accounts.value = nextAccounts
}

const isInteractiveDragTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('button, input'))
}

const updateDragTarget = (clientY: number) => {
  if (!import.meta.client || !draggedAccountId.value) {
    return
  }

  const barElements = dragLayout.value.filter((entry) => entry.accountId !== draggedAccountId.value)
  if (barElements.length === 0) {
    return
  }

  let targetAccountId = barElements[barElements.length - 1].accountId
  let position: 'before' | 'after' = 'after'

  for (const { accountId, top, height } of barElements) {
    const midpoint = top + (height / 2)
    if (clientY < midpoint) {
      targetAccountId = accountId
      position = 'before'
      break
    }
  }

  moveBar(draggedAccountId.value, targetAccountId, position)
  nextTick(() => {
    dragLayout.value = accounts.value.map((account) => {
      const element = dragElements.get(account.id) ?? document.querySelector<HTMLElement>(`[data-bar-id="${account.id}"]`)
      const rect = element?.getBoundingClientRect()

      return {
        accountId: account.id,
        top: rect?.top ?? 0,
        height: rect?.height ?? 0
      }
    })
  })
}

const resetDragState = () => {
  if (import.meta.client) {
    document.removeEventListener('pointermove', handleWindowPointerMove)
    document.removeEventListener('pointerup', handleWindowPointerUp)
    document.removeEventListener('pointercancel', handleWindowPointerUp)
  }

  for (const element of dragElements.values()) {
    element.style.opacity = ''
  }
  if (dragSourceElement) {
    dragSourceElement.style.opacity = ''
  }

  if (dragCloneElement) {
    dragCloneElement.remove()
  }

  draggedAccountId.value = null
  pointerDrag.value = null
  dragLayout.value = []
  dragElements = new Map()
  dragCloneElement = null
  dragSourceElement = null
  if (dragPointerElement) {
    dragPointerElement.removeEventListener('pointermove', handleWindowPointerMove)
    dragPointerElement.removeEventListener('pointerup', handleWindowPointerUp)
    dragPointerElement.removeEventListener('pointercancel', handleWindowPointerUp)
  }
  dragPointerElement = null
  pendingPointerY = null
  if (import.meta.client && pointerFrameId !== null) {
    cancelAnimationFrame(pointerFrameId)
  }
  pointerFrameId = null
}

const handleBarPointerDown = (accountId: number, event: PointerEvent) => {
  if (event.button !== 0 || isInteractiveDragTarget(event.target)) {
    return
  }

  event.preventDefault()
  commitActiveEditor()
  closeMenus()
  closeRankPicker()
  const sourceElement = event.currentTarget as HTMLElement | null
  dragElements = new Map(
    accounts.value.map((account) => {
      const element = document.querySelector<HTMLElement>(`[data-bar-id="${account.id}"]`)
      return [account.id, element] as const
    }).filter((entry): entry is readonly [number, HTMLElement] => Boolean(entry[1]))
  )
  const sourceRect = sourceElement?.getBoundingClientRect()
  if (!sourceElement || !sourceRect) {
    return
  }
  dragElements.set(accountId, sourceElement)
  try {
    sourceElement.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture is optional; drag still works if the browser rejects it.
  }
  document.addEventListener('pointermove', handleWindowPointerMove)
  document.addEventListener('pointerup', handleWindowPointerUp)
  document.addEventListener('pointercancel', handleWindowPointerUp)
  sourceElement.addEventListener('pointermove', handleWindowPointerMove)
  sourceElement.addEventListener('pointerup', handleWindowPointerUp)
  sourceElement.addEventListener('pointercancel', handleWindowPointerUp)
  dragPointerElement = sourceElement

  dragSourceElement = sourceElement
  dragCloneElement = sourceElement.cloneNode(true) as HTMLElement
  dragCloneElement.style.position = 'fixed'
  dragCloneElement.style.left = `${sourceRect.left}px`
  dragCloneElement.style.top = `${sourceRect.top}px`
  dragCloneElement.style.width = `${sourceRect.width}px`
  dragCloneElement.style.height = `${sourceRect.height}px`
  dragCloneElement.style.zIndex = '60'
  dragCloneElement.style.pointerEvents = 'none'
  dragCloneElement.style.margin = '0'
  dragCloneElement.style.opacity = '1'
  dragCloneElement.style.boxShadow = '0 12px 24px rgba(0,0,0,0.28)'
  dragCloneElement.style.transition = 'none'
  document.body.appendChild(dragCloneElement)

  dragSourceElement.style.opacity = '0'
  pointerDrag.value = {
    accountId,
    pointerId: event.pointerId,
    startY: event.clientY,
    currentY: event.clientY,
    height: sourceRect.height,
    anchorOffsetY: sourceRect.height / 2
  }
  dragLayout.value = accounts.value.map((account) => {
    const element = dragElements.get(account.id)
    const rect = element?.getBoundingClientRect()

    return {
      accountId: account.id,
      top: rect?.top ?? 0,
      height: rect?.height ?? 0
    }
  })
}

const handleWindowPointerMove = (event: PointerEvent) => {
  if (!pointerDrag.value || event.pointerId !== pointerDrag.value.pointerId) {
    return
  }

  event.preventDefault()
  pendingPointerY = event.clientY

  if (pointerFrameId !== null) {
    return
  }

  pointerFrameId = requestAnimationFrame(() => {
    pointerFrameId = null

    if (!pointerDrag.value || pendingPointerY === null) {
      return
    }

    pointerDrag.value.currentY = pendingPointerY

    if (!draggedAccountId.value && Math.abs(pointerDrag.value.currentY - pointerDrag.value.startY) > 6) {
      draggedAccountId.value = pointerDrag.value.accountId
    }

    if (!draggedAccountId.value) {
      return
    }

    const dragAnchorY = (pointerDrag.value.currentY - pointerDrag.value.anchorOffsetY) + (pointerDrag.value.height / 2)
    updateDragTarget(dragAnchorY)
    if (dragCloneElement) {
      dragCloneElement.style.top = `${pointerDrag.value.currentY - pointerDrag.value.anchorOffsetY}px`
    }
  })
}

const handleWindowPointerUp = (event: PointerEvent) => {
  if (!pointerDrag.value || event.pointerId !== pointerDrag.value.pointerId) {
    return
  }

  try {
    dragSourceElement?.releasePointerCapture(event.pointerId)
  } catch {
    // Ignore browsers that do not keep pointer capture active here.
  }
  resetDragState()
}

const addRow = () => {
  const nextId = Math.max(0, ...accounts.value.map((account) => account.id)) + 1
  accounts.value.push(buildEmptyAccount(nextId))
}

const removeBar = (accountId: number) => {
  if (accounts.value.length <= 1) {
    return
  }

  accounts.value = accounts.value.filter((account) => account.id !== accountId)
  if (rankPicker.value?.accountId === accountId) {
    closeRankPicker()
  }
}

const copyAccountName = async (accountName: string) => {
  await navigator.clipboard.writeText(accountName)
}

const openRankPicker = (accountId: number, rankIndex: number, event: MouseEvent) => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  const rank = account?.ranks[rankIndex]

  if (!rank) {
    return
  }

  const target = event.currentTarget as HTMLElement | null
  if (target) {
    const rect = target.getBoundingClientRect()
    const modalWidth = 224
    const modalHeight = 312
    const viewportPadding = 10
    const desiredLeft = rect.right + 10
    const desiredTop = rect.top + (rect.height / 2) - (modalHeight / 2)
    const maxLeft = window.innerWidth - modalWidth - viewportPadding
    const maxTop = window.innerHeight - modalHeight - viewportPadding
    const left = Math.max(viewportPadding, Math.min(desiredLeft, maxLeft))
    const top = Math.max(viewportPadding, Math.min(desiredTop, maxTop))
    rankPickerPositionStyle.value = {
      left: `${left}px`,
      top: `${top}px`
    }
  }

  pickerTier.value = rank.tier
  pickerDivision.value = rank.division
  pickerPredicted.value = rank.predicted
  rankPicker.value = { accountId, target: 'role', rankIndex }
}

const openSixV6Picker = (accountId: number, event: MouseEvent) => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }

  const target = event.currentTarget as HTMLElement | null
  if (target) {
    const rect = target.getBoundingClientRect()
    const modalWidth = 224
    const modalHeight = 312
    const viewportPadding = 10
    const desiredLeft = rect.right + 10
    const desiredTop = rect.top + (rect.height / 2) - (modalHeight / 2)
    const maxLeft = window.innerWidth - modalWidth - viewportPadding
    const maxTop = window.innerHeight - modalHeight - viewportPadding
    const left = Math.max(viewportPadding, Math.min(desiredLeft, maxLeft))
    const top = Math.max(viewportPadding, Math.min(desiredTop, maxTop))
    rankPickerPositionStyle.value = {
      left: `${left}px`,
      top: `${top}px`
    }
  }

  pickerTier.value = account.sixV6Rank.tier
  pickerDivision.value = account.sixV6Rank.division
  pickerPredicted.value = account.sixV6Rank.predicted
  rankPicker.value = { accountId, target: 'sixv6' }
}

const closeRankPicker = () => {
  rankPicker.value = null
}

const applyRankPicker = () => {
  if (!rankPicker.value) {
    return
  }

  const account = accounts.value.find((entry) => entry.id === rankPicker.value?.accountId)
  if (!account) {
    closeRankPicker()
    return
  }

  if (rankPicker.value.target === 'role') {
    const rank = account.ranks[rankPicker.value.rankIndex ?? -1]
    if (!rank) {
      closeRankPicker()
      return
    }

    rank.tier = pickerTier.value
    rank.division = pickerDivision.value
    rank.predicted = pickerTier.value === 'Unranked' ? false : pickerPredicted.value
  } else {
    account.sixV6Rank.tier = pickerTier.value
    account.sixV6Rank.division = pickerDivision.value
    account.sixV6Rank.predicted = pickerTier.value === 'Unranked' ? false : pickerPredicted.value
  }

  closeRankPicker()
}

const isModalOptionSelected = (option: ModalOption) => {
  if (option.predictedToggle) {
    return pickerTier.value !== 'Unranked' && pickerPredicted.value
  }

  if (option.tier) {
    return pickerTier.value === option.tier
  }

  return false
}

const selectModalOption = (option: ModalOption) => {
  if (option.predictedToggle) {
    if (pickerTier.value === 'Unranked') {
      return
    }
    pickerPredicted.value = !pickerPredicted.value
    return
  }

  if (option.tier) {
    pickerTier.value = option.tier
    if (option.tier === 'Unranked') {
      pickerPredicted.value = false
    }
  }
}

const getModalOptionOpacityClass = (option: ModalOption) => {
  if (!option.dimmed) {
    return 'opacity-100'
  }

  if (option.predictedToggle && pickerTier.value === 'Unranked') {
    return 'opacity-25'
  }

  return 'opacity-45'
}
</script>

<style scoped>
.role-rank-column,
.sixv6-rank-column {
  --rank-badge-width: 112px;
}

.values-a-column {
  --value-a-track-width: 1fr;
}

.values-b-column {
  --value-b-track-width: 1fr;
  --value-b-gap: 12px;
  --value-b-pad-left: 6px;
  --value-b-pad-right: 6px;
}

.role-lane {
  display: grid;
  grid-template-columns: repeat(3, var(--rank-badge-width));
  column-gap: 10px;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.single-rank-lane {
  display: grid;
  grid-template-columns: var(--rank-badge-width);
  justify-content: center;
  justify-items: center;
  align-items: center;
  height: 100%;
}

.values-a-lane {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, var(--value-a-track-width)));
  align-items: center;
  height: 100%;
}

.values-b-lane {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, var(--value-b-track-width)));
  justify-content: center;
  column-gap: var(--value-b-gap);
  padding-left: var(--value-b-pad-left);
  padding-right: var(--value-b-pad-right);
  align-items: center;
  height: 100%;
}

.values-b-icon {
  width: 38px;
  height: 38px;
}


.values-lane-header {
  justify-items: center;
}

.values-lane-body {
  justify-items: stretch;
}

.bar-list-move {
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}
</style>
