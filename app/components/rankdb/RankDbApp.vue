<template>
  <div
    class="h-screen overflow-hidden bg-[#07090f] text-slate-100"
    :style="{
      '--rank-number-offset-x': `${rankNumberOffsetX}`,
      '--rank-number-offset-y': `${rankNumberOffsetY}`,
      '--rank-number-font-size': `${rankNumberFontSize}`,
      '--rank-number-platform-offset-x': `${rankNumberPlatformOffsetX}`,
      '--rank-number-platform-offset-y': `${rankNumberPlatformOffsetY}`,
      '--rank-number-platform-font-adjust': `${rankNumberPlatformFontAdjust}`
    }"
    @contextmenu.prevent
  >
    <NuxtRouteAnnouncer />
    <main ref="appMainElement" class="box-border h-full overflow-hidden px-3 py-5 lg:px-5">
      <div class="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-hidden">
        <div
          ref="tauriResizeViewport"
          class="lead-buttons-viewport flex min-h-0 flex-col"
          :style="{ width: visibleGridWidth, minWidth: visibleGridWidth, zoom: `${uiZoom / 125}` }"
        >
          <RankDbHeader
            :active-role-sort="activeRoleSort"
            :competetive-points-icon="competetivePointsIcon"
            :content-translate-x="contentTranslateX"
            :flex-role-icon="flexRoleIcon"
            :full-grid-width="fullGridWidth"
            :get-role-sort-title="getRoleSortTitle"
            :legacy-points-icon="legacyPointsIcon"
            :mythic-prisms-icon="mythicPrismsIcon"
            :overwatch-coins-icon="overwatchCoinsIcon"
            :overwatch-credits-icon="overwatchCreditsIcon"
            :overwatch-icon="overwatchIcon"
            :row-columns="rowColumns"
            :show-lead-buttons="showLeadButtons"
            :show-non-rank-columns="showNonRankColumns"
            :show-six-v6="showSixV6"
            :sortable-role-headers="sortableRoleHeaders"
            :top-bar-offset-x="topBarOffsetX"
            :top-bar-width="topBarWidth"
            @cycle-role-sort="cycleRoleSort"
            @restore-role-sort="restoreCustomRoleSort"
            @toggle-lead-buttons="toggleLeadButtons"
            @toggle-settings="toggleSettingsMenu"
          />

          <div ref="accountListViewport" class="account-list-viewport min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <TransitionGroup tag="section" name="bar-list" class="space-y-4 pb-[20px]">
              <template v-for="entry in renderEntries" :key="entry.key">
              <div
                v-if="entry.kind === 'banned-divider'"
                class="relative h-10"
                :class="entry.key === 'banned-divider' ? 'mt-[52px]' : ''"
                :style="{ width: fullGridWidth }"
              >
                <div
                  class="top-bar-anchored absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-3"
                  :style="{ width: visibleGridWidth }"
                >
                  <div class="h-px flex-1 bg-[#4a2630]" />
                  <span class="rounded-full border border-[#4a2630] bg-[#221018] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/90">
                    Banned Accounts
                  </span>
                  <div class="h-px flex-1 bg-[#4a2630]" />
                </div>
              </div>
              <article
                v-else
                :data-bar-id="entry.account.id"
                class="bar-shell relative h-16 cursor-grab touch-none select-none"
                :class="[draggedAccountId === entry.account.id ? 'cursor-grabbing' : '']"
                :style="{ width: fullGridWidth }"
                @pointerdown="handleBarPointerDown(entry.account.id, $event)"
              >
              <div class="absolute inset-y-0 left-0 z-0 overflow-hidden" :style="{ width: `${leadColumnWidth}px` }">
                <div class="flex h-full items-center pl-0 pr-0">
                  <div
                    class="-ml-[2px] flex w-full items-center justify-center gap-0 transition-[opacity,transform,filter] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    :class="showLeadButtons ? 'translate-x-0 opacity-100 blur-0' : 'translate-x-4 opacity-0 blur-[2px]'"
                  >
                    <button
                      type="button"
                      class="inline-flex h-[56px] w-[46px] items-center justify-center rounded-l-[12px] rounded-r-none border border-r-0 border-[#323744] bg-[#0d1118] text-slate-100/78"
                      title="Copy email"
                      @click.stop="copyAccountCredential(entry.account.id, 'email')"
                    >
                      <User class="h-[22px] w-[22px] translate-y-[0.5px]" :stroke-width="2.25" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-[56px] w-[46px] items-center justify-center rounded-r-[12px] rounded-l-none border border-[#323744] bg-[#0d1118] text-slate-100/78"
                      title="Copy password"
                      @click.stop="copyAccountCredential(entry.account.id, 'password')"
                    >
                      <KeyRound class="h-[22px] w-[22px] translate-y-[0.5px]" :stroke-width="2.25" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="row-main-shell absolute inset-y-0 z-[1]" :style="{ left: rowMainOffset, width: rowMainWidth }">
                <div class="pointer-events-none absolute inset-y-0 left-0 rounded-[8px] border border-[#323744] bg-[#10131a]" :style="{ width: mainPrimarySectionWidth }" />
                <div
                  v-if="showSixV6"
                  class="pointer-events-none absolute inset-y-0 rounded-[8px] border border-[#323744] bg-[#0d1118]"
                  :style="{ left: mainSixV6SectionLeft, width: sixV6SectionWidth }"
                />
                <div
                  v-if="showNonRankColumns"
                  class="pointer-events-none absolute inset-y-0 rounded-[8px] border border-[#323744] bg-[#0d1118]"
                  :style="{ left: mainCreditsSectionLeft, width: creditsSectionWidth }"
                />
                <div class="relative grid h-full items-center gap-3" :style="{ gridTemplateColumns: mainColumns }">
                <div class="min-w-0 flex items-center gap-3 px-2.5" @contextmenu.prevent.stop="openAccountContextMenu(entry.account.id, $event)">
                  <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-[#323744] text-slate-100/90 hover:bg-[#181c26]" title="Copy battletag" @click="copyAccountName(entry.account.accountName)"><img :src="battlenetIcon" alt="Copy battletag" class="h-9 w-9 object-contain" draggable="false"></button>
                  <div class="min-w-0 flex-1">
                    <input v-if="isEditingName(entry.account.id)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="text" class="h-auto w-full border-b border-slate-400/80 bg-transparent px-0 pb-0.5 text-[24px] font-semibold leading-none text-slate-100 outline-none" @blur="commitActiveEditor" @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                    <span v-else class="truncate text-[24px] font-semibold text-slate-100">{{ getDisplayAccountName(entry.account.accountName) }}</span>
                  </div>
                </div>
                <div class="role-rank-column h-full px-2" @contextmenu.prevent.stop="openAccountContextMenu(entry.account.id, $event)">
                  <div class="role-lane role-lane-body">
                    <div v-for="(rank, rankIndex) in entry.account.ranks" :key="`${entry.account.id}-${rank.role}`" class="flex items-center justify-center">
                      <button type="button" class="rank-badge-button relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="[rank.predicted ? 'opacity-[0.35]' : rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100', getRankBadgeShineClass(rank.tier), getRankBadgeSparkleClass(rank.tier)]" :style="getRankBadgeMaskStyle(rank.tier)" @click="openRankPicker(entry.account.id, rankIndex, $event)">
                        <img :src="rankIcons[rank.tier]" :alt="`${rank.tier} ${rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                        <span v-if="hasRankBadgeShine(rank.tier)" class="rank-badge-shine" aria-hidden="true" />
                        <span v-if="hasRankBadgeSparkles(rank.tier)" class="rank-badge-sparkles" aria-hidden="true" />
                        <span v-if="hasRankBadgeExtraSparkles(rank.tier)" class="rank-badge-sparkles rank-badge-sparkles-secondary" aria-hidden="true" />
                        <span v-if="rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] rank-badge-number rank-division-number">{{ rank.division }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="showSixV6" class="sixv6-rank-column h-full px-2" @contextmenu.prevent.stop="openAccountContextMenu(entry.account.id, $event)">
                  <div class="single-rank-lane">
                    <button type="button" class="rank-badge-button relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="[entry.account.sixV6Rank.predicted ? 'opacity-[0.35]' : entry.account.sixV6Rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100', getRankBadgeShineClass(entry.account.sixV6Rank.tier), getRankBadgeSparkleClass(entry.account.sixV6Rank.tier)]" :style="getRankBadgeMaskStyle(entry.account.sixV6Rank.tier)" @click="openSixV6Picker(entry.account.id, $event)">
                      <img :src="rankIcons[entry.account.sixV6Rank.tier]" :alt="`${entry.account.sixV6Rank.tier} ${entry.account.sixV6Rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                      <span v-if="hasRankBadgeShine(entry.account.sixV6Rank.tier)" class="rank-badge-shine" aria-hidden="true" />
                      <span v-if="hasRankBadgeSparkles(entry.account.sixV6Rank.tier)" class="rank-badge-sparkles" aria-hidden="true" />
                      <span v-if="hasRankBadgeExtraSparkles(entry.account.sixV6Rank.tier)" class="rank-badge-sparkles rank-badge-sparkles-secondary" aria-hidden="true" />
                      <span v-if="entry.account.sixV6Rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] rank-badge-number rank-division-number">{{ entry.account.sixV6Rank.division }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="showNonRankColumns" class="values-a-column h-full px-2.5" @pointerdown.stop>
                  <div class="values-a-lane values-lane-body">
                    <span v-for="(value, valueIndex) in entry.account.valuesA" :key="`${entry.account.id}-a-${valueIndex}`" class="flex h-full w-full items-center justify-center text-[15px] font-semibold text-slate-100/95">
                      <input v-if="isEditingValue(entry.account.id, 'valuesA', valueIndex)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="number" class="h-full w-full border-b border-slate-400/80 bg-transparent px-1 pb-0.5 text-center text-[20px] font-semibold leading-none tabular-nums text-slate-100 outline-none" @blur="commitActiveEditor" @pointerdown.stop @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                      <span v-else class="inline-flex h-full w-full items-center justify-center px-1 text-[20px] font-semibold leading-none tabular-nums" @pointerdown.stop @click.stop="beginValueEdit(entry.account.id, 'valuesA', valueIndex)">{{ formatCompactValue(value) }}</span>
                    </span>
                  </div>
                </div>
                <div v-if="showNonRankColumns" class="values-b-column h-full px-2.5" @pointerdown.stop>
                  <div class="values-b-lane values-lane-body">
                    <span v-for="(value, valueIndex) in entry.account.valuesB" :key="`${entry.account.id}-b-${valueIndex}`" class="flex h-full w-full min-w-0 items-center justify-center text-[15px] font-semibold text-slate-100/95">
                      <input v-if="isEditingValue(entry.account.id, 'valuesB', valueIndex)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="number" class="h-full w-full min-w-0 border-b border-slate-400/80 bg-transparent px-1 pb-0.5 text-center text-[20px] font-semibold leading-none tabular-nums text-slate-100 outline-none" @blur="commitActiveEditor" @pointerdown.stop @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                      <span v-else class="inline-flex h-full w-full items-center justify-center px-1 text-[20px] font-semibold leading-none tabular-nums" @pointerdown.stop @click.stop="beginValueEdit(entry.account.id, 'valuesB', valueIndex)">{{ formatCompactValue(value) }}</span>
                    </span>
                  </div>
                </div>
                </div>
              </div>
              </article>
              </template>

              <div class="bar-shell relative h-16" :style="{ width: fullGridWidth }">
                <div class="row-main-shell absolute inset-y-0 z-[1]" :style="{ left: rowMainOffset, width: rowMainWidth }">
                  <button type="button" class="relative h-full w-full rounded-[8px] border border-dashed border-[#323744] bg-transparent text-[16px] font-semibold tracking-tight text-slate-100/70 hover:border-slate-500 hover:bg-[#11141b]/80 hover:text-slate-100/90" @click="addRow">
                    <span class="absolute inset-y-0 left-0 flex items-center px-5">
                      + Add New Account
                    </span>
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>

        </div>
      </div>
    </main>

    <RankDbNotifications :notifications="notifications" @remove="removeNotification" />

    <div
      v-if="createGroupModalOpen"
      class="fixed inset-0 z-40 bg-black/55"
      @click="closeCreateGroupModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">{{ groupModalMode === 'edit' ? 'Edit Group' : 'New Group' }}</h2>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close create group"
            @click="closeCreateGroupModal"
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
        <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Name</label>
        <input
          v-model="createGroupNameDraft"
          type="text"
          :maxlength="maxGroupNameLength"
          class="mt-2 h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
          placeholder="Smurfs, Sales, Ranked Ready..."
          @keydown.enter.prevent="createGroup"
        >
        <p class="mt-2 text-[12px] leading-5 text-slate-400/80">
          {{ groupModalMode === 'edit' ? 'Rename the group without changing its accounts or position.' : 'This creates a collapsible full-width section without changing the row layout.' }}
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeCreateGroupModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!normalizeGroupName(createGroupNameDraft)"
            @click="createGroup"
          >
            {{ groupModalMode === 'edit' ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="settingsMenuOpen"
      class="fixed inset-0 z-[54] bg-black/55"
      @pointerdown.self="closeSettingsMenu"
      @click.self="closeSettingsMenu"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @pointerdown.stop
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
          <span class="flex items-center gap-2.5 tracking-tight">
            <img :src="overwatchCoinsIcon" alt="" class="-ml-[4px] h-[29px] w-[29px] object-contain" aria-hidden="true">
            <span>Currency</span>
          </span>
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
          <span class="flex items-center gap-2.5 tracking-tight">
            <img :src="flexRoleIcon" alt="" class="h-[23px] w-[23px] object-contain" aria-hidden="true">
            <span>6v6 Ranks</span>
          </span>
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

        <button
          type="button"
          class="mt-3 inline-flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[13px] font-semibold text-slate-100/95 hover:bg-[#181c26]"
          @click="badgeAnimationsEnabled = !badgeAnimationsEnabled"
        >
          <span class="flex items-center gap-2.5 tracking-tight">
            <img :src="championModalIcon" alt="" class="h-[23px] w-[23px] object-contain" aria-hidden="true">
            <span>Rank Badge Animations</span>
          </span>
          <span
            class="inline-flex h-5 w-10 items-center rounded-full p-0.5 transition"
            :class="badgeAnimationsEnabled ? 'bg-cyan-500/80' : 'bg-slate-600/80'"
          >
            <span
              class="h-4 w-4 rounded-full bg-white transition"
              :class="badgeAnimationsEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </span>
        </button>

        <div class="mt-4 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-3">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-slate-100/95">
              <ZoomIn class="h-[16px] w-[16px] shrink-0 text-slate-300/85" :stroke-width="2.2" aria-hidden="true" />
              <span>UI Zoom</span>
            </span>
            <span class="text-[12px] font-semibold tabular-nums text-slate-300/90">{{ uiZoom }}%</span>
          </div>
          <input
            v-model.number="uiZoom"
            @input="handleUiZoomInput"
            type="range"
            min="80"
            max="120"
            step="5"
            class="w-full accent-cyan-400"
          >
        </div>

        <div class="mt-3 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-3">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-slate-100/95">
              <ClipboardClock class="h-[16px] w-[16px] shrink-0 text-slate-300/85" :stroke-width="2.2" aria-hidden="true" />
              <span>Automatically clear Clipboard after:</span>
            </span>
            <span class="text-[12px] font-semibold tabular-nums text-slate-300/90">{{ clipboardClearTimerLabel }}</span>
          </div>
          <input
            v-model.number="clipboardClearTimerSeconds"
            type="range"
            min="5"
            max="31"
            step="1"
            class="w-full accent-cyan-400"
          >
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[13px] font-semibold text-slate-100/95 hover:bg-[#181c26]"
            @click="exportData"
          >
            <Download class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
            Export Data
          </button>
          <button
            type="button"
            class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[13px] font-semibold text-slate-100/95 hover:bg-[#181c26]"
            @click="triggerImportData"
          >
            <Upload class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
            Import Data
          </button>
        </div>

        <button
          v-if="tauriDesktop"
          type="button"
          class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border px-3 text-[13px] font-semibold transition disabled:cursor-wait disabled:opacity-70"
          :class="hasPendingAppUpdate
            ? 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/18'
            : 'border-[#272b35] bg-[#11141b] text-slate-100/95 hover:bg-[#181c26]'"
          :disabled="updateCheckBusy"
          @click="handleUpdateButtonClick"
        >
          <span
            class="h-2.5 w-2.5 rounded-full"
            :class="hasPendingAppUpdate ? 'bg-fuchsia-300/90 shadow-[0_0_14px_rgba(244,114,182,0.7)]' : 'bg-slate-400/75'"
            aria-hidden="true"
          />
          {{ updateCheckBusy ? 'Checking for Updates...' : hasPendingAppUpdate ? 'Update Available' : 'Check for Updates' }}
        </button>

        <input
          ref="importFileInput"
          type="file"
          accept=".rankdb-export"
          class="hidden"
          @change="handleImportData"
        >

        <div class="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500/55">
          {{ settingsFooterLabel }}
        </div>
      </div>
    </div>

    <div
      v-if="backupTransferModalMode"
      class="fixed inset-0 z-[55] bg-black/60"
      @click="closeBackupTransferModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[420px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#323744] bg-[#0c1018] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.58)]"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-[18px] font-semibold tracking-tight text-slate-100">
            {{ backupTransferModalMode === 'export' ? 'Encrypt Export File' : 'Import Encrypted Backup' }}
          </h2>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close backup transfer modal"
            @click="closeBackupTransferModal"
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

        <p class="mt-2 text-[13px] leading-5 text-slate-300/85">
          {{ backupTransferModalMode === 'export'
            ? 'Set a password for this backup file. You will need the same password to import it on another PC.'
            : `Enter the password for ${backupTransferFileName || 'this backup file'} to restore your accounts.` }}
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Backup Password</label>
            <input
              v-model="backupTransferPassword"
              type="password"
              class="mt-2 h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
              :placeholder="backupTransferModalMode === 'export' ? 'Set backup password' : 'Enter backup password'"
              @keydown.enter.prevent="submitBackupTransfer"
            >
          </div>

          <div v-if="backupTransferModalMode === 'export'">
            <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">Confirm Password</label>
            <input
              v-model="backupTransferPasswordConfirm"
              type="password"
              class="mt-2 h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
              placeholder="Confirm backup password"
              @keydown.enter.prevent="submitBackupTransfer"
            >
          </div>

          <p v-if="backupTransferError" class="rounded-[8px] border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[12px] leading-5 text-rose-100/90">
            {{ backupTransferError }}
          </p>

          <button
            type="button"
            class="inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="backupTransferBusy"
            @click="submitBackupTransfer"
          >
            {{ backupTransferBusy ? (backupTransferModalMode === 'export' ? 'Encrypting...' : 'Importing...') : (backupTransferModalMode === 'export' ? 'Download Encrypted Backup' : 'Import Backup') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="updateModalOpen && availableAppUpdate"
      class="fixed inset-0 z-[56] bg-black/60"
      @click="closeUpdateModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[360px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Update Available</h2>
        <p class="mt-3 text-[13px] leading-5 text-slate-300">
          Latest version:
          <span class="font-semibold text-slate-100">{{ availableAppUpdate.version }}</span>
        </p>

        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeUpdateModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-wait disabled:opacity-70"
            :disabled="updateInstallBusy"
            @click="installAvailableUpdate"
          >
            {{ updateInstallBusy ? 'Installing...' : 'Update Now' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="whatsNewModalOpen"
      class="fixed inset-0 z-[57] bg-black/60"
      @click="closeWhatsNewModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[500px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#323744] bg-[#0c1018] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.58)]"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-[18px] font-semibold tracking-tight text-slate-100">What&apos;s New</h2>
            <p class="mt-1 text-[13px] text-slate-300/85">New in {{ appVersionLabel }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close what's new modal"
            @click="closeWhatsNewModal"
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

        <div class="mt-4 space-y-3">
          <div
            v-for="item in whatsNewItems"
            :key="item.title"
            class="rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 py-3"
          >
            <div class="text-[14px] font-semibold text-slate-100">{{ item.title }}</div>
            <p class="mt-1 text-[13px] leading-6 text-slate-300/90">{{ item.description }}</p>
          </div>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeWhatsNewModal"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="updateRestartModalOpen"
      class="fixed inset-0 z-[58] bg-black/60"
      @click="closeUpdateRestartModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[360px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Restart Required</h2>
        <p class="mt-3 text-[13px] leading-5 text-slate-300">
          The update has been installed. Fully restart RankDB to finish applying the new version.
        </p>

        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeUpdateRestartModal"
          >
            Later
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25"
            @click="restartAfterUpdate"
          >
            Restart Now
          </button>
        </div>
      </div>
    </div>

    <RankDbRankPicker
      :divisions="divisions"
      :get-modal-option-opacity-class="getModalOptionOpacityClass"
      :is-modal-option-selected="isModalOptionSelected"
      :modal-options="modalOptions"
      :model-value="Boolean(rankPicker)"
      :picker-division="pickerDivision"
      :position-style="rankPickerPositionStyle"
      @apply="applyRankPicker"
      @close="closeRankPicker"
      @select-option="selectModalOption"
      @update:picker-division="pickerDivision = $event"
    />

    <RankDbAccountContextMenu
      :account-id="accountContextMenu?.accountId ?? null"
      :last-rank-modified-label="accountContextMenuLastRankModifiedLabel"
      :position-style="accountContextMenuPositionStyle"
      :rank-refresh-busy="rankRefreshBusy"
      @account-info="requestAccountInfo"
      @close="closeAccountContextMenu"
      @delete-account="requestDeleteAccount"
      @edit-battletag="requestEditBattletag"
      @edit-credentials="requestEditCredentials"
      @refresh-rank="refreshSingleAccountRank"
    />

    <RankDbDeleteModal
      :account-id="deleteAccountModal?.accountId ?? null"
      :account-name="deleteAccountModal ? getAccountNameForDisplay(deleteAccountModal.accountId) : ''"
      @close="closeDeleteAccountModal"
      @confirm="confirmDeleteAccount"
    />

    <RankDbCredentialsModal
      :account-id="credentialsModal?.accountId ?? null"
      :account-name="credentialsModal ? getAccountNameForDisplay(credentialsModal.accountId) : ''"
      :email-draft="credentialsEmailDraft"
      :email-visible="credentialsEmailVisible"
      :password-draft="credentialsPasswordDraft"
      :password-visible="credentialsPasswordVisible"
      @close="closeCredentialsModal"
      @save="saveCredentials"
      @toggle-email-visibility="credentialsEmailVisible = !credentialsEmailVisible"
      @toggle-password-visibility="credentialsPasswordVisible = !credentialsPasswordVisible"
      @update:email-draft="credentialsEmailDraft = $event"
      @update:password-draft="credentialsPasswordDraft = $event"
    />

    <RankDbAccountInfoModal
      :account-id="accountInfoModal?.accountId ?? null"
      :account-name="accountInfoModal ? accounts.find((entry) => entry.id === accountInfoModal.accountId)?.accountName ?? 'Battletag' : ''"
      :banned-draft="accountInfoBannedDraft"
      :country-draft="accountInfoCountryDraft"
      :country-options="accountCountryOptions"
      :get-country-option="getCountryOption"
      :get-flag-class="getFlagClass"
      :notes-draft="accountInfoNotesDraft"
      @close="closeAccountInfoModal"
      @save="saveAccountInfo"
      @toggle-banned="accountInfoBannedDraft = !accountInfoBannedDraft"
      @update:country-draft="accountInfoCountryDraft = $event"
      @update:notes-draft="accountInfoNotesDraft = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { clear as clearNativeClipboard, readText as readNativeClipboardText, writeText as writeNativeClipboardText } from '@tauri-apps/plugin-clipboard-manager'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { relaunch } from '@tauri-apps/plugin-process'
import { check as checkForUpdate } from '@tauri-apps/plugin-updater'
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronDown, ClipboardClock, Download, KeyRound, Upload, User, ZoomIn } from 'lucide-vue-next'
import 'flag-icons/css/flag-icons.min.css'
import RankDbAccountContextMenu from '~~/app/components/rankdb/RankDbAccountContextMenu.vue'
import RankDbAccountInfoModal from '~~/app/components/rankdb/RankDbAccountInfoModal.vue'
import RankDbCredentialsModal from '~~/app/components/rankdb/RankDbCredentialsModal.vue'
import RankDbDeleteModal from '~~/app/components/rankdb/RankDbDeleteModal.vue'
import RankDbHeader from '~~/app/components/rankdb/RankDbHeader.vue'
import RankDbNotifications from '~~/app/components/rankdb/RankDbNotifications.vue'
import RankDbRankPicker from '~~/app/components/rankdb/RankDbRankPicker.vue'
import tauriConfig from '~~/src-tauri/tauri.conf.json'
import {
  BASE_MIN_WINDOW_WIDTH,
  DEFAULT_CLIPBOARD_CLEAR_SECONDS,
  DEFAULT_RANK_NUMBER_FONT_SIZE,
  DEFAULT_RANK_NUMBER_OFFSET_X,
  DEFAULT_RANK_NUMBER_OFFSET_Y,
  DEFAULT_ROW_COUNT,
  DEFAULT_UI_ZOOM,
  INFINITE_CLIPBOARD_CLEAR_SECONDS,
  LEGACY_UI_SETTINGS_KEY,
  MAX_CLIPBOARD_CLEAR_SECONDS,
  MAX_RANK_NUMBER_FONT_SIZE,
  MAX_RANK_NUMBER_OFFSET,
  MAX_UI_ZOOM,
  MIN_CLIPBOARD_CLEAR_SECONDS,
  MIN_RANK_NUMBER_FONT_SIZE,
  MIN_RANK_NUMBER_OFFSET,
  MIN_UI_ZOOM,
  STORAGE_KEY,
  TAURI_WINDOW_STATE_KEY,
  UI_SETTINGS_KEY,
  UI_ZOOM_STEP,
  accountCountryOptions,
  assetWarmupSources,
  battlenetIcon,
  championModalIcon,
  competetivePointsIcon,
  damageRoleIcon,
  divisions,
  emptyDivision,
  emptyRankTier,
  emptyValuesA,
  emptyValuesB,
  flexRoleIcon,
  legacyPointsIcon,
  modalOptions,
  mythicPrismsIcon,
  overwatchCoinsIcon,
  overwatchCreditsIcon,
  overwatchIcon,
  rankIcons,
  rankTiers,
  roleTemplate,
  supportRoleIcon,
  tankRoleIcon
} from '~~/app/constants/rankdb'
import type {
  AccountRow,
  CountryOption,
  EditableField,
  ModalOption,
  NotificationToast,
  AccountGroup,
  RankEntry,
  RankTier,
  RoleSortState
} from '~~/app/types/rankdb'

type AppUpdate = NonNullable<Awaited<ReturnType<typeof checkForUpdate>>>
type PersistedAppStoragePayload = {
  accounts?: unknown
  groups?: unknown
  uiSettings?: unknown
}
type PersistedAppStorageEnvelope = {
  format: string
  schemaVersion: number
  payload: PersistedAppStoragePayload
}

useHead({
  link: [
    ...assetWarmupSources.slice(0, 10).map((href) => ({ rel: 'preload', href, as: 'image' as const }))
  ]
})

const tauriDesktop = import.meta.client && isTauri()
const APP_STORAGE_FORMAT = 'rankdb-app-state'
const APP_STORAGE_SCHEMA_VERSION = 1
const WHATS_NEW_VERSION_KEY = 'rankdb_last_seen_version_v1'
const CURRENT_WHATS_NEW_VERSION = `v${tauriConfig.version}`
const WHATS_NEW_ITEMS_BY_VERSION: Record<string, Array<{ title: string; description: string }>> = {
  [CURRENT_WHATS_NEW_VERSION]: [
    {
      title: 'Role Header Sorting',
      description: 'Clicking a role icon in the header now correctly sorts accounts by the selected rank again instead of leaving the visible order unchanged.'
    },
    {
      title: 'Settings Modal Focus',
      description: 'The settings modal now fully blocks clicks and slider drags from interacting with rows and controls behind it.'
    },
    {
      title: 'Rank Edit History',
      description: 'Account right-click menus now show the last rank edit date, and RankDB tracks it whenever a role or 6v6 rank is changed.'
    }
  ]
}
const rankPicker = ref<{ accountId: number; target: 'role' | 'sixv6'; rankIndex?: number } | null>(null)
const settingsMenuOpen = ref(false)
const createGroupModalOpen = ref(false)
const groupActionMenu = ref<{ groupId: string } | null>(null)
const groupActionMenuPositionStyle = ref<Record<string, string>>({})
const accountContextMenu = ref<{ accountId: number } | null>(null)
const accountContextMenuPositionStyle = ref<Record<string, string>>({})
const deleteAccountModal = ref<{ accountId: number } | null>(null)
const credentialsModal = ref<{ accountId: number } | null>(null)
const accountInfoModal = ref<{ accountId: number } | null>(null)
const credentialsEmailDraft = ref('')
const credentialsPasswordDraft = ref('')
const credentialsEmailVisible = ref(false)
const credentialsPasswordVisible = ref(false)
const accountInfoCountryDraft = ref('')
const accountInfoBannedDraft = ref(false)
const accountInfoNotesDraft = ref('')
const createGroupNameDraft = ref('')
const groupModalMode = ref<'create' | 'edit'>('create')
const editingGroupId = ref('')
const notifications = ref<NotificationToast[]>([])
const rankRefreshBusy = ref(false)
const storageAccessMode = ref<'ready'>('ready')
const backupTransferModalMode = ref<'export' | 'import' | null>(null)
const backupTransferPassword = ref('')
const backupTransferPasswordConfirm = ref('')
const backupTransferBusy = ref(false)
const backupTransferError = ref('')
const backupTransferFileName = ref('')
const updateCheckBusy = ref(false)
const updateInstallBusy = ref(false)
const updateModalOpen = ref(false)
const updateRestartModalOpen = ref(false)
const availableAppUpdate = shallowRef<AppUpdate | null>(null)
const appVersionLabel = ref('v0.1.0')
const whatsNewModalOpen = ref(false)
const activeEditor = ref<EditableField | null>(null)
const activeEditorValue = ref('')
const draggedAccountId = ref<number | null>(null)
const draggedGroupEntryKey = ref<string | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
let pendingImportFile: File | null = null
const pointerDrag = ref<{
  accountId: number
  pointerId: number
  startY: number
  currentY: number
  height: number
  anchorOffsetY: number
  clonePointerOffsetY: number
} | null>(null)
const groupPointerDrag = ref<{
  groupId: string
  entryKey: string
  section: 'normal' | 'banned'
  pointerId: number
  startY: number
  currentY: number
  height: number
  anchorOffsetY: number
  clonePointerOffsetY: number
  sourceRect: DOMRect
} | null>(null)
const dragLayout = ref<Array<{ accountId: number; top: number; height: number }>>([])
const groupDragLayout = ref<Array<{
  entryKey: string
  groupId: string
  section: 'normal' | 'banned'
  targetKind: 'group' | 'account'
  accountId: number | null
  top: number
  height: number
}>>([])
let dragElements = new Map<number, HTMLElement>()
let groupDragElements = new Map<string, HTMLElement>()
let dragCloneElement: HTMLElement | null = null
let dragSourceElement: HTMLElement | null = null
let dragPointerElement: HTMLElement | null = null
let groupDragCloneElement: HTMLElement | null = null
let groupDragSourceElement: HTMLElement | null = null
let groupDragPointerElement: HTMLElement | null = null
let suppressGroupHeaderClickKey: string | null = null
let pendingPointerY: number | null = null
let pendingGroupPointerY: number | null = null
let pointerFrameId: number | null = null
let groupPointerFrameId: number | null = null
let nextNotificationId = 1
const notificationTimeouts = new Map<number, ReturnType<typeof setTimeout>>()
const clipboardExpiryTimeouts = new Map<'email' | 'password', ReturnType<typeof setTimeout>>()
const pickerTier = ref<RankTier>('Bronze')
const pickerDivision = ref<number>(1)
const pickerPredicted = ref(false)
const rankPickerPositionStyle = ref<Record<string, string>>({})
const maxGroupNameLength = 40
const buildGroupId = () => `group-${Math.random().toString(36).slice(2, 10)}`
const normalizeGroupName = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, maxGroupNameLength)
}
const normalizeStoredGroup = (value: unknown, fallbackIndex: number): AccountGroup | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as Record<string, unknown>
  const name = normalizeGroupName(payload.name)
  if (!name) {
    return null
  }

  const rawId = typeof payload.id === 'string' ? payload.id.trim() : ''
  const section = payload.section === 'banned' ? 'banned' : 'normal'
  const anchorAccountId = typeof payload.anchorAccountId === 'number' && Number.isFinite(payload.anchorAccountId)
    ? Math.trunc(payload.anchorAccountId)
    : null
  const anchorPosition = payload.anchorPosition === 'before' ? 'before' : 'after'
  return {
    id: rawId || `group-${fallbackIndex}`,
    name,
    collapsed: Boolean(payload.collapsed),
    section,
    anchorAccountId,
    anchorPosition
  }
}
const buildEmptyAccount = (id: number): AccountRow => ({
  id,
  accountName: 'Battletag#0000',
  email: '',
  password: '',
  lastRankModifiedAt: null,
  countryCode: '',
  groupId: null,
  isBanned: false,
  notes: '',
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
const getCountryOption = (countryCode: string) => accountCountryOptions.find((option) => option.code === countryCode.toUpperCase()) ?? null
const getFlagClass = (countryCode: string) => `fi fi-${countryCode.trim().toLowerCase()}`

const normalizeTier = (value: unknown): RankTier => (
  rankTiers.includes(value as RankTier) ? value as RankTier : emptyRankTier
)

const normalizeApiRankTier = (value: unknown): RankTier => {
  if (typeof value !== 'string') {
    return emptyRankTier
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[\s_-]+/g, '')
  switch (normalizedValue) {
    case 'bronze':
      return 'Bronze'
    case 'silver':
      return 'Silver'
    case 'gold':
      return 'Gold'
    case 'platinum':
      return 'Platinum'
    case 'diamond':
      return 'Diamond'
    case 'master':
      return 'Master'
    case 'grandmaster':
      return 'Grandmaster'
    case 'champion':
    case 'ultimate':
      return 'Champion'
    case 'unranked':
      return 'Unranked'
    default:
      return emptyRankTier
  }
}

const normalizeApiDivision = (value: unknown) => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toUpperCase()
    if (normalizedValue === 'I') {
      return 1
    }
    if (normalizedValue === 'II') {
      return 2
    }
    if (normalizedValue === 'III') {
      return 3
    }
    if (normalizedValue === 'IV') {
      return 4
    }
    if (normalizedValue === 'V') {
      return 5
    }
  }

  return normalizeDivision(value)
}

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

const normalizeLegacyUiZoom = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_UI_ZOOM
  }

  return normalizeUiZoom(numberValue * 1.25)
}

const normalizeClipboardClearTimer = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return MIN_CLIPBOARD_CLEAR_SECONDS
  }

  const roundedValue = Math.round(numberValue)
  if (roundedValue >= INFINITE_CLIPBOARD_CLEAR_SECONDS) {
    return INFINITE_CLIPBOARD_CLEAR_SECONDS
  }

  return Math.min(MAX_CLIPBOARD_CLEAR_SECONDS, Math.max(MIN_CLIPBOARD_CLEAR_SECONDS, roundedValue))
}

const normalizeRankNumberOffset = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return 0
  }

  const roundedValue = Math.round(numberValue * 2) / 2
  return Math.min(MAX_RANK_NUMBER_OFFSET, Math.max(MIN_RANK_NUMBER_OFFSET, roundedValue))
}

const normalizeRankNumberFontSize = (value: unknown) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_RANK_NUMBER_FONT_SIZE
  }

  const roundedValue = Math.round(numberValue * 2) / 2
  return Math.min(MAX_RANK_NUMBER_FONT_SIZE, Math.max(MIN_RANK_NUMBER_FONT_SIZE, roundedValue))
}

type OwApiProfilePayload = {
  private?: unknown
  ratings?: unknown
}

type OwApiProfileResponse = {
  status: number
  content_type?: string | null
  body_text: string
}

type OwApiProfileFetchResult =
  | {
    kind: 'success'
    payload: OwApiProfilePayload
  }
  | {
    kind: 'not_found' | 'private' | 'unavailable'
    message: string
    status: number
  }

const OWAPI_PROFILE_BASE_URL = 'https://www.owapi.eu/stats'
const OWAPI_ROLE_KEYS = {
  T: ['tank'],
  D: ['damage', 'dps', 'offense'],
  S: ['support', 'healer', 'heal']
} as const

const buildOwApiPlayerId = (accountName: string) => {
  const trimmedAccountName = accountName.trim()
  if (!trimmedAccountName || !trimmedAccountName.includes('#')) {
    return null
  }

  return encodeURIComponent(trimmedAccountName.replace('#', '-'))
}

const buildOwApiHeaders = () => ({
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
})

const buildDefaultUiSettings = () => ({
  showSixV6: true,
  showNonRankColumns: true,
  showLeadButtons: true,
  badgeAnimationsEnabled: true,
  uiZoom: DEFAULT_UI_ZOOM,
  clipboardClearTimerSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS,
  rankNumberOffsetX: DEFAULT_RANK_NUMBER_OFFSET_X,
  rankNumberOffsetY: DEFAULT_RANK_NUMBER_OFFSET_Y,
  rankNumberFontSize: DEFAULT_RANK_NUMBER_FONT_SIZE
})

const getOwApiRatings = (payload: OwApiProfilePayload) => (
  Array.isArray(payload.ratings) ? payload.ratings : []
)

const getOwApiVisibleRank = (
  ratingsPayload: unknown[],
  keys: readonly string[]
) => {
  for (const entry of ratingsPayload) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const payload = entry as Record<string, unknown>
    const roleValue = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : ''
    if (!keys.includes(roleValue)) {
      continue
    }

    const tier = normalizeApiRankTier(
      typeof payload.group === 'string'
        ? payload.group
        : typeof payload.rank === 'string'
          ? payload.rank
          : null
    )
    if (tier === 'Unranked') {
      continue
    }

    return {
      tier,
      division: normalizeApiDivision(payload.tier ?? payload.level)
    }
  }

  return null
}

const applyVisibleOrPredictedRank = (
  currentRank: RankEntry,
  visibleRank: { tier: RankTier; division: number } | null
) => {
  if (visibleRank) {
    currentRank.tier = visibleRank.tier
    currentRank.division = visibleRank.division
    currentRank.predicted = false
    return 'visible'
  }

  if (currentRank.predicted && currentRank.tier !== 'Unranked') {
    return 'predicted'
  }

  currentRank.tier = 'Unranked'
  currentRank.division = emptyDivision
  currentRank.predicted = false
  return 'empty'
}

const fetchOwApiProfile = async (playerId: string): Promise<OwApiProfileFetchResult> => {
  const parseResponsePayload = (payload: unknown, status: number): OwApiProfileFetchResult => {
    if (!payload || typeof payload !== 'object') {
      return {
        kind: 'unavailable',
        message: `OWAPI returned invalid JSON (${status}).`,
        status
      }
    }

    const profilePayload = payload as OwApiProfilePayload
    if (profilePayload.private === true) {
      return {
        kind: 'private',
        message: 'The Overwatch profile is private.',
        status
      }
    }

    return {
      kind: 'success',
      payload: profilePayload
    }
  }

  if (isTauri()) {
    const response = await invoke<OwApiProfileResponse>('fetch_owapi_profile', {
      platform: 'pc',
      playerId
    })

    if (response.status === 404) {
      return {
        kind: 'not_found',
        message: 'OWAPI could not match that Battletag.',
        status: response.status
      }
    }

    if (response.status < 200 || response.status >= 300) {
      return {
        kind: 'unavailable',
        message: `OWAPI returned ${response.status}.`,
        status: response.status
      }
    }

    return parseResponsePayload(JSON.parse(response.body_text), response.status)
  }

  const response = await fetch(`${OWAPI_PROFILE_BASE_URL}/pc/${playerId}/profile`, {
    headers: buildOwApiHeaders()
  })

  if (response.status === 404) {
    return {
      kind: 'not_found',
      message: 'OWAPI could not match that Battletag.',
      status: response.status
    }
  }

  if (!response.ok) {
    return {
      kind: 'unavailable',
      message: `OWAPI returned ${response.status}.`,
      status: response.status
    }
  }

  return parseResponsePayload(await response.json() as OwApiProfilePayload, response.status)
}

const loadStoredUiSettings = () => {
  if (!import.meta.client || tauriDesktop) {
    return buildDefaultUiSettings()
  }

  try {
    const rawSettings = localStorage.getItem(UI_SETTINGS_KEY)
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings)
      return {
        showSixV6: typeof parsed?.showSixV6 === 'boolean' ? parsed.showSixV6 : true,
        showNonRankColumns: typeof parsed?.showNonRankColumns === 'boolean' ? parsed.showNonRankColumns : true,
        showLeadButtons: typeof parsed?.showLeadButtons === 'boolean' ? parsed.showLeadButtons : true,
        badgeAnimationsEnabled: typeof parsed?.badgeAnimationsEnabled === 'boolean' ? parsed.badgeAnimationsEnabled : true,
        uiZoom: normalizeUiZoom(parsed?.uiZoom),
        clipboardClearTimerSeconds: normalizeClipboardClearTimer(parsed?.clipboardClearTimerSeconds),
        rankNumberOffsetX: normalizeRankNumberOffset(parsed?.rankNumberOffsetX),
        rankNumberOffsetY: normalizeRankNumberOffset(parsed?.rankNumberOffsetY),
        rankNumberFontSize: normalizeRankNumberFontSize(parsed?.rankNumberFontSize)
      }
    }

    const legacyRawSettings = localStorage.getItem(LEGACY_UI_SETTINGS_KEY)
    if (!legacyRawSettings) {
      return buildDefaultUiSettings()
    }

    const parsed = JSON.parse(legacyRawSettings)
    return {
      showSixV6: typeof parsed?.showSixV6 === 'boolean' ? parsed.showSixV6 : true,
      showNonRankColumns: typeof parsed?.showNonRankColumns === 'boolean' ? parsed.showNonRankColumns : true,
      showLeadButtons: true,
      badgeAnimationsEnabled: true,
      uiZoom: normalizeLegacyUiZoom(parsed?.uiZoom),
      clipboardClearTimerSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS,
      rankNumberOffsetX: DEFAULT_RANK_NUMBER_OFFSET_X,
      rankNumberOffsetY: DEFAULT_RANK_NUMBER_OFFSET_Y,
      rankNumberFontSize: DEFAULT_RANK_NUMBER_FONT_SIZE
    }
  } catch {
    return buildDefaultUiSettings()
  }
}

