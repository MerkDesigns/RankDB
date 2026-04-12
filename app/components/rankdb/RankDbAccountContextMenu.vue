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
import { Check, ChevronRight, FolderClosed, FolderMinus, IdCard, PencilLine, RefreshCw, ShieldEllipsis, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  accountId: number | null
  currentGroupId: string | null
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
  'refresh-rank': [accountId: number]
}>()

const moveToMenuOpen = ref(false)
let moveToMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null
const moveToMenuStyle = computed(() => {
  const left = Number.parseFloat(props.positionStyle.left ?? '0')
  const top = Number.parseFloat(props.positionStyle.top ?? '0')
  return {
    left: `${left + 196}px`,
    top: `${top + 126}px`
  }
})

const openMoveToMenu = () => {
  if (props.isBanned) {
    return
  }

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

watch(() => props.accountId, () => {
  closeMoveToMenu()
})

onBeforeUnmount(() => {
  clearMoveToMenuCloseTimeout()
})
</script>
