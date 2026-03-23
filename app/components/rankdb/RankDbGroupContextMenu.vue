<template>
  <div
    v-if="groupId !== null"
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
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
        @click="$emit('edit-group', groupId)"
      >
        <PencilLine class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Edit Group Name
      </button>
      <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-red-300 transition hover:bg-[#181c26]"
        @click="$emit('delete-group', groupId)"
      >
        <Trash2 class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
        Delete Group
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PencilLine, Trash2 } from 'lucide-vue-next'

defineProps<{
  groupId: string | null
  positionStyle: Record<string, string>
}>()

defineEmits<{
  close: []
  'delete-group': [groupId: string]
  'edit-group': [groupId: string]
}>()
</script>