const removeNotification = (notificationId: number) => {
  notifications.value = notifications.value.filter((toast) => toast.id !== notificationId)
  const timeoutHandle = notificationTimeouts.get(notificationId)
  if (timeoutHandle) {
    clearTimeout(timeoutHandle)
    notificationTimeouts.delete(notificationId)
  }
}

const pushNotification = (
  title: string,
  options: { message?: string; kind?: NotificationToast['kind']; duration?: number; showTimer?: boolean } = {}
) => {
  const notificationId = nextNotificationId++
  const duration = options.duration ?? 2400
  const notification: NotificationToast = {
    id: notificationId,
    title,
    message: options.message,
    kind: options.kind ?? 'info',
    duration,
    showTimer: options.showTimer ?? false
  }

  notifications.value = [notification, ...notifications.value]

  if (duration <= 0) {
    return notificationId
  }

  const timeoutHandle = setTimeout(() => {
    removeNotification(notificationId)
  }, duration)

  notificationTimeouts.set(notificationId, timeoutHandle)
  return notificationId
}

const updateNotification = (
  notificationId: number,
  options: { title?: string; message?: string; kind?: NotificationToast['kind']; duration?: number; showTimer?: boolean }
) => {
  const notificationIndex = notifications.value.findIndex((toast) => toast.id === notificationId)
  if (notificationIndex === -1) {
    return
  }

  const existingTimeout = notificationTimeouts.get(notificationId)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    notificationTimeouts.delete(notificationId)
  }

  const currentNotification = notifications.value[notificationIndex]
  const nextDuration = options.duration ?? currentNotification.duration
  const nextNotification: NotificationToast = {
    ...currentNotification,
    title: options.title ?? currentNotification.title,
    message: options.message ?? currentNotification.message,
    kind: options.kind ?? currentNotification.kind,
    duration: nextDuration,
    showTimer: options.showTimer ?? currentNotification.showTimer
  }

  notifications.value.splice(notificationIndex, 1, nextNotification)

  if (nextDuration <= 0) {
    return
  }

  const timeoutHandle = setTimeout(() => {
    removeNotification(notificationId)
  }, nextDuration)

  notificationTimeouts.set(notificationId, timeoutHandle)
}

