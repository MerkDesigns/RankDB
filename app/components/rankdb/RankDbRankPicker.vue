<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-black/55" @click.self="$emit('close')">
    <div
      class="relative absolute w-[224px] rounded-[7px] border-2 border-slate-300/55 bg-[#080c13] px-3 py-4 shadow-[0_0_30px_rgba(0,0,0,0.82)]"
      :style="positionStyle"
    >
      <div class="flex items-start justify-center gap-3">
        <div class="grid grid-flow-col grid-rows-5 gap-2">
          <button
            v-for="option in tierOptions"
            :key="option.key"
            type="button"
            class="flex h-[52px] w-[52px] items-center justify-center rounded-[5px] border transition"
            :class="isModalOptionSelected(option) ? 'border-2 border-slate-300/70 bg-[#1b222c]' : 'border border-transparent bg-[#121925] hover:bg-[#1a2230]'"
            @click="$emit('select-option', option)"
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

        <div class="flex w-[64px] flex-col gap-2">
          <div class="h-[232px] rounded-[5px] bg-[#171d27] p-1">
            <button
              v-for="division in divisions"
              :key="`division-${division}`"
              type="button"
              class="flex h-[20%] w-full items-center justify-center rounded-[4px] font-normal leading-none text-slate-100"
              :class="pickerDivision === division ? 'border-2 border-slate-300/70 bg-slate-200/8' : 'border-2 border-transparent'"
              @click="$emit('update:pickerDivision', division)"
            >
              <span class="rank-division-number rank-picker-division-number">{{ division }}</span>
            </button>
          </div>

          <button
            v-if="predictedOption"
            type="button"
            class="flex h-[52px] w-[64px] items-center justify-center rounded-[5px] border transition"
            :class="isModalOptionSelected(predictedOption) ? 'border-2 border-slate-300/70 bg-[#1b222c]' : 'border border-transparent bg-[#121925] hover:bg-[#1a2230]'"
            @click="$emit('select-option', predictedOption)"
          >
            <img
              :src="predictedOption.icon"
              :alt="predictedOption.key"
              class="h-[38px] w-[38px] object-contain"
              :class="getModalOptionOpacityClass(predictedOption)"
              draggable="false"
            >
          </button>
        </div>
      </div>

      <button
        type="button"
        class="mt-3 h-[48px] w-full rounded-[6px] border-2 border-slate-300/70 bg-[#0b1017] text-[16px] font-semibold text-slate-100 transition hover:bg-slate-300/10"
        @click="$emit('apply')"
      >
        Confirm
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ModalOption } from '~~/app/types/rankdb'

const props = defineProps<{
  modelValue: boolean
  positionStyle: Record<string, string>
  modalOptions: ModalOption[]
  divisions: number[]
  pickerDivision: number
  isModalOptionSelected: (option: ModalOption) => boolean
  getModalOptionOpacityClass: (option: ModalOption) => string
}>()

const tierOptions = computed(() => props.modalOptions.filter(option => option.tier))
const predictedOption = computed(() => props.modalOptions.find(option => option.predictedToggle))

defineEmits<{
  apply: []
  close: []
  'select-option': [option: ModalOption]
  'update:pickerDivision': [division: number]
}>()
</script>
