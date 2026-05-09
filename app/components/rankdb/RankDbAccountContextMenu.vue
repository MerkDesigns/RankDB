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
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
        @mouseenter="openGamesDodgedMenu"
        @mouseleave="scheduleCloseGamesDodgedMenu"
        @click="toggleGamesDodgedMenu"
      >
        <Gamepad2 class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Games Dodged
        <ChevronRight class="ml-auto h-[15px] w-[15px] shrink-0 text-slate-300/80" :stroke-width="2.2" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
        :disabled="isBanned"
        @mouseenter="openMoveToMenu"
        @mouseleave="scheduleCloseMoveToMenu"
        @click="toggleMoveToMenu"
      >
        <FolderClosed class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Move To
        <ChevronRight class="ml-auto h-[15px] w-[15px] shrink-0 text-slate-300/80" :stroke-width="2.2" aria-hidden="true" />
      </button>
      <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-red-300 transition hover:bg-[#181c26]" @click="$emit('delete-account', accountId)">
        <Trash2 class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Delete Account
      </button>
    </div>

    <div
      v-if="gamesDodgedMenuOpen"
      class="absolute w-[218px] rounded-[10px] border border-[#323744] bg-[#0c1018] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      :style="gamesDodgedMenuStyle"
      @click.stop
      @contextmenu.stop
      @mouseenter="openGamesDodgedMenu"
      @mouseleave="scheduleCloseGamesDodgedMenu"
    >
      <div class="px-3 pb-2 pt-2">
        <div class="flex items-start justify-between gap-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400/85">
            Next Penalty
          </div>
          <div class="group relative -mr-1 -mt-1">
            <button
              type="button"
              class="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-slate-400/85 transition hover:bg-[#181c26] hover:text-slate-100"
              aria-label="Games dodged penalty info"
            >
              <Info class="h-[13px] w-[13px]" :stroke-width="2.35" aria-hidden="true" />
            </button>
            <div class="theme-panel-raised theme-border-subtle theme-text-muted pointer-events-none absolute right-0 top-[calc(100%+7px)] z-10 w-[238px] rounded-[8px] border border-[#2b3140] bg-[#0f141d] px-3 py-2 text-[13.2px] font-semibold leading-[1.45] text-slate-300 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition duration-150 group-hover:opacity-100">
              Play 20 games without dodging to reset penalties. Dodge 10 games total in a season and the season ban applies.
            </div>
          </div>
        </div>
        <div class="mt-1 text-[18px] font-semibold leading-none text-slate-100">
          {{ nextPenaltyLabel }}
        </div>
        <div class="mt-1 text-[12px] font-semibold text-slate-400/85">
          {{ normalizedGamesDodged }} dodged in last 20 games
        </div>
      </div>
      <div class="mx-2 mb-1 h-px bg-[#272b35]" aria-hidden="true" />
      <div class="flex items-center gap-1 px-1 pb-1">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[14px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
          @click="handleRecordGameDodge"
        >
          <Plus class="h-[14px] w-[14px] shrink-0 text-slate-300/90" :stroke-width="2.3" aria-hidden="true" />
          Add Dodge
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-slate-300/90 transition hover:bg-[#181c26] disabled:cursor-not-allowed disabled:opacity-45"
          title="Reset games dodged"
          aria-label="Reset games dodged"
          :disabled="normalizedGamesDodged === 0"
          @click="handleResetGameDodges"
        >
          <RotateCcw class="h-[14px] w-[14px]" :stroke-width="2.3" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      v-if="moveToMenuOpen"
      class="absolute min-w-[180px] rounded-[10px] border border-[#323744] bg-[#0c1018] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      :style="moveToMenuStyle"
      @click.stop
      @contextmenu.stop
      @mouseenter="openMoveToMenu"
      @mouseleave="scheduleCloseMoveToMenu"
    >
      <div class="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400/85">
        Move To
      </div>
      <button
        v-for="group in groups"
        :key="group.id"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[14px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
        @click="handleMoveTo(group.id)"
      >
        <Check v-if="currentGroupId === group.id" class="h-[14px] w-[14px] shrink-0 text-cyan-300" :stroke-width="2.4" aria-hidden="true" />
        <FolderClosed v-else class="h-[14px] w-[14px] shrink-0 text-slate-300/80" :stroke-width="2.15" aria-hidden="true" />
        {{ group.name }}
      </button>
      <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
      <button type="button" class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[14px] font-semibold text-red-200/90 transition hover:bg-[#22161b]" @click="handleMoveTo(null)">
        <FolderMinus class="h-[14px] w-[14px] shrink-0 text-red-300/80" :stroke-width="2.15" aria-hidden="true" />
        Remove From Group
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronRight, FolderClosed, FolderMinus, Gamepad2, IdCard, Info, PencilLine, Plus, RefreshCw, RotateCcw, ShieldEllipsis, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  accountId: number | null
  currentGroupId: string | null
  gamesDodged: number
  groups: Array<{ id: string; name: string }>
  isBanned: boolean
  lastRankModifiedLabel: string
  positionStyle: Record<string, string>
  rankRefreshBusy: boolean
}>()

const emit = defineEmits<{
  'account-info': [accountId: number]
  close: []
  'delete-account': [accountId: number]
  'edit-battletag': [accountId: number]
  'edit-credentials': [accountId: number]
  'move-to-group': [payload: { accountId: number; groupId: string | null }]
  'record-game-dodge': [accountId: number]
  'refresh-rank': [accountId: number]
  'reset-game-dodges': [accountId: number]
}>()

const moveToMenuOpen = ref(false)
const gamesDodgedMenuOpen = ref(false)
let moveToMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null
let gamesDodgedMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null
const dodgePenaltyLabels = ['15min', '2h', '8h', '20h', 'Season Ban'] as const
const normalizedGamesDodged = computed(() => Math.max(0, Math.floor(Number.isFinite(props.gamesDodged) ? props.gamesDodged : 0)))
const nextPenaltyLabel = computed(() => dodgePenaltyLabels[Math.min(normalizedGamesDodged.value, dodgePenaltyLabels.length - 1)])
const gamesDodgedMenuStyle = computed(() => {
  const left = Number.parseFloat(props.positionStyle.left ?? '0')
  const top = Number.parseFloat(props.positionStyle.top ?? '0')
  return {
    left: `${left + 196}px`,
    top: `${top + 126}px`
  }
})
const moveToMenuStyle = computed(() => {
  const left = Number.parseFloat(props.positionStyle.left ?? '0')
  const top = Number.parseFloat(props.positionStyle.top ?? '0')
  return {
    left: `${left + 196}px`,
    top: `${top + 160}px`
  }
})

const openMoveToMenu = () => {
  if (props.isBanned) {
    return
  }

  closeGamesDodgedMenu()
  clearMoveToMenuCloseTimeout()
  moveToMenuOpen.value = true
}

const clearMoveToMenuCloseTimeout = () => {
  if (moveToMenuCloseTimeout === null) {
    return
  }

  clearTimeout(moveToMenuCloseTimeout)
  moveToMenuCloseTimeout = null
}

const closeMoveToMenu = () => {
  clearMoveToMenuCloseTimeout()
  moveToMenuOpen.value = false
}

const openGamesDodgedMenu = () => {
  closeMoveToMenu()
  clearGamesDodgedMenuCloseTimeout()
  gamesDodgedMenuOpen.value = true
}

const clearGamesDodgedMenuCloseTimeout = () => {
  if (gamesDodgedMenuCloseTimeout === null) {
    return
  }

  clearTimeout(gamesDodgedMenuCloseTimeout)
  gamesDodgedMenuCloseTimeout = null
}

const closeGamesDodgedMenu = () => {
  clearGamesDodgedMenuCloseTimeout()
  gamesDodgedMenuOpen.value = false
}

const scheduleCloseGamesDodgedMenu = () => {
  clearGamesDodgedMenuCloseTimeout()
  gamesDodgedMenuCloseTimeout = setTimeout(() => {
    gamesDodgedMenuOpen.value = false
    gamesDodgedMenuCloseTimeout = null
  }, 120)
}

const toggleGamesDodgedMenu = () => {
  closeMoveToMenu()
  clearGamesDodgedMenuCloseTimeout()
  gamesDodgedMenuOpen.value = !gamesDodgedMenuOpen.value
}

const scheduleCloseMoveToMenu = () => {
  clearMoveToMenuCloseTimeout()
  moveToMenuCloseTimeout = setTimeout(() => {
    moveToMenuOpen.value = false
    moveToMenuCloseTimeout = null
  }, 120)
}

const toggleMoveToMenu = () => {
  if (props.isBanned) {
    return
  }

  closeGamesDodgedMenu()
  clearMoveToMenuCloseTimeout()
  moveToMenuOpen.value = !moveToMenuOpen.value
}

const handleMoveTo = (groupId: string | null) => {
  if (props.accountId === null) {
    return
  }

  closeMoveToMenu()
  emit('move-to-group', {
    accountId: props.accountId,
    groupId
  })
}

const handleRecordGameDodge = () => {
  if (props.accountId === null) {
    return
  }

  emit('record-game-dodge', props.accountId)
}

const handleResetGameDodges = () => {
  if (props.accountId === null) {
    return
  }

  emit('reset-game-dodges', props.accountId)
}

watch(() => props.accountId, () => {
  closeMoveToMenu()
  closeGamesDodgedMenu()
})

onBeforeUnmount(() => {
  clearMoveToMenuCloseTimeout()
  clearGamesDodgedMenuCloseTimeout()
})
</script>