const writeClipboardText = async (value: string) => {
  if (import.meta.client && isTauri()) {
    await writeNativeClipboardText(value)
    return
  }

  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!copied) {
      throw new Error('Clipboard copy failed')
    }
  }
}

const readClipboardText = async () => {
  if (import.meta.client && isTauri()) {
    return readNativeClipboardText()
  }

  return navigator.clipboard.readText()
}

const clearClipboardText = async () => {
  if (import.meta.client && isTauri()) {
    await clearNativeClipboard()
    return
  }

  await navigator.clipboard.writeText('')
}

const loadPersistedAppStorage = async () => {
  if (!import.meta.client || !isTauri()) {
    return null
  }

  return invoke<unknown>('load_app_storage')
}

const savePersistedAppStorage = async () => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  await invoke('save_app_storage', {
    payload: buildPersistedAppStorageEnvelope({
      accounts: buildAccountsPayload(),
      groups: buildGroupsPayload(),
      uiSettings: buildUiSettingsPayload()
    })
  })
}

const ensurePersistedAppStorageReady = async () => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  await invoke('ensure_app_storage_ready')
}

const encryptPortableExportPayload = async (payload: Record<string, unknown>, password: string) => {
  if (!import.meta.client || !isTauri()) {
    throw new Error('Encrypted export is only available in the desktop app.')
  }

  return invoke<string>('encrypt_export_payload', { payload, password })
}

const decryptPortableExportPayload = async (encryptedExport: string, password: string) => {
  if (!import.meta.client || !isTauri()) {
    throw new Error('Encrypted import is only available in the desktop app.')
  }

  return invoke<unknown>('decrypt_export_payload', {
    encryptedExport,
    password
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const buildPersistedAppStorageEnvelope = (payload: PersistedAppStoragePayload): PersistedAppStorageEnvelope => ({
  format: APP_STORAGE_FORMAT,
  schemaVersion: APP_STORAGE_SCHEMA_VERSION,
  payload
})

const parsePersistedAppStorage = (value: unknown): { payload: PersistedAppStoragePayload | null; migratedLegacy: boolean } => {
  if (!isRecord(value)) {
    return { payload: null, migratedLegacy: false }
  }

  if ('format' in value || 'schemaVersion' in value || 'payload' in value) {
    const format = value.format
    const schemaVersion = value.schemaVersion
    const payload = value.payload

    if (format !== APP_STORAGE_FORMAT) {
      throw new Error('Unsupported local database format.')
    }

    if (schemaVersion !== APP_STORAGE_SCHEMA_VERSION) {
      throw new Error(`Unsupported local database schema v${String(schemaVersion)}.`)
    }

    if (!isRecord(payload)) {
      throw new Error('Stored local database payload is invalid.')
    }

    return {
      payload: {
        accounts: payload.accounts,
        groups: payload.groups,
        uiSettings: payload.uiSettings
      },
      migratedLegacy: false
    }
  }

  return {
    payload: {
      accounts: value.accounts,
      groups: value.groups,
      uiSettings: value.uiSettings
    },
    migratedLegacy: true
  }
}

const getClipboardClearDurationMs = () => {
  if (clipboardClearTimerSeconds.value >= INFINITE_CLIPBOARD_CLEAR_SECONDS) {
    return null
  }

  return clipboardClearTimerSeconds.value * 1000
}

const formatCompactValue = (value: number) => {
  const absoluteValue = Math.abs(value)
  const compactUnits = [
    { limit: 1_000_000, suffix: 'm' },
    { limit: 1_000, suffix: 'k' }
  ] as const

  for (const unit of compactUnits) {
    if (absoluteValue >= unit.limit) {
      const shortened = value / unit.limit
      const formatted = Number.isInteger(shortened)
        ? String(shortened)
        : shortened.toFixed(1).replace(/\.0$/, '')

      return `${formatted}${unit.suffix}`
    }
  }

  return String(value)
}

const scheduleClipboardExpiry = (field: 'email' | 'password', value: string) => {
  const existingTimeout = clipboardExpiryTimeouts.get(field)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    clipboardExpiryTimeouts.delete(field)
  }

  const clearDurationMs = getClipboardClearDurationMs()
  if (clearDurationMs === null) {
    return
  }

  const timeoutHandle = setTimeout(async () => {
    try {
      const currentClipboard = await readClipboardText()
      if (currentClipboard === value) {
        await clearClipboardText()
        setTimeout(() => {
          pushNotification(`${field === 'email' ? 'Email' : 'Password'} cleared`, {
            message: `Clipboard entry expired after ${clipboardClearTimerSeconds.value} seconds.`,
            kind: 'info',
            duration: 3000
          })
        }, 220)
      }
    } catch {
      // Ignore clipboard permission failures for the expiry cleanup.
    } finally {
      clipboardExpiryTimeouts.delete(field)
    }
  }, clearDurationMs)

  clipboardExpiryTimeouts.set(field, timeoutHandle)
}

const normalizeStoredAccount = (fromStorage: any, fallbackId: number): AccountRow => {
  const emptyAccount = buildEmptyAccount(fallbackId)
  const fromStorageRanks = Array.isArray(fromStorage?.ranks) ? fromStorage.ranks : []
  const fromStorageValuesA = Array.isArray(fromStorage?.valuesA) ? fromStorage.valuesA : []
  const fromStorageValuesB = Array.isArray(fromStorage?.valuesB) ? fromStorage.valuesB : []
  const fromStorageSixV6 = (fromStorage?.sixV6Rank && typeof fromStorage.sixV6Rank === 'object') ? fromStorage.sixV6Rank : null
  const lastRankModifiedAt = typeof fromStorage?.lastRankModifiedAt === 'string' && !Number.isNaN(Date.parse(fromStorage.lastRankModifiedAt))
    ? fromStorage.lastRankModifiedAt
    : null

  return {
    ...emptyAccount,
    id: Number.isFinite(Number(fromStorage?.id)) ? Number(fromStorage.id) : fallbackId,
    accountName: typeof fromStorage?.accountName === 'string' ? fromStorage.accountName : emptyAccount.accountName,
    email: typeof fromStorage?.email === 'string' ? fromStorage.email : emptyAccount.email,
    password: typeof fromStorage?.password === 'string' ? fromStorage.password : emptyAccount.password,
    lastRankModifiedAt,
    countryCode: typeof fromStorage?.countryCode === 'string' ? fromStorage.countryCode.toUpperCase() : emptyAccount.countryCode,
    groupId: typeof fromStorage?.groupId === 'string' && fromStorage.groupId.trim() ? fromStorage.groupId.trim() : null,
    isBanned: Boolean(fromStorage?.isBanned ?? fromStorage?.banned),
    notes: typeof fromStorage?.notes === 'string' ? fromStorage.notes : emptyAccount.notes,
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
  if (!import.meta.client || tauriDesktop) {
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

const loadStoredGroups = (storedAccounts: AccountRow[]) => {
  if (!import.meta.client || tauriDesktop) {
    return [] as AccountGroup[]
  }

  const raw = localStorage.getItem(UI_SETTINGS_KEY)
  if (!raw) {
    return [] as AccountGroup[]
  }

  try {
    const parsed = JSON.parse(raw)
    const storedGroups = Array.isArray(parsed?.groups) ? parsed.groups : []
    const normalizedGroups = storedGroups
      .map((entry: unknown, idx: number) => normalizeStoredGroup(entry, idx + 1))
      .filter((entry): entry is AccountGroup => Boolean(entry))

    const validGroupIds = new Set(normalizedGroups.map((group) => group.id))
    for (const account of storedAccounts) {
      if (account.groupId && !validGroupIds.has(account.groupId)) {
        account.groupId = null
      }
    }

    return normalizedGroups
  } catch {
    return [] as AccountGroup[]
  }
}

const clearLegacyBrowserStorage = () => {
  if (!import.meta.client) {
    return
  }

  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(UI_SETTINGS_KEY)
  localStorage.removeItem(LEGACY_UI_SETTINGS_KEY)
}

const initialUiSettings = loadStoredUiSettings()
const showSixV6 = ref(initialUiSettings.showSixV6)
const showNonRankColumns = ref(initialUiSettings.showNonRankColumns)
const showLeadButtons = ref(initialUiSettings.showLeadButtons)
const badgeAnimationsEnabled = ref(initialUiSettings.badgeAnimationsEnabled)
const uiZoom = ref(initialUiSettings.uiZoom)
const clipboardClearTimerSeconds = ref(initialUiSettings.clipboardClearTimerSeconds)
const rankNumberOffsetX = ref(initialUiSettings.rankNumberOffsetX)
const rankNumberOffsetY = ref(initialUiSettings.rankNumberOffsetY)
const rankNumberFontSize = ref(initialUiSettings.rankNumberFontSize)
const leadColumnWidth = 96
const nameColumnWidth = 250
const roleColumnWidth = 390
const sixV6ColumnWidth = 130
const valuesAColumnWidth = 210
const valuesBColumnWidth = 138
const columnGapWidth = 12
const hiddenLeadOffset = leadColumnWidth + columnGapWidth
const rowColumns = computed(() => {
  const columns: number[] = [leadColumnWidth, nameColumnWidth, roleColumnWidth]
  if (showSixV6.value) {
    columns.push(sixV6ColumnWidth)
  }
  if (showNonRankColumns.value) {
    columns.push(valuesAColumnWidth, valuesBColumnWidth)
  }
  return columns.map((value) => `${value}px`).join(' ')
})
const mainColumns = computed(() => {
  const columns: number[] = [nameColumnWidth, roleColumnWidth]
  if (showSixV6.value) {
    columns.push(sixV6ColumnWidth)
  }
  if (showNonRankColumns.value) {
    columns.push(valuesAColumnWidth, valuesBColumnWidth)
  }
  return columns.map((value) => `${value}px`).join(' ')
})
const fullGridWidth = computed(() => {
  const columns = rowColumns.value.split(' ').map((value) => Number.parseInt(value, 10))
  const columnTotal = columns.reduce((sum, value) => sum + value, 0)
  const gaps = Math.max(columns.length - 1, 0) * columnGapWidth
  return `${columnTotal + gaps}px`
})
const rowVisibleWidth = computed(() => {
  const fullWidth = Number.parseInt(fullGridWidth.value, 10)
  const hiddenOffset = showLeadButtons.value ? 0 : hiddenLeadOffset
  return `${fullWidth - hiddenOffset}px`
})
const visibleGridWidth = computed(() => rowVisibleWidth.value)
const contentTranslateX = computed(() => (showLeadButtons.value ? '0px' : `-${hiddenLeadOffset}px`))
const topBarWidth = computed(() => `${nameColumnWidth + (showLeadButtons.value ? leadColumnWidth + columnGapWidth : 0)}px`)
const topBarOffsetX = computed(() => (showLeadButtons.value ? '0px' : `${hiddenLeadOffset}px`))
const rowMainOffset = computed(() => (showLeadButtons.value ? `${hiddenLeadOffset}px` : '0px'))
const rowMainWidth = computed(() => {
  const visibleWidth = Number.parseInt(rowVisibleWidth.value, 10)
  const mainOffset = showLeadButtons.value ? hiddenLeadOffset : 0
  return `${visibleWidth - mainOffset}px`
})
const mainPrimarySectionWidth = computed(() => `${nameColumnWidth + roleColumnWidth + columnGapWidth}px`)
const mainSixV6SectionLeft = computed(() => `${nameColumnWidth + roleColumnWidth + (columnGapWidth * 2)}px`)
const sixV6SectionWidth = computed(() => `${sixV6ColumnWidth}px`)
const mainCreditsSectionLeft = computed(() => {
  const offset = showSixV6.value
    ? nameColumnWidth + roleColumnWidth + sixV6ColumnWidth + (columnGapWidth * 3)
    : nameColumnWidth + roleColumnWidth + (columnGapWidth * 2)
  return `${offset}px`
})
const creditsSectionWidth = computed(() => {
  if (!showNonRankColumns.value) {
    return '0px'
  }

  const columns = [valuesAColumnWidth, valuesBColumnWidth]
  const columnTotal = columns.reduce((sum, value) => sum + value, 0)
  const gaps = columnGapWidth
  return `${columnTotal + gaps}px`
})
const clipboardClearTimerLabel = computed(() => (
  clipboardClearTimerSeconds.value >= INFINITE_CLIPBOARD_CLEAR_SECONDS
    ? 'Infinite'
    : `${clipboardClearTimerSeconds.value}s`
))
const appMainElement = ref<HTMLElement | null>(null)
const tauriResizeViewport = ref<HTMLElement | null>(null)
const accountListViewport = ref<HTMLElement | null>(null)
let tauriResizeTimeout: ReturnType<typeof setTimeout> | null = null
let tauriResizeObserver: ResizeObserver | null = null
let lastAppliedTauriWindowSize: { width: number; height: number } | null = null
let lastAppliedTauriMinWindowSize: { width: number; height: number } | null = null
let tauriResizeReady = false
let tauriResizeReadyTimeout: ReturnType<typeof setTimeout> | null = null
let assetWarmupPromise: Promise<void> | null = null
let appStoragePersistTimeout: ReturnType<typeof setTimeout> | null = null
const rankNumberPlatformOffsetX = import.meta.client && isTauri() ? -1 : 0
const rankNumberPlatformOffsetY = import.meta.client && isTauri() ? 1 : 0
const rankNumberPlatformFontAdjust = import.meta.client && isTauri() ? -1 : 0

const initialAccounts = loadStoredAccounts()
const accounts = ref<AccountRow[]>(initialAccounts)
const accountGroups = ref<AccountGroup[]>(loadStoredGroups(initialAccounts))
const activeRoleSort = ref<RoleSortState | null>(null)
const customAccountOrderIds = ref<number[]>(accounts.value.map((account) => account.id))
const normalAccounts = computed(() => accounts.value.filter((account) => !account.isBanned))
const bannedAccounts = computed(() => accounts.value.filter((account) => account.isBanned))
const lastNormalAccountId = computed(() => normalAccounts.value.at(-1)?.id ?? null)
const rankChangeDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})
const formatLastRankModifiedLabel = (value: string | null) => {
  if (!value) {
    return 'NEVER'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'NEVER'
  }

  return rankChangeDateFormatter.format(parsedDate)
}
const accountContextMenuLastRankModifiedLabel = computed(() => {
  const account = accounts.value.find((entry) => entry.id === accountContextMenu.value?.accountId)
  return formatLastRankModifiedLabel(account?.lastRankModifiedAt ?? null)
})

type RenderEntry =
  | { key: string; kind: 'group-block'; group: AccountGroup; isBanned: boolean; accountCount: number; accounts: AccountRow[] }
  | { key: string; kind: 'account'; account: AccountRow }
  | { key: string; kind: 'banned-divider' }

type SectionLayoutSlot =
  | { kind: 'ungrouped-slot' }
  | { kind: 'group'; groupId: string }

const sortableRoleHeaders = [
  { index: 0, label: 'Tank', icon: tankRoleIcon },
  { index: 1, label: 'Damage', icon: damageRoleIcon },
  { index: 2, label: 'Support', icon: supportRoleIcon }
] as const

const rankTierSortValue: Record<RankTier, number> = {
  Unranked: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Master: 6,
  Grandmaster: 7,
  Champion: 8
}

const syncCustomAccountOrderFromAccounts = () => {
  customAccountOrderIds.value = accounts.value.map((account) => account.id)
}

const getAccountCustomOrder = (sourceAccounts: AccountRow[]) => {
  const accountById = new Map(sourceAccounts.map((account) => [account.id, account] as const))
  const restoredAccounts = customAccountOrderIds.value
    .map((accountId) => accountById.get(accountId))
    .filter((account): account is AccountRow => Boolean(account))

  for (const account of sourceAccounts) {
    if (!customAccountOrderIds.value.includes(account.id)) {
      restoredAccounts.push(account)
    }
  }

  return restoredAccounts
}

const getCustomSectionedAccounts = (sourceAccounts: AccountRow[]) => {
  const customOrderedAccounts = getAccountCustomOrder(sourceAccounts)
  return [
    ...customOrderedAccounts.filter((account) => !account.isBanned),
    ...customOrderedAccounts.filter((account) => account.isBanned)
  ]
}

const getCurrentSectionedAccounts = (sourceAccounts: AccountRow[]) => [
  ...sourceAccounts.filter((account) => !account.isBanned),
  ...sourceAccounts.filter((account) => account.isBanned)
]

const buildSectionLayoutSlots = (sourceAccounts: AccountRow[], isBanned: boolean) => {
  const groupsById = new Map(accountGroups.value.map((group) => [group.id, group] as const))
  const customOrderedAccounts = getAccountCustomOrder(sourceAccounts)
  const slots: SectionLayoutSlot[] = []
  const seenGroupIds = new Set<string>()
  const section = isBanned ? 'banned' : 'normal'
  const sectionAccountIds = new Set(customOrderedAccounts.map((account) => account.id))
  const emptyGroupsBeforeAccount = new Map<number, string[]>()
  const emptyGroupsAfterAccount = new Map<number, string[]>()
  const trailingEmptyGroupIds: string[] = []

  for (const account of customOrderedAccounts) {
    const groupId = account.groupId
    if (groupId && groupsById.has(groupId)) {
      seenGroupIds.add(groupId)
    }
  }

  for (const group of accountGroups.value) {
    if (seenGroupIds.has(group.id) || group.section !== section) {
      continue
    }

    if (group.anchorAccountId !== null && sectionAccountIds.has(group.anchorAccountId)) {
      const targetBucket = group.anchorPosition === 'before' ? emptyGroupsBeforeAccount : emptyGroupsAfterAccount
      const existingGroupIds = targetBucket.get(group.anchorAccountId) ?? []
      existingGroupIds.push(group.id)
      targetBucket.set(group.anchorAccountId, existingGroupIds)
      continue
    }

    trailingEmptyGroupIds.push(group.id)
  }

  for (const account of customOrderedAccounts) {
    const groupsBeforeAccount = emptyGroupsBeforeAccount.get(account.id) ?? []
    for (const groupId of groupsBeforeAccount) {
      slots.push({ kind: 'group', groupId })
    }

    const groupId = account.groupId
    if (!groupId || !groupsById.has(groupId)) {
      slots.push({ kind: 'ungrouped-slot' })
    } else if (!slots.some((slot) => slot.kind === 'group' && slot.groupId === groupId)) {
      slots.push({ kind: 'group', groupId })
    }

    const groupsAfterAccount = emptyGroupsAfterAccount.get(account.id) ?? []
    for (const emptyGroupId of groupsAfterAccount) {
      slots.push({ kind: 'group', groupId: emptyGroupId })
    }
  }

  for (const groupId of trailingEmptyGroupIds) {
    slots.push({ kind: 'group', groupId })
  }

  return {
    customOrderedAccounts,
    groupsById,
    slots
  }
}

const buildRenderEntriesForSection = (sectionAccounts: AccountRow[], isBanned: boolean): RenderEntry[] => {
  const entries: RenderEntry[] = []
  const { customOrderedAccounts, groupsById, slots } = buildSectionLayoutSlots(sectionAccounts, isBanned)
  const ungroupedAccounts = customOrderedAccounts.filter((account) => !account.groupId || !groupsById.has(account.groupId))
  const groupedAccountsById = new Map<string, AccountRow[]>()

  for (const account of customOrderedAccounts) {
    if (!account.groupId) {
      continue
    }

    const group = groupsById.get(account.groupId)
    if (!group) {
      continue
    }

    const existingGroupAccounts = groupedAccountsById.get(group.id) ?? []
    existingGroupAccounts.push(account)
    groupedAccountsById.set(group.id, existingGroupAccounts)
  }

  for (const slot of slots) {
    if (slot.kind === 'ungrouped-slot') {
      const account = ungroupedAccounts.shift()
      if (!account) {
        continue
      }
      entries.push({
        key: `account-${account.id}`,
        kind: 'account',
        account
      })
      continue
    }

    const group = groupsById.get(slot.groupId)
    if (!group) {
      continue
    }
    const groupAccounts = groupedAccountsById.get(group.id) ?? []

    entries.push({
      key: `group-${isBanned ? 'b' : 'n'}-${group.id}`,
      kind: 'group-block',
      group,
      isBanned,
      accountCount: groupAccounts.length,
      accounts: groupAccounts
    })
  }

  return entries
}

const renderEntries = computed<RenderEntry[]>(() => {
  const orderedAccounts = getCurrentSectionedAccounts(accounts.value)
  const entries: RenderEntry[] = orderedAccounts
    .filter((account) => !account.isBanned)
    .map((account) => ({
      key: `account-${account.id}`,
      kind: 'account',
      account
    }))
  if (normalAccounts.value.length === 0 && bannedAccounts.value.length > 0) {
    entries.push({ key: 'banned-divider-top', kind: 'banned-divider' })
  } else if (lastNormalAccountId.value !== null && bannedAccounts.value.length > 0) {
    entries.push({ key: 'banned-divider', kind: 'banned-divider' })
  }

  entries.push(...orderedAccounts
    .filter((account) => account.isBanned)
    .map((account) => ({
      key: `account-${account.id}`,
      kind: 'account',
      account
    })))
  return entries
})

const getRankSortScore = (rank: RankEntry) => {
  const tierScore = rankTierSortValue[rank.tier] ?? 0
  const divisionScore = rank.tier === 'Unranked' ? 0 : (6 - rank.division) / 10
  const predictedScore = rank.tier === 'Unranked' ? 0 : (rank.predicted ? 0.01 : 0)
  return tierScore + divisionScore + predictedScore
}

const markAccountRankModified = (account: AccountRow) => {
  account.lastRankModifiedAt = new Date().toISOString()
}

const getSortedAccountsForRole = (roleIndex: number, direction: 'desc' | 'asc') => {
  const sortSection = (sourceOrder: AccountRow[]) => [...sourceOrder].sort((left, right) => {
    const leftRank = left.ranks[roleIndex]
    const rightRank = right.ranks[roleIndex]
    const scoreDifference = getRankSortScore(rightRank) - getRankSortScore(leftRank)
    if (scoreDifference !== 0) {
      return direction === 'desc' ? scoreDifference : -scoreDifference
    }

    const leftCustomIndex = customAccountOrderIds.value.indexOf(left.id)
    const rightCustomIndex = customAccountOrderIds.value.indexOf(right.id)
    return leftCustomIndex - rightCustomIndex
  })

  return [
    ...sortSection(accounts.value.filter((account) => !account.isBanned)),
    ...sortSection(accounts.value.filter((account) => account.isBanned))
  ]
}

const restoreCustomAccountOrder = () => {
  accounts.value = getCustomSectionedAccounts(accounts.value)
}

const applyRoleSort = (roleIndex: number, direction: 'desc' | 'asc') => {
  const sortedAccounts = getSortedAccountsForRole(roleIndex, direction)
  const currentOrderKey = accounts.value.map((account) => account.id).join(',')
  const nextOrderKey = sortedAccounts.map((account) => account.id).join(',')

  activeRoleSort.value = { roleIndex, direction }
  if (currentOrderKey !== nextOrderKey) {
    accounts.value = sortedAccounts
  }
}

const cycleRoleSort = (roleIndex: number) => {
  const currentSort = activeRoleSort.value
  if (!currentSort || currentSort.roleIndex !== roleIndex) {
    applyRoleSort(roleIndex, 'desc')
    return
  }

  if (currentSort.direction === 'desc') {
    applyRoleSort(roleIndex, 'asc')
    return
  }

  activeRoleSort.value = null
  restoreCustomAccountOrder()
}

const restoreCustomRoleSort = (_roleIndex: number) => {
  activeRoleSort.value = null
  restoreCustomAccountOrder()
}

const getRoleSortTitle = (label: string) => {
  const lowerLabel = label.toLowerCase()
  return `Left click sorts ${lowerLabel} high to low, then low to high. Right click restores custom order.`
}

const buildAccountsPayload = () => accounts.value.map((account) => ({
  id: account.id,
  accountName: account.accountName,
  email: account.email,
  password: account.password,
  lastRankModifiedAt: account.lastRankModifiedAt,
  countryCode: account.countryCode,
  groupId: account.groupId,
  isBanned: account.isBanned,
  notes: account.notes,
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

const buildGroupsPayload = () => accountGroups.value.map((group) => ({
  id: group.id,
  name: group.name,
  collapsed: group.collapsed,
  section: group.section,
  anchorAccountId: group.anchorAccountId,
  anchorPosition: group.anchorPosition
}))

const buildUiSettingsPayload = () => ({
  showSixV6: showSixV6.value,
  showNonRankColumns: showNonRankColumns.value,
  showLeadButtons: showLeadButtons.value,
  badgeAnimationsEnabled: badgeAnimationsEnabled.value,
  uiZoom: normalizeUiZoom(uiZoom.value),
  clipboardClearTimerSeconds: normalizeClipboardClearTimer(clipboardClearTimerSeconds.value),
  rankNumberOffsetX: normalizeRankNumberOffset(rankNumberOffsetX.value),
  rankNumberOffsetY: normalizeRankNumberOffset(rankNumberOffsetY.value),
  rankNumberFontSize: normalizeRankNumberFontSize(rankNumberFontSize.value),
  groups: buildGroupsPayload()
})
const currentUiScale = computed(() => uiZoom.value / 125)

const getPixelValue = (styles: CSSStyleDeclaration, propertyName: string) => {
  const parsedValue = Number.parseFloat(styles.getPropertyValue(propertyName))
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

const syncTauriWindowSize = async () => {
  if (!import.meta.client || !isTauri() || !tauriResizeViewport.value || !appMainElement.value) {
    return
  }

  await nextTick()

  const appWindow = getCurrentWindow()
  const [scaleFactor, innerSize, monitor] = await Promise.all([
    appWindow.scaleFactor(),
    appWindow.innerSize(),
    currentMonitor()
  ])

  const viewportRect = tauriResizeViewport.value.getBoundingClientRect()
  const mainStyles = window.getComputedStyle(appMainElement.value)
  const horizontalPadding = getPixelValue(mainStyles, 'padding-left') + getPixelValue(mainStyles, 'padding-right')
  const verticalPadding = getPixelValue(mainStyles, 'padding-top') + getPixelValue(mainStyles, 'padding-bottom')
  const zoomedViewportWidth = Math.ceil(Number.parseInt(visibleGridWidth.value, 10) * currentUiScale.value)
  const desiredLogicalWidth = Math.ceil(zoomedViewportWidth + horizontalPadding)
  const maxLogicalWidth = monitor ? Math.floor(monitor.workArea.size.width / scaleFactor) - 12 : desiredLogicalWidth
  const maxLogicalHeight = monitor ? Math.floor(monitor.workArea.size.height / scaleFactor) - 12 : Math.ceil(viewportRect.height + verticalPadding)
  const zoomScaledMinWidth = Math.ceil(BASE_MIN_WINDOW_WIDTH * (uiZoom.value / DEFAULT_UI_ZOOM))
  const minLogicalWidth = Math.min(maxLogicalWidth, Math.max(zoomScaledMinWidth, desiredLogicalWidth))
  const minLogicalHeight = Math.min(maxLogicalHeight, 520)
  const visibleListHeight = accountListViewport.value?.getBoundingClientRect().height ?? 0
  const listContentHeight = accountListViewport.value?.scrollHeight ?? visibleListHeight
  const nonListHeight = Math.max(0, viewportRect.height - visibleListHeight)
  const maxAvailableListHeight = Math.max(0, maxLogicalHeight - verticalPadding - nonListHeight)
  const desiredInnerHeight = Math.ceil(nonListHeight + Math.min(listContentHeight, maxAvailableListHeight) + verticalPadding)
  const targetWidth = Math.max(minLogicalWidth, Math.min(maxLogicalWidth, desiredLogicalWidth))
  const targetHeight = Math.max(minLogicalHeight, Math.min(maxLogicalHeight, desiredInnerHeight))

  if (
    !lastAppliedTauriMinWindowSize ||
    Math.abs(lastAppliedTauriMinWindowSize.width - minLogicalWidth) >= 1 ||
    Math.abs(lastAppliedTauriMinWindowSize.height - minLogicalHeight) >= 1
  ) {
    await appWindow.setMinSize(new LogicalSize(minLogicalWidth, minLogicalHeight))
    lastAppliedTauriMinWindowSize = { width: minLogicalWidth, height: minLogicalHeight }
  }

  const currentLogicalInnerWidth = innerSize.width / scaleFactor
  const currentLogicalInnerHeight = innerSize.height / scaleFactor
  if (currentLogicalInnerWidth < minLogicalWidth || currentLogicalInnerHeight < minLogicalHeight) {
    const enforcedWidth = Math.max(currentLogicalInnerWidth, minLogicalWidth)
    const enforcedHeight = Math.max(currentLogicalInnerHeight, minLogicalHeight)
    await appWindow.setSize(new LogicalSize(enforcedWidth, enforcedHeight))
    lastAppliedTauriWindowSize = { width: enforcedWidth, height: enforcedHeight }
    return
  }

  if (
    lastAppliedTauriWindowSize &&
    Math.abs(lastAppliedTauriWindowSize.width - targetWidth) < 1 &&
    Math.abs(lastAppliedTauriWindowSize.height - targetHeight) < 1
  ) {
    return
  }

  await appWindow.setSize(new LogicalSize(targetWidth, targetHeight))
  lastAppliedTauriWindowSize = { width: targetWidth, height: targetHeight }
}

const scheduleTauriWindowResize = (delay = 150) => {
  if (!import.meta.client || !isTauri() || !tauriResizeReady) {
    return
  }

  if (tauriResizeTimeout) {
    clearTimeout(tauriResizeTimeout)
  }

  tauriResizeTimeout = setTimeout(() => {
    tauriResizeTimeout = null
    void syncTauriWindowSize()
  }, delay)
}

const getRankBadgeShineClass = (tier: RankTier) => {
  if (!badgeAnimationsEnabled.value) {
    return ''
  }

  switch (tier) {
    case 'Grandmaster':
      return 'rank-badge-shine-grandmaster'
    case 'Champion':
      return 'rank-badge-shine-champion'
    default:
      return ''
  }
}

const hasRankBadgeShine = (tier: RankTier) => (
  badgeAnimationsEnabled.value && (tier === 'Grandmaster' || tier === 'Champion')
)

const getRankBadgeSparkleClass = (tier: RankTier) => {
  if (!badgeAnimationsEnabled.value) {
    return ''
  }

  switch (tier) {
    case 'Master':
      return 'rank-badge-sparkle-master'
    case 'Grandmaster':
      return 'rank-badge-sparkle-grandmaster'
    case 'Champion':
      return 'rank-badge-sparkle-champion'
    default:
      return ''
  }
}

const hasRankBadgeSparkles = (tier: RankTier) => (
  badgeAnimationsEnabled.value && (tier === 'Master' || tier === 'Grandmaster' || tier === 'Champion')
)

const hasRankBadgeExtraSparkles = (tier: RankTier) => (
  badgeAnimationsEnabled.value && tier === 'Champion'
)

const getRankBadgeMaskStyle = (tier: RankTier) => ({
  '--rank-badge-mask-image': `url("${rankIcons[tier]}")`
})

const handleUiZoomInput = () => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  if (tauriResizeReady) {
    void syncTauriWindowSize()
    return
  }

  scheduleTauriWindowResize(0)
}

const warmupImageAsset = async (source: string) => {
  const image = new Image()
  image.decoding = 'async'
  image.src = source

  if ('decode' in image) {
    try {
      await image.decode()
      return
    } catch {
      return
    }
  }

  await new Promise<void>((resolve) => {
    image.onload = () => resolve()
    image.onerror = () => resolve()
  })
}

const warmupUiAssets = async () => {
  if (!import.meta.client) {
    return
  }

  const fontWarmups: Promise<unknown>[] = []
  if ('fonts' in document) {
    fontWarmups.push(document.fonts.load('24px RankBadgeNumber'))
    fontWarmups.push(document.fonts.load('27px RankBadgeNumber'))
  }

  const imageWarmups = assetWarmupSources.map((source) => warmupImageAsset(source))

  await Promise.allSettled([
    ...fontWarmups,
    ...imageWarmups
  ])
}

const persistAppStorage = async () => {
  if (!import.meta.client) {
    return
  }

  if (tauriDesktop) {
    await savePersistedAppStorage()
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildAccountsPayload()))
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(buildUiSettingsPayload()))
}

const schedulePersistAppStorage = (delay = 140) => {
  if (!import.meta.client) {
    return
  }

  if (appStoragePersistTimeout) {
    clearTimeout(appStoragePersistTimeout)
  }

  appStoragePersistTimeout = setTimeout(() => {
    appStoragePersistTimeout = null
    void persistAppStorage()
  }, delay)
}

const applyStoredUiSettings = (storedUiSettings: unknown) => {
  const importedUiSettings = storedUiSettings && typeof storedUiSettings === 'object'
    ? storedUiSettings as Record<string, unknown>
    : null

  showSixV6.value = typeof importedUiSettings?.showSixV6 === 'boolean' ? importedUiSettings.showSixV6 : true
  showNonRankColumns.value = typeof importedUiSettings?.showNonRankColumns === 'boolean' ? importedUiSettings.showNonRankColumns : true
  showLeadButtons.value = typeof importedUiSettings?.showLeadButtons === 'boolean' ? importedUiSettings.showLeadButtons : true
  badgeAnimationsEnabled.value = typeof importedUiSettings?.badgeAnimationsEnabled === 'boolean' ? importedUiSettings.badgeAnimationsEnabled : true
  uiZoom.value = normalizeUiZoom(importedUiSettings?.uiZoom)
  clipboardClearTimerSeconds.value = normalizeClipboardClearTimer(importedUiSettings?.clipboardClearTimerSeconds)
  rankNumberOffsetX.value = normalizeRankNumberOffset(importedUiSettings?.rankNumberOffsetX)
  rankNumberOffsetY.value = normalizeRankNumberOffset(importedUiSettings?.rankNumberOffsetY)
  rankNumberFontSize.value = normalizeRankNumberFontSize(importedUiSettings?.rankNumberFontSize)
}

const applyStoredGroups = (storedGroups: unknown, storedUiSettings?: unknown) => {
  const rawGroups = Array.isArray(storedGroups)
    ? storedGroups
    : Array.isArray((storedUiSettings as Record<string, unknown> | null | undefined)?.groups)
      ? (storedUiSettings as Record<string, unknown>).groups as unknown[]
      : []

  const normalizedGroups = rawGroups
    .map((entry: unknown, idx: number) => normalizeStoredGroup(entry, idx + 1))
    .filter((entry): entry is AccountGroup => Boolean(entry))

  const validGroupIds = new Set(normalizedGroups.map((group) => group.id))
  for (const account of accounts.value) {
    if (account.groupId && !validGroupIds.has(account.groupId)) {
      account.groupId = null
    }
  }

  accountGroups.value = normalizedGroups
}

const loadTauriStoredAppState = async () => {
  const parsedStoredAppState = parsePersistedAppStorage(await loadPersistedAppStorage())
  const storedAppState = parsedStoredAppState.payload

  if (storedAppState?.accounts && Array.isArray(storedAppState.accounts)) {
    const normalizedAccounts = storedAppState.accounts
      .filter((entry: unknown) => entry && typeof entry === 'object')
      .map((entry: unknown, idx: number) => normalizeStoredAccount(entry, idx + 1))
    accounts.value = normalizedAccounts.length > 0 ? normalizedAccounts : buildEmptyAccounts()
    applyStoredGroups(storedAppState.groups, storedAppState.uiSettings)
    applyStoredUiSettings(storedAppState.uiSettings)
    if (parsedStoredAppState.migratedLegacy) {
      await persistAppStorage()
    }
  } else {
    accounts.value = buildEmptyAccounts()
    accountGroups.value = []
    applyStoredUiSettings(null)
    await persistAppStorage()
  }

  clearLegacyBrowserStorage()
}

onMounted(() => {
  if (!import.meta.client) {
    return
  }

  assetWarmupPromise ??= warmupUiAssets()

  if (!isTauri() && !localStorage.getItem(STORAGE_KEY)) {
    schedulePersistAppStorage(0)
  }

  window.addEventListener('click', closeMenus)

  if (tauriDesktop) {
    void getVersion()
      .then((version) => {
        const versionLabel = `v${version}`
        appVersionLabel.value = versionLabel
        maybeOpenWhatsNewModal(versionLabel)
      })
      .catch(() => {})

    tauriResizeObserver = new ResizeObserver(() => {
      scheduleTauriWindowResize(120)
    })
    if (tauriResizeViewport.value) {
      tauriResizeObserver.observe(tauriResizeViewport.value)
    }
    const hasSavedTauriWindowState = localStorage.getItem(TAURI_WINDOW_STATE_KEY) === 'true'
    if (hasSavedTauriWindowState) {
      tauriResizeReadyTimeout = setTimeout(() => {
        tauriResizeReady = true
        tauriResizeReadyTimeout = null
      }, 450)
    } else {
      void Promise.race([
        assetWarmupPromise,
        new Promise<void>((resolve) => {
          tauriResizeReadyTimeout = setTimeout(() => {
            tauriResizeReadyTimeout = null
            resolve()
          }, 700)
        })
      ]).finally(() => {
        tauriResizeReady = true
        localStorage.setItem(TAURI_WINDOW_STATE_KEY, 'true')
        scheduleTauriWindowResize(0)
      })
    }

    void (async () => {
      try {
        await ensurePersistedAppStorageReady()
        await loadTauriStoredAppState()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not open the protected local database.'
        pushNotification('Database setup failed', {
          message,
          kind: 'error',
          duration: 3600
        })
      }
    })()
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  window.removeEventListener('click', closeMenus)
  resetDragState()

  if (tauriResizeObserver) {
    tauriResizeObserver.disconnect()
    tauriResizeObserver = null
  }
  if (tauriResizeTimeout) {
    clearTimeout(tauriResizeTimeout)
    tauriResizeTimeout = null
  }
  if (tauriResizeReadyTimeout) {
    clearTimeout(tauriResizeReadyTimeout)
    tauriResizeReadyTimeout = null
  }
  if (appStoragePersistTimeout) {
    clearTimeout(appStoragePersistTimeout)
    appStoragePersistTimeout = null
  }
})

watch(accounts, () => {
  schedulePersistAppStorage()
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    syncCustomAccountOrderFromAccounts()
  }
}, { deep: true })

watch(accountGroups, () => {
  schedulePersistAppStorage()
  if (!import.meta.client || isTauri()) {
    return
  }

  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(buildUiSettingsPayload()))
}, { deep: true })

watch([showSixV6, showNonRankColumns, showLeadButtons, badgeAnimationsEnabled, uiZoom, () => accounts.value.length], () => {
  scheduleTauriWindowResize()
})

watch([showSixV6, showNonRankColumns, showLeadButtons, badgeAnimationsEnabled, uiZoom, clipboardClearTimerSeconds, rankNumberOffsetX, rankNumberOffsetY, rankNumberFontSize], () => {
  if (!import.meta.client) {
    return
  }
  if (!isTauri()) {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(buildUiSettingsPayload()))
  }
  schedulePersistAppStorage()
})

const exportData = () => {
  if (!import.meta.client) {
    return
  }

  if (!tauriDesktop) {
    pushNotification('Desktop only', {
      message: 'Encrypted backup export is only available in the desktop app.',
      kind: 'info'
    })
    return
  }

  closeSettingsMenu()
  backupTransferModalMode.value = 'export'
}

const triggerImportData = () => {
  importFileInput.value?.click()
}

const handleImportData = async (event: Event) => {
  if (!import.meta.client) {
    return
  }

  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  if (!tauriDesktop) {
    pushNotification('Desktop only', {
      message: 'Encrypted backup import is only available in the desktop app.',
      kind: 'info'
    })
    if (input) {
      input.value = ''
    }
    return
  }

  pendingImportFile = file
  backupTransferFileName.value = file.name
  backupTransferModalMode.value = 'import'

  if (input) {
    input.value = ''
  }
}

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

const isDefaultPlaceholderAccountName = (accountName: string) => (
  normalizeAccountNameForComparison(accountName) === 'battletag#0000'
)

const getDisplayAccountName = (accountName: string) => {
  const hashIndex = accountName.indexOf('#')
  return hashIndex === -1 ? accountName : accountName.slice(0, hashIndex)
}

const normalizeAccountNameForComparison = (accountName: string) => accountName.trim().toLowerCase()

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
    const nextAccountName = activeEditorValue.value.trim()
    const duplicateAccount = accounts.value.find((entry) => (
      entry.id !== account.id
      && !isDefaultPlaceholderAccountName(entry.accountName)
      && !isDefaultPlaceholderAccountName(nextAccountName)
      && normalizeAccountNameForComparison(entry.accountName) === normalizeAccountNameForComparison(nextAccountName)
    ))

    if (duplicateAccount) {
      pushNotification('Account already added', {
        message: 'You already have that Battletag added.',
        kind: 'error',
        duration: 2800
      })
      account.accountName = 'Battletag#0000'
      activeEditorValue.value = account.accountName
      cancelActiveEditor()
      return
    }

    account.accountName = nextAccountName
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

const getAccountNameForDisplay = (accountId: number) => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  return account ? getDisplayAccountName(account.accountName) : 'this account'
}

const closeSettingsMenu = () => {
  settingsMenuOpen.value = false
}

const settingsFooterLabel = computed(() => `MADE BY MERK - ${appVersionLabel.value}`)
const hasPendingAppUpdate = computed(() => availableAppUpdate.value !== null)
const whatsNewItems = computed(() => WHATS_NEW_ITEMS_BY_VERSION[appVersionLabel.value] ?? [])

const maybeOpenWhatsNewModal = (versionLabel: string) => {
  if (!import.meta.client) {
    return
  }

  const versionItems = WHATS_NEW_ITEMS_BY_VERSION[versionLabel]
  if (!versionItems || versionItems.length === 0) {
    localStorage.setItem(WHATS_NEW_VERSION_KEY, versionLabel)
    return
  }

  const lastSeenVersion = localStorage.getItem(WHATS_NEW_VERSION_KEY)
  if (!lastSeenVersion) {
    localStorage.setItem(WHATS_NEW_VERSION_KEY, versionLabel)
    return
  }

  if (lastSeenVersion !== versionLabel) {
    whatsNewModalOpen.value = true
  }

  localStorage.setItem(WHATS_NEW_VERSION_KEY, versionLabel)
}

const closeUpdateModal = () => {
  updateModalOpen.value = false
}

const closeUpdateRestartModal = () => {
  updateRestartModalOpen.value = false
}

const closeWhatsNewModal = () => {
  whatsNewModalOpen.value = false
}

const checkForAppUpdates = async (silentNoUpdate = false) => {
  if (!tauriDesktop || updateCheckBusy.value) {
    if (!tauriDesktop && !silentNoUpdate) {
      pushNotification('Desktop only', {
        message: 'App updates are only available in the installed desktop build.',
        kind: 'info'
      })
    }
    return
  }

  updateCheckBusy.value = true

  try {
    const update = await checkForUpdate()
    if (!update) {
      availableAppUpdate.value = null
      updateModalOpen.value = false
      if (!silentNoUpdate) {
        pushNotification('No update available', {
          message: 'You are already on the latest published version.',
          kind: 'info'
        })
      }
      return
    }

    availableAppUpdate.value = markRaw(update)
    updateModalOpen.value = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushNotification('Update failed', {
      message: message.includes('REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY')
        ? 'The updater public key is still a placeholder in tauri.conf.json.'
        : message,
      kind: 'error',
      duration: 5200
    })
  } finally {
    updateCheckBusy.value = false
  }
}

const installAvailableUpdate = async () => {
  if (!availableAppUpdate.value || updateInstallBusy.value) {
    return
  }

  updateInstallBusy.value = true
  try {
    pushNotification('Installing update', {
      message: `Downloading RankDB ${availableAppUpdate.value.version} from GitHub Releases.`,
      kind: 'info',
      duration: 4200
    })

    await availableAppUpdate.value.downloadAndInstall()
    updateModalOpen.value = false
    updateRestartModalOpen.value = true
    pushNotification('Update ready', {
      message: 'Restart RankDB to finish applying the update.',
      kind: 'success',
      duration: 3600
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushNotification('Update failed', {
      message: message.includes('REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY')
        ? 'The updater public key is still a placeholder in tauri.conf.json.'
        : message,
      kind: 'error',
      duration: 5200
    })
  } finally {
    updateInstallBusy.value = false
  }
}

const restartAfterUpdate = async () => {
  if (updateInstallBusy.value) {
    return
  }

  try {
    await relaunch()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushNotification('Restart failed', {
      message,
      kind: 'error',
      duration: 4200
    })
  }
}

const handleUpdateButtonClick = async () => {
  if (hasPendingAppUpdate.value) {
    updateModalOpen.value = true
    return
  }

  await checkForAppUpdates(false)
}

const closeBackupTransferModal = () => {
  backupTransferModalMode.value = null
  backupTransferPassword.value = ''
  backupTransferPasswordConfirm.value = ''
  backupTransferBusy.value = false
  backupTransferError.value = ''
  backupTransferFileName.value = ''
  pendingImportFile = null
}

const closeAccountContextMenu = () => {
  accountContextMenu.value = null
  accountContextMenuPositionStyle.value = {}
}

const closeGroupActionMenu = () => {
  groupActionMenu.value = null
  groupActionMenuPositionStyle.value = {}
}

const closeDeleteAccountModal = () => {
  deleteAccountModal.value = null
}

const closeCredentialsModal = () => {
  credentialsModal.value = null
  credentialsEmailDraft.value = ''
  credentialsPasswordDraft.value = ''
  credentialsEmailVisible.value = false
  credentialsPasswordVisible.value = false
}

const closeAccountInfoModal = () => {
  accountInfoModal.value = null
  accountInfoCountryDraft.value = ''
  accountInfoBannedDraft.value = false
  accountInfoNotesDraft.value = ''
}

const openCreateGroupModal = () => {
  groupModalMode.value = 'create'
  editingGroupId.value = ''
  createGroupNameDraft.value = ''
  requestAnimationFrame(() => {
    createGroupModalOpen.value = true
  })
}

const closeCreateGroupModal = () => {
  createGroupModalOpen.value = false
  createGroupNameDraft.value = ''
  groupModalMode.value = 'create'
  editingGroupId.value = ''
}

const createGroup = () => {
  const groupName = normalizeGroupName(createGroupNameDraft.value)
  if (!groupName) {
    return
  }

  const duplicateGroup = accountGroups.value.find((group) => (
    group.name.toLowerCase() === groupName.toLowerCase()
    && group.id !== editingGroupId.value
  ))
  if (duplicateGroup) {
    pushNotification('Group already exists', {
      message: `Using the existing ${duplicateGroup.name} group instead.`,
      kind: 'info'
    })
    return
  }

  if (groupModalMode.value === 'edit') {
    const group = accountGroups.value.find((entry) => entry.id === editingGroupId.value)
    if (!group) {
      return
    }

    group.name = groupName
    closeCreateGroupModal()
    schedulePersistAppStorage()
    pushNotification('Group updated', {
      message: `${groupName} was renamed.`,
      kind: 'success'
    })
    return
  }

  accountGroups.value.push({
    id: buildGroupId(),
    name: groupName,
    collapsed: false,
    section: 'normal',
    anchorAccountId: null,
    anchorPosition: 'after'
  })
  closeCreateGroupModal()
  schedulePersistAppStorage()
  pushNotification('Group created', {
    message: `${groupName} is ready for accounts.`,
    kind: 'success'
  })
}

const toggleGroupCollapsed = (groupId: string) => {
  const group = accountGroups.value.find((entry) => entry.id === groupId)
  if (!group) {
    return
  }

  group.collapsed = !group.collapsed
}

const removeGroup = (groupId: string) => {
  closeGroupActionMenu()
  const group = accountGroups.value.find((entry) => entry.id === groupId)
  if (!group) {
    return
  }

  for (const account of accounts.value) {
    if (account.groupId === groupId) {
      account.groupId = null
    }
  }

  accountGroups.value = accountGroups.value.filter((entry) => entry.id !== groupId)
  if (!activeRoleSort.value) {
    syncCustomAccountOrderFromAccounts()
  }
  schedulePersistAppStorage()
  pushNotification('Group removed', {
    message: `${group.name} was deleted and its accounts were moved out.`,
    kind: 'info'
  })
}

const closeMenus = () => {
  closeSettingsMenu()
  closeGroupActionMenu()
  closeAccountContextMenu()
}

const openGroupActionMenu = (groupId: string, event: MouseEvent) => {
  commitActiveEditor()
  closeMenus()
  closeRankPicker()

  const menuWidth = 180
  const menuHeight = 88
  const viewportPadding = 10
  const maxLeft = window.innerWidth - menuWidth - viewportPadding
  const maxTop = window.innerHeight - menuHeight - viewportPadding
  const left = Math.max(viewportPadding, Math.min(event.clientX, maxLeft))
  const top = Math.max(viewportPadding, Math.min(event.clientY, maxTop))

  groupActionMenuPositionStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }
  groupActionMenu.value = { groupId }
}

const requestEditGroup = (groupId: string) => {
  const group = accountGroups.value.find((entry) => entry.id === groupId)
  if (!group) {
    return
  }

  closeGroupActionMenu()
  groupModalMode.value = 'edit'
  editingGroupId.value = group.id
  createGroupNameDraft.value = group.name
  requestAnimationFrame(() => {
    createGroupModalOpen.value = true
  })
}

const toggleSettingsMenu = () => {
  settingsMenuOpen.value = !settingsMenuOpen.value
}

const applyImportedAppData = (parsed: { accounts?: unknown; groups?: unknown; uiSettings?: unknown }) => {
  const importedAccounts = Array.isArray(parsed?.accounts) ? parsed.accounts : null
  if (!importedAccounts) {
    throw new Error('Invalid data file')
  }

  const normalizedAccounts = importedAccounts
    .filter((entry: unknown) => entry && typeof entry === 'object')
    .map((entry: unknown, idx: number) => normalizeStoredAccount(entry, idx + 1))

  accounts.value = normalizedAccounts.length > 0 ? normalizedAccounts : buildEmptyAccounts()
  applyStoredGroups(parsed?.groups, parsed?.uiSettings)
  applyStoredUiSettings(parsed?.uiSettings)
  schedulePersistAppStorage(0)
  closeSettingsMenu()
}

const submitBackupTransfer = async () => {
  if (!import.meta.client || !backupTransferModalMode.value || backupTransferBusy.value) {
    return
  }

  backupTransferError.value = ''
  if (!backupTransferPassword.value) {
    backupTransferError.value = 'Enter a backup password.'
    return
  }

  if (backupTransferModalMode.value === 'export' && backupTransferPassword.value !== backupTransferPasswordConfirm.value) {
    backupTransferError.value = 'The backup passwords do not match.'
    return
  }

  backupTransferBusy.value = true
  try {
    if (backupTransferModalMode.value === 'export') {
      const exportPayload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        accounts: buildAccountsPayload(),
        groups: buildGroupsPayload(),
        uiSettings: buildUiSettingsPayload()
      }

      const encryptedExport = await encryptPortableExportPayload(exportPayload, backupTransferPassword.value)
      const blob = new Blob([encryptedExport], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `rankdb-export-${new Date().toISOString().slice(0, 10)}.rankdb-export`
      anchor.click()
      URL.revokeObjectURL(url)
      closeBackupTransferModal()
      pushNotification('Export complete', {
        message: 'Your backup was downloaded as an encrypted export file.',
        kind: 'success'
      })
      return
    }

    if (!pendingImportFile) {
      throw new Error('No backup file selected.')
    }

    const raw = await pendingImportFile.text()
    const parsed = await decryptPortableExportPayload(raw, backupTransferPassword.value)

    applyImportedAppData(parsed)
    const importedCount = accounts.value.length
    closeBackupTransferModal()
    pushNotification('Import complete', {
      message: `Loaded ${importedCount} account${importedCount === 1 ? '' : 's'}.`,
      kind: 'success'
    })
  } catch (error) {
    backupTransferError.value = error instanceof Error
      ? error.message
      : 'Could not import the encrypted backup file.'
  } finally {
    backupTransferBusy.value = false
  }
}

const toggleLeadButtons = () => {
  showLeadButtons.value = !showLeadButtons.value
}

const openAccountContextMenu = (accountId: number, event: MouseEvent) => {
  commitActiveEditor()
  closeMenus()
  closeRankPicker()

  const menuWidth = 220
  const menuHeight = 220
  const viewportPadding = 10
  const maxLeft = window.innerWidth - menuWidth - viewportPadding
  const maxTop = window.innerHeight - menuHeight - viewportPadding
  const left = Math.max(viewportPadding, Math.min(event.clientX, maxLeft))
  const top = Math.max(viewportPadding, Math.min(event.clientY, maxTop))

  accountContextMenuPositionStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }
  accountContextMenu.value = { accountId }
}

const requestDeleteAccount = (accountId: number) => {
  closeAccountContextMenu()
  deleteAccountModal.value = { accountId }
}

const requestEditBattletag = (accountId: number) => {
  closeAccountContextMenu()
  beginNameEdit(accountId)
}

const requestEditCredentials = (accountId: number) => {
  closeAccountContextMenu()
  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }

  credentialsEmailDraft.value = account.email
  credentialsPasswordDraft.value = account.password
  credentialsEmailVisible.value = false
  credentialsPasswordVisible.value = false
  credentialsModal.value = { accountId }
}

const requestAccountInfo = (accountId: number) => {
  closeAccountContextMenu()
  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }

  accountInfoCountryDraft.value = account.countryCode
  accountInfoBannedDraft.value = account.isBanned
  accountInfoNotesDraft.value = account.notes
  accountInfoModal.value = { accountId }
}

const saveAccountInfo = () => {
  if (!accountInfoModal.value) {
    return
  }

  const account = accounts.value.find((entry) => entry.id === accountInfoModal.value?.accountId)
  if (!account) {
    closeAccountInfoModal()
    return
  }

  account.countryCode = accountInfoCountryDraft.value
  account.isBanned = accountInfoBannedDraft.value
  account.notes = accountInfoNotesDraft.value
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    restoreCustomAccountOrder()
    syncCustomAccountOrderFromAccounts()
  }
  schedulePersistAppStorage()
  const selectedCountry = getCountryOption(account.countryCode)
  const accountStatusLabel = account.isBanned ? 'Banned section' : 'Normal section'
  closeAccountInfoModal()
  pushNotification('Account Info saved', {
    message: selectedCountry
      ? `${getAccountNameForDisplay(account.id)} set to ${selectedCountry.label} · ${accountStatusLabel}.`
      : `${getAccountNameForDisplay(account.id)} moved to ${accountStatusLabel}.`,
    kind: 'success'
  })
}

const moveAccountToGroup = (accountId: number, groupId: string) => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    closeAccountContextMenu()
    return
  }

  const nextGroupId = accountGroups.value.some((group) => group.id === groupId) ? groupId : null
  account.groupId = nextGroupId
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    restoreCustomAccountOrder()
    syncCustomAccountOrderFromAccounts()
  }
  schedulePersistAppStorage()
  closeAccountContextMenu()
  pushNotification('Group updated', {
    message: nextGroupId
      ? `${getAccountNameForDisplay(account.id)} moved to ${accountGroups.value.find((group) => group.id === nextGroupId)?.name ?? 'group'}.`
      : `${getAccountNameForDisplay(account.id)} moved to no group.`,
    kind: 'success'
  })
}

const saveCredentials = async () => {
  if (!credentialsModal.value) {
    return
  }

  const account = accounts.value.find((entry) => entry.id === credentialsModal.value?.accountId)
  if (!account) {
    closeCredentialsModal()
    return
  }

  try {
    account.email = credentialsEmailDraft.value
    account.password = credentialsPasswordDraft.value
    closeCredentialsModal()
    schedulePersistAppStorage()
    pushNotification('Credentials saved', {
      message: `Updated ${getAccountNameForDisplay(account.id)}.`,
      kind: 'success'
    })
  } catch {
    pushNotification('Credentials not saved', {
      message: 'The encrypted app database rejected the update.',
      kind: 'error',
      duration: 3600
    })
  }
}

const confirmDeleteAccount = async () => {
  if (!deleteAccountModal.value) {
    return
  }

  await removeBar(deleteAccountModal.value.accountId)
  closeDeleteAccountModal()
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

  const sourceAccount = accounts.value[sourceIndex]
  const targetAccount = accounts.value[targetIndex]
  if (!sourceAccount || !targetAccount || sourceAccount.isBanned !== targetAccount.isBanned) {
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
  if (!activeRoleSort.value) {
    syncCustomAccountOrderFromAccounts()
  }
}

const getSectionBoundaryInsertIndex = (
  sourceAccounts: AccountRow[],
  section: 'normal' | 'banned',
  edge: 'start' | 'end'
) => {
  const isBanned = section === 'banned'
  if (edge === 'start') {
    const firstSectionIndex = sourceAccounts.findIndex((account) => account.isBanned === isBanned)
    return firstSectionIndex === -1 ? sourceAccounts.length : firstSectionIndex
  }

  const sectionAccounts = sourceAccounts.filter((account) => account.isBanned === isBanned)
  const lastSectionAccount = sectionAccounts.at(-1)
  if (!lastSectionAccount) {
    return getSectionBoundaryInsertIndex(sourceAccounts, section, 'start')
  }

  const lastSectionIndex = sourceAccounts.findIndex((account) => account.id === lastSectionAccount.id)
  return lastSectionIndex === -1 ? sourceAccounts.length : lastSectionIndex + 1
}

const getRenderEntryIndexForGroup = (groupId: string, section: 'normal' | 'banned') => renderEntries.value.findIndex((entry) => (
  entry.kind === 'group-block'
  && entry.group.id === groupId
  && (entry.isBanned ? 'banned' : 'normal') === section
))

const findNextSectionAccountIdFromRenderIndex = (section: 'normal' | 'banned', startIndex: number) => {
  for (let index = startIndex + 1; index < renderEntries.value.length; index += 1) {
    const entry = renderEntries.value[index]
    if (entry?.kind === 'account' && (entry.account.isBanned ? 'banned' : 'normal') === section) {
      return entry.account.id
    }
  }

  return null
}

const findPreviousSectionAccountIdFromRenderIndex = (section: 'normal' | 'banned', startIndex: number) => {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const entry = renderEntries.value[index]
    if (entry?.kind === 'account' && (entry.account.isBanned ? 'banned' : 'normal') === section) {
      return entry.account.id
    }
  }

  return null
}

const getInsertIndexBeforeAccount = (sourceAccounts: AccountRow[], accountId: number) => {
  const index = sourceAccounts.findIndex((account) => account.id === accountId)
  return index === -1 ? -1 : index
}

const getInsertIndexAfterAccount = (sourceAccounts: AccountRow[], accountId: number) => {
  const index = sourceAccounts.findIndex((account) => account.id === accountId)
  return index === -1 ? -1 : index + 1
}

const resolveEmptyGroupOuterInsertIndex = (
  sourceAccounts: AccountRow[],
  section: 'normal' | 'banned',
  groupId: string,
  position: 'before' | 'after'
) => {
  const renderIndex = getRenderEntryIndexForGroup(groupId, section)
  if (renderIndex === -1) {
    return getSectionBoundaryInsertIndex(sourceAccounts, section, 'end')
  }

  const nextAccountId = findNextSectionAccountIdFromRenderIndex(section, renderIndex)
  const previousAccountId = findPreviousSectionAccountIdFromRenderIndex(section, renderIndex)
  if (position === 'before') {
    if (previousAccountId !== null) {
      return getInsertIndexAfterAccount(sourceAccounts, previousAccountId)
    }
    if (nextAccountId !== null) {
      return getInsertIndexBeforeAccount(sourceAccounts, nextAccountId)
    }
    return getSectionBoundaryInsertIndex(sourceAccounts, section, 'start')
  }

  if (nextAccountId !== null) {
    return getInsertIndexBeforeAccount(sourceAccounts, nextAccountId)
  }
  if (previousAccountId !== null) {
    return getInsertIndexAfterAccount(sourceAccounts, previousAccountId)
  }
  return getSectionBoundaryInsertIndex(sourceAccounts, section, 'end')
}

const resolveEmptyGroupInsideInsertIndex = (
  sourceAccounts: AccountRow[],
  section: 'normal' | 'banned',
  groupId: string
) => {
  const renderIndex = getRenderEntryIndexForGroup(groupId, section)
  if (renderIndex === -1) {
    return getSectionBoundaryInsertIndex(sourceAccounts, section, 'end')
  }

  const nextAccountId = findNextSectionAccountIdFromRenderIndex(section, renderIndex)
  if (nextAccountId !== null) {
    return getInsertIndexBeforeAccount(sourceAccounts, nextAccountId)
  }

  const previousAccountId = findPreviousSectionAccountIdFromRenderIndex(section, renderIndex)
  if (previousAccountId !== null) {
    return getInsertIndexAfterAccount(sourceAccounts, previousAccountId)
  }

  return getSectionBoundaryInsertIndex(sourceAccounts, section, 'end')
}

const moveAccountByTarget = (
  sourceAccountId: number,
  target: { targetKind: 'account' | 'group' | 'group-inside'; accountId: number | null; groupId: string; section: 'normal' | 'banned' },
  position: 'before' | 'after'
) => {
  const sourceIndex = accounts.value.findIndex((account) => account.id === sourceAccountId)
  if (sourceIndex === -1) {
    return
  }

  const sourceAccount = accounts.value[sourceIndex]
  if (!sourceAccount || (sourceAccount.isBanned ? 'banned' : 'normal') !== target.section) {
    return
  }

  const nextAccounts = [...accounts.value]
  const [movedAccount] = nextAccounts.splice(sourceIndex, 1)
  if (!movedAccount) {
    return
  }

  let nextGroupId: string | null = null
  let insertIndex = -1
  let targetEmptyGroupPlacement: { groupId: string; anchorAccountId: number; anchorPosition: 'before' | 'after'; section: 'normal' | 'banned' } | null = null

  if (target.targetKind === 'account' && target.accountId !== null) {
    const targetAccount = nextAccounts.find((account) => account.id === target.accountId)
    if (!targetAccount || targetAccount.isBanned !== sourceAccount.isBanned) {
      return
    }

    nextGroupId = targetAccount.groupId
    insertIndex = position === 'before'
      ? getInsertIndexBeforeAccount(nextAccounts, targetAccount.id)
      : getInsertIndexAfterAccount(nextAccounts, targetAccount.id)
  } else if (target.targetKind === 'group-inside') {
    const targetGroup = accountGroups.value.find((group) => group.id === target.groupId)
    if (!targetGroup || targetGroup.section !== target.section) {
      return
    }

    nextGroupId = target.groupId
    const targetGroupAccounts = nextAccounts.filter((account) => (
      account.groupId === target.groupId
      && account.isBanned === sourceAccount.isBanned
    ))

    if (targetGroupAccounts.length > 0) {
      const boundaryAccountId = position === 'before'
        ? (targetGroupAccounts[0]?.id ?? null)
        : (targetGroupAccounts.at(-1)?.id ?? null)
      if (boundaryAccountId !== null) {
        insertIndex = position === 'before'
          ? getInsertIndexBeforeAccount(nextAccounts, boundaryAccountId)
          : getInsertIndexAfterAccount(nextAccounts, boundaryAccountId)
      }
    } else {
      insertIndex = resolveEmptyGroupInsideInsertIndex(nextAccounts, target.section, target.groupId)
    }
  } else if (target.targetKind === 'group') {
    nextGroupId = null
    const targetGroupAccounts = nextAccounts.filter((account) => (
      account.groupId === target.groupId
      && account.isBanned === sourceAccount.isBanned
    ))

    if (targetGroupAccounts.length > 0) {
      const boundaryAccountId = position === 'before'
        ? (targetGroupAccounts[0]?.id ?? null)
        : (targetGroupAccounts.at(-1)?.id ?? null)
      if (boundaryAccountId !== null) {
        insertIndex = position === 'before'
          ? getInsertIndexBeforeAccount(nextAccounts, boundaryAccountId)
          : getInsertIndexAfterAccount(nextAccounts, boundaryAccountId)
      }
    } else {
      const groupRenderIndex = getRenderEntryIndexForGroup(target.groupId, target.section)
      if (groupRenderIndex !== -1) {
        const adjacentAccountId = position === 'before'
          ? findPreviousSectionAccountIdFromRenderIndex(target.section, groupRenderIndex)
          : findNextSectionAccountIdFromRenderIndex(target.section, groupRenderIndex)
        if (adjacentAccountId === sourceAccountId) {
          return
        }
      }

      insertIndex = resolveEmptyGroupOuterInsertIndex(nextAccounts, target.section, target.groupId, position)
      targetEmptyGroupPlacement = {
        groupId: target.groupId,
        section: target.section,
        anchorAccountId: movedAccount.id,
        anchorPosition: position === 'before' ? 'after' : 'before'
      }
    }
  }

  if (insertIndex === -1) {
    insertIndex = getSectionBoundaryInsertIndex(nextAccounts, target.section, 'end')
  }

  const sourceGroupId = sourceAccount.groupId
  const shouldAnchorSourceGroup = Boolean(sourceGroupId) && sourceGroupId !== nextGroupId && accounts.value.filter((account) => (
    account.groupId === sourceGroupId
    && account.isBanned === sourceAccount.isBanned
  )).length === 1

  if (shouldAnchorSourceGroup && sourceGroupId) {
    const nextSameSectionAccount = nextAccounts.find((account, index) => index >= sourceIndex && account.isBanned === sourceAccount.isBanned)
    const previousSameSectionAccount = [...nextAccounts]
      .slice(0, sourceIndex)
      .reverse()
      .find((account) => account.isBanned === sourceAccount.isBanned)

    updateGroupPlacement(sourceGroupId, {
      section: sourceAccount.isBanned ? 'banned' : 'normal',
      anchorAccountId: nextSameSectionAccount?.id ?? previousSameSectionAccount?.id ?? null,
      anchorPosition: nextSameSectionAccount ? 'before' : 'after'
    })
  }

  movedAccount.groupId = nextGroupId
  nextAccounts.splice(insertIndex, 0, movedAccount)
  accounts.value = nextAccounts

  if (targetEmptyGroupPlacement) {
    updateGroupPlacement(targetEmptyGroupPlacement.groupId, {
      section: targetEmptyGroupPlacement.section,
      anchorAccountId: targetEmptyGroupPlacement.anchorAccountId,
      anchorPosition: targetEmptyGroupPlacement.anchorPosition
    })
  }

  if (nextGroupId) {
    const targetGroup = accountGroups.value.find((group) => group.id === nextGroupId)
    if (targetGroup) {
      updateGroupPlacement(nextGroupId, {
        section: targetGroup.section,
        anchorAccountId: null
      })
    }
  }

  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    syncCustomAccountOrderFromAccounts()
  }
  schedulePersistAppStorage()
}

const moveGroup = (sourceGroupId: string, targetGroupId: string, position: 'before' | 'after') => {
  if (sourceGroupId === targetGroupId) {
    return
  }

  const sourceIndex = accountGroups.value.findIndex((group) => group.id === sourceGroupId)
  const targetIndex = accountGroups.value.findIndex((group) => group.id === targetGroupId)
  if (sourceIndex === -1 || targetIndex === -1) {
    return
  }

  const nextGroups = [...accountGroups.value]
  const [movedGroup] = nextGroups.splice(sourceIndex, 1)
  if (!movedGroup) {
    return
  }

  const adjustedTargetIndex = nextGroups.findIndex((group) => group.id === targetGroupId)
  const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1
  nextGroups.splice(insertIndex, 0, movedGroup)
  accountGroups.value = nextGroups
  schedulePersistAppStorage()
}

const updateGroupPlacement = (
  groupId: string,
  placement: Partial<Pick<AccountGroup, 'section' | 'anchorAccountId' | 'anchorPosition'>>
) => {
  const groupIndex = accountGroups.value.findIndex((group) => group.id === groupId)
  if (groupIndex === -1) {
    return
  }

  const nextGroups = [...accountGroups.value]
  const group = nextGroups[groupIndex]
  if (!group) {
    return
  }

  nextGroups[groupIndex] = {
    ...group,
    ...placement
  }
  accountGroups.value = nextGroups
  schedulePersistAppStorage()
}

const moveGroupBlock = (
  sourceGroupId: string,
  sourceSection: 'normal' | 'banned',
  target: { kind: 'group'; groupId: string } | { kind: 'account'; accountId: number },
  position: 'before' | 'after'
) => {
  const sourceIsBanned = sourceSection === 'banned'
  const sourceGroupAccounts = accounts.value.filter((account) => account.isBanned === sourceIsBanned && account.groupId === sourceGroupId)
  const sourceGroup = accountGroups.value.find((group) => group.id === sourceGroupId)
  if (!sourceGroup) {
    return
  }

  if (sourceGroupAccounts.length === 0) {
    if (target.kind === 'account') {
      const targetAccount = accounts.value.find((account) => account.id === target.accountId)
      if (!targetAccount) {
        return
      }

      updateGroupPlacement(sourceGroupId, {
        section: targetAccount.isBanned ? 'banned' : 'normal',
        anchorAccountId: targetAccount.id,
        anchorPosition: position
      })
      return
    }

    if (target.kind === 'group') {
      const targetGroupAccounts = accounts.value.filter((account) => (
        account.isBanned === sourceIsBanned
        && account.groupId === target.groupId
      ))
      if (targetGroupAccounts.length > 0) {
        updateGroupPlacement(sourceGroupId, {
          section: sourceSection,
          anchorAccountId: position === 'before'
            ? (targetGroupAccounts[0]?.id ?? null)
            : (targetGroupAccounts.at(-1)?.id ?? null),
          anchorPosition: position
        })
      } else {
        const targetGroup = accountGroups.value.find((group) => group.id === target.groupId)
        updateGroupPlacement(sourceGroupId, {
          section: targetGroup?.section ?? sourceGroup.section,
          anchorAccountId: targetGroup?.anchorAccountId ?? null,
          anchorPosition: targetGroup?.anchorPosition ?? 'after'
        })
      }
      moveGroup(sourceGroupId, target.groupId, position)
    }
    return
  }

  const sourceGroupIds = new Set(sourceGroupAccounts.map((account) => account.id))
  const nextAccounts = accounts.value.filter((account) => !sourceGroupIds.has(account.id))
  let insertIndex = -1

  if (target.kind === 'account') {
    const targetIndex = nextAccounts.findIndex((account) => account.id === target.accountId)
    if (targetIndex !== -1) {
      insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    }
  } else {
    const targetGroupAccounts = nextAccounts.filter((account) => account.isBanned === sourceIsBanned && account.groupId === target.groupId)
    if (targetGroupAccounts.length > 0) {
      const firstTargetIndex = nextAccounts.findIndex((account) => account.id === targetGroupAccounts[0]?.id)
      const lastTargetIndex = nextAccounts.findIndex((account) => account.id === targetGroupAccounts.at(-1)?.id)
      insertIndex = position === 'before' ? firstTargetIndex : lastTargetIndex + 1
    }
  }

  if (insertIndex === -1) {
    const sectionAccounts = nextAccounts.filter((account) => account.isBanned === sourceIsBanned)
    const fallbackTarget = position === 'before' ? sectionAccounts[0] : sectionAccounts.at(-1)
    if (!fallbackTarget) {
      accounts.value = sourceIsBanned
        ? [...nextAccounts.filter((account) => !account.isBanned), ...sourceGroupAccounts]
        : [...sourceGroupAccounts, ...nextAccounts.filter((account) => account.isBanned)]
    } else {
      const fallbackIndex = nextAccounts.findIndex((account) => account.id === fallbackTarget.id)
      insertIndex = position === 'before' ? fallbackIndex : fallbackIndex + 1
    }
  }

  if (insertIndex !== -1) {
    nextAccounts.splice(insertIndex, 0, ...sourceGroupAccounts)
    accounts.value = nextAccounts
  }

  if (!activeRoleSort.value) {
    syncCustomAccountOrderFromAccounts()
  }
  schedulePersistAppStorage()
}

const isInteractiveDragTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('button, input'))
}

const buildAccountDragLayout = () => accounts.value.map((account) => {
  const element = dragElements.get(account.id) ?? document.querySelector<HTMLElement>(`[data-bar-id="${account.id}"]`)
  const rect = element?.getBoundingClientRect()

  return {
    accountId: account.id,
    top: rect?.top ?? 0,
    height: rect?.height ?? 0
  }
})

const updateDragTarget = (clientY: number) => {
  if (!import.meta.client || !draggedAccountId.value) {
    return
  }

  const draggedAccount = accounts.value.find((account) => account.id === draggedAccountId.value)
  if (!draggedAccount) {
    return
  }

  const barElements = dragLayout.value.filter((entry) => {
    if (entry.accountId === draggedAccountId.value) {
      return false
    }

    const account = accounts.value.find((candidate) => candidate.id === entry.accountId)
    return account?.isBanned === draggedAccount.isBanned
  })
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
    dragLayout.value = buildAccountDragLayout()
  })
}

const syncGroupDragLayout = (section: 'normal' | 'banned') => {
  groupDragLayout.value = renderEntries.value.flatMap((entry) => {
    if (
      (entry.kind === 'group-block' && (entry.isBanned ? 'banned' : 'normal') !== section)
      || (entry.kind === 'account' && section !== (entry.account.isBanned ? 'banned' : 'normal'))
      || entry.kind === 'banned-divider'
    ) {
      return []
    }

    const groupExists = entry.kind === 'account' && accountGroups.value.some((group) => group.id === entry.account.groupId)
    if (entry.kind === 'account' && groupExists) {
      return []
    }

    const element = groupDragElements.get(entry.key) ?? document.querySelector<HTMLElement>(
      entry.kind === 'group-block'
        ? `[data-group-entry-key="${entry.key}"]`
        : `[data-bar-id="${entry.account.id}"]`
    )
    const rect = element?.getBoundingClientRect()
    return [{
      entryKey: entry.key,
      groupId: entry.kind === 'group-block' ? entry.group.id : '',
      section,
      targetKind: entry.kind === 'group-block' ? 'group' : 'account',
      accountId: entry.kind === 'account' ? entry.account.id : null,
      top: rect?.top ?? 0,
      height: rect?.height ?? 0
    }]
  })
}

const createGroupDragClone = (sourceElement: HTMLElement, sourceRect: DOMRect, event: PointerEvent) => {
  groupDragSourceElement = sourceElement
  groupDragCloneElement = sourceElement.cloneNode(true) as HTMLElement
  const cloneScale = currentUiScale.value
  const pointerOffsetY = event.clientY - sourceRect.top
  groupDragCloneElement.style.position = 'fixed'
  groupDragCloneElement.style.left = `${sourceRect.left}px`
  groupDragCloneElement.style.top = `${event.clientY - pointerOffsetY}px`
  groupDragCloneElement.style.width = `${sourceRect.width / cloneScale}px`
  groupDragCloneElement.style.height = `${sourceRect.height / cloneScale}px`
  groupDragCloneElement.style.zIndex = '60'
  groupDragCloneElement.style.pointerEvents = 'none'
  groupDragCloneElement.style.margin = '0'
  groupDragCloneElement.style.opacity = '1'
  groupDragCloneElement.style.boxShadow = '0 12px 24px rgba(0,0,0,0.28)'
  groupDragCloneElement.style.transition = 'none'
  groupDragCloneElement.style.transformOrigin = 'top left'
  groupDragCloneElement.style.transform = `scale(${cloneScale})`
  document.body.appendChild(groupDragCloneElement)
  groupDragSourceElement.style.opacity = '0'
}

const updateGroupDragTarget = (clientY: number) => {
  if (!import.meta.client || !groupPointerDrag.value || !draggedGroupEntryKey.value) {
    return
  }

  const barElements = groupDragLayout.value.filter((entry) => (
    entry.entryKey !== groupPointerDrag.value?.entryKey
    && entry.section === groupPointerDrag.value?.section
  ))
  if (barElements.length === 0) {
    return
  }

  let targetEntry = barElements[barElements.length - 1]
  let position: 'before' | 'after' = 'after'

  for (const entry of barElements) {
    const { top, height } = entry
    const midpoint = top + (height / 2)
    if (clientY < midpoint) {
      targetEntry = entry
      position = 'before'
      break
    }
  }

  moveGroupBlock(
    groupPointerDrag.value.groupId,
    groupPointerDrag.value.section,
    targetEntry.targetKind === 'group'
      ? { kind: 'group', groupId: targetEntry.groupId }
      : { kind: 'account', accountId: targetEntry.accountId ?? -1 },
    position
  )
  nextTick(() => {
    if (groupPointerDrag.value) {
      syncGroupDragLayout(groupPointerDrag.value.section)
    }
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

const resetGroupDragState = () => {
  if (import.meta.client) {
    document.removeEventListener('pointermove', handleWindowGroupPointerMove)
    document.removeEventListener('pointerup', handleWindowGroupPointerUp)
    document.removeEventListener('pointercancel', handleWindowGroupPointerUp)
  }

  for (const element of groupDragElements.values()) {
    element.style.opacity = ''
  }
  if (groupDragSourceElement) {
    groupDragSourceElement.style.opacity = ''
  }

  if (groupDragCloneElement) {
    groupDragCloneElement.remove()
  }

  draggedGroupEntryKey.value = null
  groupPointerDrag.value = null
  groupDragLayout.value = []
  groupDragElements = new Map()
  groupDragCloneElement = null
  groupDragSourceElement = null
  if (groupDragPointerElement) {
    groupDragPointerElement.removeEventListener('pointermove', handleWindowGroupPointerMove)
    groupDragPointerElement.removeEventListener('pointerup', handleWindowGroupPointerUp)
    groupDragPointerElement.removeEventListener('pointercancel', handleWindowGroupPointerUp)
  }
  groupDragPointerElement = null
  pendingGroupPointerY = null
  if (import.meta.client && groupPointerFrameId !== null) {
    cancelAnimationFrame(groupPointerFrameId)
  }
  groupPointerFrameId = null
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
  const cloneScale = currentUiScale.value
  const pointerOffsetY = event.clientY - sourceRect.top
  dragCloneElement.style.position = 'fixed'
  dragCloneElement.style.left = `${sourceRect.left}px`
  dragCloneElement.style.top = `${event.clientY - pointerOffsetY}px`
  dragCloneElement.style.width = `${sourceRect.width / cloneScale}px`
  dragCloneElement.style.height = `${sourceRect.height / cloneScale}px`
  dragCloneElement.style.zIndex = '60'
  dragCloneElement.style.pointerEvents = 'none'
  dragCloneElement.style.margin = '0'
  dragCloneElement.style.opacity = '1'
  dragCloneElement.style.boxShadow = '0 12px 24px rgba(0,0,0,0.28)'
  dragCloneElement.style.transition = 'none'
  dragCloneElement.style.transformOrigin = 'top left'
  dragCloneElement.style.transform = `scale(${cloneScale})`
  document.body.appendChild(dragCloneElement)

  dragSourceElement.style.opacity = '0'
  pointerDrag.value = {
    accountId,
    pointerId: event.pointerId,
    startY: event.clientY,
    currentY: event.clientY,
    height: sourceRect.height,
    anchorOffsetY: sourceRect.height / 2,
    clonePointerOffsetY: pointerOffsetY
  }
  dragLayout.value = buildAccountDragLayout()
}

const handleGroupHeaderClick = (groupId: string, entryKey: string, event: MouseEvent) => {
  if (suppressGroupHeaderClickKey === entryKey) {
    suppressGroupHeaderClickKey = null
    event.preventDefault()
    return
  }

  if (isInteractiveDragTarget(event.target)) {
    return
  }

  toggleGroupCollapsed(groupId)
}

const handleGroupHeaderPointerDown = (groupId: string, entryKey: string, section: 'normal' | 'banned', event: PointerEvent) => {
  if (event.button !== 0 || isInteractiveDragTarget(event.target)) {
    return
  }

  commitActiveEditor()
  closeMenus()
  closeRankPicker()

  const sourceElement = ((event.currentTarget as HTMLElement | null)?.closest('[data-group-entry-key]')) as HTMLElement | null
  const sourceRect = sourceElement?.getBoundingClientRect()
  if (!sourceElement || !sourceRect) {
    return
  }

  groupDragElements = new Map(
    renderEntries.value.flatMap((entry) => {
      if (entry.kind !== 'group-block' || (entry.isBanned ? 'banned' : 'normal') !== section) {
        return []
      }

      const element = document.querySelector<HTMLElement>(`[data-group-entry-key="${entry.key}"]`)
      return element ? [[entry.key, element] as const] : []
    })
  )
  groupDragElements.set(entryKey, sourceElement)

  try {
    sourceElement.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture is optional; drag still works if the browser rejects it.
  }
  document.addEventListener('pointermove', handleWindowGroupPointerMove)
  document.addEventListener('pointerup', handleWindowGroupPointerUp)
  document.addEventListener('pointercancel', handleWindowGroupPointerUp)
  sourceElement.addEventListener('pointermove', handleWindowGroupPointerMove)
  sourceElement.addEventListener('pointerup', handleWindowGroupPointerUp)
  sourceElement.addEventListener('pointercancel', handleWindowGroupPointerUp)
  groupDragPointerElement = sourceElement

  groupPointerDrag.value = {
    groupId,
    entryKey,
    section,
    pointerId: event.pointerId,
    startY: event.clientY,
    currentY: event.clientY,
    height: sourceRect.height,
    anchorOffsetY: sourceRect.height / 2,
    clonePointerOffsetY: event.clientY - sourceRect.top,
    sourceRect
  }
  syncGroupDragLayout(section)
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
      dragCloneElement.style.top = `${pointerDrag.value.currentY - pointerDrag.value.clonePointerOffsetY}px`
    }
  })
}

const handleWindowGroupPointerMove = (event: PointerEvent) => {
  if (!groupPointerDrag.value || event.pointerId !== groupPointerDrag.value.pointerId) {
    return
  }

  event.preventDefault()
  pendingGroupPointerY = event.clientY

  if (groupPointerFrameId !== null) {
    return
  }

  groupPointerFrameId = requestAnimationFrame(() => {
    groupPointerFrameId = null

    if (!groupPointerDrag.value || pendingGroupPointerY === null) {
      return
    }

    groupPointerDrag.value.currentY = pendingGroupPointerY

    if (!draggedGroupEntryKey.value && Math.abs(groupPointerDrag.value.currentY - groupPointerDrag.value.startY) > 6) {
      draggedGroupEntryKey.value = groupPointerDrag.value.entryKey
      suppressGroupHeaderClickKey = groupPointerDrag.value.entryKey
      const sourceElement = groupDragElements.get(groupPointerDrag.value.entryKey)
      if (sourceElement) {
        createGroupDragClone(sourceElement, groupPointerDrag.value.sourceRect, event)
      }
    }

    if (!draggedGroupEntryKey.value) {
      return
    }

    const dragAnchorY = (groupPointerDrag.value.currentY - groupPointerDrag.value.anchorOffsetY) + (groupPointerDrag.value.height / 2)
    updateGroupDragTarget(dragAnchorY)
    if (groupDragCloneElement) {
      groupDragCloneElement.style.top = `${groupPointerDrag.value.currentY - groupPointerDrag.value.clonePointerOffsetY}px`
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

const handleWindowGroupPointerUp = (event: PointerEvent) => {
  if (!groupPointerDrag.value || event.pointerId !== groupPointerDrag.value.pointerId) {
    return
  }

  try {
    groupDragSourceElement?.releasePointerCapture(event.pointerId)
  } catch {
    // Ignore browsers that do not keep pointer capture active here.
  }
  resetGroupDragState()
}

const addRow = () => {
  const nextId = Math.max(0, ...accounts.value.map((account) => account.id)) + 1
  const nextAccount = buildEmptyAccount(nextId)
  const firstBannedIndex = accounts.value.findIndex((account) => account.isBanned)
  if (firstBannedIndex === -1) {
    accounts.value.push(nextAccount)
  } else {
    accounts.value.splice(firstBannedIndex, 0, nextAccount)
  }
  activeRoleSort.value = null
  syncCustomAccountOrderFromAccounts()
}

const removeBar = async (accountId: number) => {
  if (accounts.value.length <= 1) {
    return
  }

  accounts.value = accounts.value.filter((account) => account.id !== accountId)
  customAccountOrderIds.value = customAccountOrderIds.value.filter((id) => id !== accountId)
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  }
  closeAccountContextMenu()
  closeDeleteAccountModal()
  if (rankPicker.value?.accountId === accountId) {
    closeRankPicker()
  }
}

const copyAccountName = async (accountName: string) => {
  try {
    await writeClipboardText(accountName)
    pushNotification('Battletag copied', {
      message: accountName,
      kind: 'success'
    })
  } catch {
    pushNotification('Copy failed', {
      message: 'The browser blocked clipboard access.',
      kind: 'error',
      duration: 3200
    })
  }
}

const refreshSingleAccountRank = async (accountId: number) => {
  if (!import.meta.client || rankRefreshBusy.value) {
    return
  }

  const account = accounts.value.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }

  const playerId = buildOwApiPlayerId(account.accountName)
  if (!playerId) {
    pushNotification('Invalid Battletag', {
      message: 'Use `Name#1234`.',
      kind: 'error',
      duration: 2800
    })
    return
  }

  rankRefreshBusy.value = true
  closeAccountContextMenu()
  const loadingNotificationId = pushNotification('Refreshing rank...', {
    message: getDisplayAccountName(account.accountName),
    kind: 'loading',
    duration: 0,
    showTimer: false
  })

  try {
    const profileResult = await fetchOwApiProfile(playerId)
    if (profileResult.kind !== 'success') {
      updateNotification(loadingNotificationId, {
        title: profileResult.kind === 'not_found'
          ? 'Battletag not found'
          : profileResult.kind === 'private'
            ? 'Profile is private'
            : 'Rank refresh failed',
        message: profileResult.kind === 'not_found'
          ? `${getDisplayAccountName(account.accountName)} was not found.`
          : profileResult.kind === 'private'
            ? `${getDisplayAccountName(account.accountName)} is private.`
            : profileResult.message,
        kind: profileResult.kind === 'private' ? 'info' : 'error',
        duration: 3600,
        showTimer: false
      })
      return
    }

    const ratingsPayload = getOwApiRatings(profileResult.payload)
    let hasVisibleRankData = false
    let preservedPredictedCount = 0
    let rankChanged = false

    for (const rank of account.ranks) {
      const previousTier = rank.tier
      const previousDivision = rank.division
      const previousPredicted = rank.predicted
      const visibleRank = getOwApiVisibleRank(ratingsPayload, OWAPI_ROLE_KEYS[rank.role as 'T' | 'D' | 'S'])
      if (visibleRank) {
        hasVisibleRankData = true
      }
      const appliedState = applyVisibleOrPredictedRank(rank, visibleRank)
      if (appliedState === 'predicted') {
        preservedPredictedCount += 1
      }
      if (
        rank.tier !== previousTier
        || rank.division !== previousDivision
        || rank.predicted !== previousPredicted
      ) {
        rankChanged = true
      }
    }

    if (rankChanged) {
      markAccountRankModified(account)
    }

    if (!hasVisibleRankData) {
      updateNotification(loadingNotificationId, {
        title: 'No visible rank data',
        message: preservedPredictedCount > 0
          ? `Kept ${preservedPredictedCount} predicted rank${preservedPredictedCount === 1 ? '' : 's'}.`
          : `${getDisplayAccountName(account.accountName)} has no visible ranks.`,
        kind: 'info',
        duration: 3200,
        showTimer: false
      })
      return
    }

    updateNotification(loadingNotificationId, {
      title: 'Rank refreshed',
      message: preservedPredictedCount > 0
        ? `Updated. Kept ${preservedPredictedCount} predicted rank${preservedPredictedCount === 1 ? '' : 's'}.`
        : `${getDisplayAccountName(account.accountName)} updated.`,
      kind: 'success',
      duration: 3200,
      showTimer: false
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The request failed.'
    updateNotification(loadingNotificationId, {
      title: 'Rank refresh failed',
      message,
      kind: 'error',
      duration: 3200,
      showTimer: false
    })
  } finally {
    rankRefreshBusy.value = false
  }
}

const legacyCopyAccountCredential = async (accountId: number, field: 'email' | 'password') => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  const value = field === 'email' ? account?.email ?? '' : account?.password ?? ''

  if (!value) {
    pushNotification(`No ${field} saved`, {
      message: `Add ${field} details for ${getAccountNameForDisplay(accountId)} first.`,
      kind: 'error',
      duration: 3200
    })
    return
  }

  try {
    await writeClipboardText(value)
    scheduleClipboardExpiry(field, value)
    const clearDurationMs = getClipboardClearDurationMs()
    pushNotification(`${field === 'email' ? 'Email' : 'Password'} copied`, {
    message: `${getAccountNameForDisplay(accountId)} · clears in 3s`,
    kind: 'success',
    duration: 3000,
    showTimer: field === 'email' || field === 'password'
  })
  } catch {
    pushNotification('Copy failed', {
      message: 'The browser blocked clipboard access.',
      kind: 'error',
      duration: 3200
    })
  }
}

const copyAccountCredential = async (accountId: number, field: 'email' | 'password') => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  const value = field === 'email' ? account?.email ?? '' : account?.password ?? ''

  if (!value) {
    pushNotification(`No ${field} saved`, {
      message: `Add ${field} details for ${getAccountNameForDisplay(accountId)} first.`,
      kind: 'error',
      duration: 3200
    })
    return
  }

  try {
    await writeClipboardText(value)
    scheduleClipboardExpiry(field, value)
    const clearDurationMs = getClipboardClearDurationMs()
    pushNotification(`${field === 'email' ? 'Email' : 'Password'} copied`, {
      message: clearDurationMs === null
        ? `${getAccountNameForDisplay(accountId)} - will not auto-clear`
        : `${getAccountNameForDisplay(accountId)} - clears in ${clipboardClearTimerSeconds.value}s`,
      kind: 'success',
      duration: clearDurationMs ?? 3000,
      showTimer: clearDurationMs !== null
    })
  } catch {
    pushNotification('Copy failed', {
      message: 'The browser blocked clipboard access.',
      kind: 'error',
      duration: 3200
    })
  }
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

    const nextPredicted = pickerTier.value === 'Unranked' ? false : pickerPredicted.value
    const didChange = (
      rank.tier !== pickerTier.value
      || rank.division !== pickerDivision.value
      || rank.predicted !== nextPredicted
    )
    rank.tier = pickerTier.value
    rank.division = pickerDivision.value
    rank.predicted = nextPredicted
    if (didChange) {
      markAccountRankModified(account)
    }
  } else {
    const nextPredicted = pickerTier.value === 'Unranked' ? false : pickerPredicted.value
    const didChange = (
      account.sixV6Rank.tier !== pickerTier.value
      || account.sixV6Rank.division !== pickerDivision.value
      || account.sixV6Rank.predicted !== nextPredicted
    )
    account.sixV6Rank.tier = pickerTier.value
    account.sixV6Rank.division = pickerDivision.value
    account.sixV6Rank.predicted = nextPredicted
    if (didChange) {
      markAccountRankModified(account)
    }
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

onBeforeUnmount(() => {
  notificationTimeouts.forEach((timeoutHandle) => {
    clearTimeout(timeoutHandle)
  })
  notificationTimeouts.clear()
  clipboardExpiryTimeouts.forEach((timeoutHandle) => {
    clearTimeout(timeoutHandle)
  })
  clipboardExpiryTimeouts.clear()
})
</script>

<style>
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

.rank-division-number,
.rank-picker-division-number {
  font-family: 'RankBadgeNumber', sans-serif;
  font-size: calc((var(--rank-number-font-size, 24) + var(--rank-number-platform-font-adjust, 0) + 1.5) * 1px);
}

.rank-badge-number {
  transform: translate(
    calc(-50% + ((var(--rank-number-offset-x, 0) + var(--rank-number-platform-offset-x, 0)) * 1px)),
    calc(-50% + ((var(--rank-number-offset-y, 0) + var(--rank-number-platform-offset-y, 0) + 1.5) * 1px))
  );
}

.rank-badge-button {
  isolation: isolate;
}

.rank-badge-shine {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
  mix-blend-mode: screen;
  -webkit-mask-image: var(--rank-badge-mask-image);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-image: var(--rank-badge-mask-image);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.rank-badge-shine::before {
  content: '';
  position: absolute;
  inset: -28% -42%;
  opacity: 0;
  transform: translateX(-160%) rotate(16deg);
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(255, 255, 255, 0.04) 42%,
      rgba(255, 255, 255, 0.26) 48%,
      rgba(255, 255, 255, 0.55) 52%,
      rgba(255, 255, 255, 0.22) 57%,
      transparent 65%,
      transparent 100%
    );
}

.rank-badge-shine-grandmaster .rank-badge-shine::before {
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(225, 196, 255, 0.06) 42%,
      rgba(182, 118, 255, 0.28) 48%,
      rgba(244, 235, 255, 0.58) 52%,
      rgba(152, 94, 255, 0.3) 57%,
      transparent 65%,
      transparent 100%
    );
  animation: rank-badge-shine-sweep 4.2s ease-in-out infinite;
}

.rank-badge-shine-champion .rank-badge-shine::before {
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(255, 212, 238, 0.06) 42%,
      rgba(255, 142, 205, 0.3) 48%,
      rgba(255, 240, 247, 0.62) 52%,
      rgba(255, 102, 186, 0.32) 57%,
      transparent 65%,
      transparent 100%
    );
  animation: rank-badge-shine-sweep-bounce 4.2s ease-in-out infinite;
}

.rank-badge-sparkles {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  --rank-badge-sparkle-color: rgba(255, 255, 255, 0.55);
}

.rank-badge-sparkles::before,
.rank-badge-sparkles::after {
  content: '';
  position: absolute;
  width: 11px;
  height: 11px;
  opacity: 0;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 20%, transparent 62%),
    linear-gradient(transparent 44%, var(--rank-badge-sparkle-color) 44%, var(--rank-badge-sparkle-color) 56%, transparent 56%),
    linear-gradient(90deg, transparent 44%, var(--rank-badge-sparkle-color) 44%, var(--rank-badge-sparkle-color) 56%, transparent 56%);
  filter: drop-shadow(0 0 4px var(--rank-badge-sparkle-color));
  transform: scale(0.55) rotate(0deg);
}

.rank-badge-sparkles::before {
  top: 10px;
  left: 18px;
  animation: rank-badge-sparkle-twinkle 2.4s ease-in-out infinite;
}

.rank-badge-sparkles::after {
  top: 7px;
  right: 21px;
  width: 8px;
  height: 8px;
  animation: rank-badge-sparkle-twinkle 2.4s ease-in-out 1.15s infinite;
}

.rank-badge-sparkles-secondary::before {
  top: 16px;
  left: 47px;
  width: 9px;
  height: 9px;
  animation-delay: 0.55s;
}

.rank-badge-sparkles-secondary::after {
  top: 12px;
  right: 43px;
  width: 7px;
  height: 7px;
  animation-delay: 1.65s;
}

.rank-badge-sparkle-master .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(134, 255, 171, 0.65);
}

.rank-badge-sparkle-grandmaster .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(190, 128, 255, 0.68);
}

.rank-badge-sparkle-champion .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(255, 135, 208, 0.68);
}

.rank-picker-division-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translate(
    calc((var(--rank-number-offset-x, 0) + var(--rank-number-platform-offset-x, 0)) * 1px),
    calc((var(--rank-number-offset-y, 0) + var(--rank-number-platform-offset-y, 0)) * 1px)
  );
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

.bar-list-leave-active {
  position: absolute;
  width: 100%;
  transition:
    transform 150ms ease-out,
    opacity 140ms ease-out;
  pointer-events: none;
  will-change: transform, opacity;
}

.bar-list-leave-to {
  opacity: 0;
  transform: translate3d(10px, 0, 0) scale(0.992);
}

.account-list-viewport {
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.account-list-viewport::-webkit-scrollbar {
  width: 0;
  height: 0;
}

input::-ms-reveal,
input::-ms-clear {
  display: none;
}

input::-webkit-credentials-auto-fill-button {
  visibility: hidden;
  pointer-events: none;
  position: absolute;
  right: 0;
}

.lead-buttons-viewport {
  overflow: clip;
  overflow-clip-margin: 100vw;
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.content-slide {
  will-change: transform;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.bar-shell {
  overflow: clip;
  overflow-clip-margin: 100vw;
}

.row-main-shell {
  will-change: left, width;
  transition:
    left 260ms cubic-bezier(0.22, 1, 0.36, 1),
    width 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.top-bar-anchored {
  will-change: transform, width;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    width 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.toast-list-leave-active {
  position: absolute;
  right: 0;
  width: 100%;
}

.toast-list-enter-from,
.toast-list-leave-to {
  opacity: 0;
}

.toast-list-enter-from {
  transform: translate3d(0, -14px, 0);
}

.toast-list-leave-to {
  transform: translate3d(0, 0, 0);
}

.toast-timer {
  animation-name: toast-timer-drain;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes toast-timer-drain {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

@keyframes rank-badge-shine-sweep {
  0%,
  10% {
    opacity: 0;
    transform: translateX(-160%) rotate(16deg);
  }

  16% {
    opacity: 0.85;
  }

  34% {
    opacity: 0.2;
    transform: translateX(155%) rotate(16deg);
  }

  58% {
    opacity: 0;
    transform: translateX(155%) rotate(16deg);
  }

  100% {
    opacity: 0;
    transform: translateX(155%) rotate(16deg);
  }
}

@keyframes rank-badge-shine-sweep-bounce {
  0%,
  8% {
    opacity: 0;
    transform: translateX(-160%) rotate(16deg);
  }

  14% {
    opacity: 0.88;
  }

  28% {
    opacity: 0.26;
    transform: translateX(150%) rotate(16deg);
  }

  36% {
    opacity: 0.74;
  }

  52% {
    opacity: 0.18;
    transform: translateX(-145%) rotate(16deg);
  }

  62%,
  100% {
    opacity: 0;
    transform: translateX(-145%) rotate(16deg);
  }
}

@keyframes rank-badge-sparkle-twinkle {
  0%,
  58%,
  100% {
    opacity: 0;
    transform: scale(0.55) rotate(0deg);
  }

  66% {
    opacity: 0.72;
    transform: scale(1) rotate(12deg);
  }

  76% {
    opacity: 0.22;
    transform: scale(0.78) rotate(20deg);
  }
}
</style>
