<template>
  <div
    class="h-screen overflow-hidden bg-[#0b0d13] text-slate-100"
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
          <div
            class="content-slide w-fit"
            :style="{ minWidth: fullGridWidth, transform: `translate3d(${contentTranslateX}, 0, 0)` }"
          >
          <section class="mb-3 grid gap-3" :style="{ gridTemplateColumns: rowColumns }">
            <div
              class="top-bar-anchored col-span-2 h-11 rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 flex items-center justify-between gap-3"
              :style="{ width: topBarWidth, transform: `translate3d(${topBarOffsetX}, 0, 0)` }"
            >
              <div class="flex min-w-0 items-center gap-1.5">
                <img :src="overwatchIcon" alt="Overwatch" class="h-6 w-6 object-contain">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center text-slate-100/90 hover:bg-[#181c26]"
                  :aria-label="showLeadButtons ? 'Hide lead buttons' : 'Show lead buttons'"
                  @click.stop="toggleLeadButtons"
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
                  @click.stop="toggleSettingsMenu"
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
                  @click="cycleRoleSort(roleHeader.index)"
                  @contextmenu.prevent="restoreCustomRoleSort(roleHeader.index)"
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

          <div ref="accountListViewport" class="account-list-viewport min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <TransitionGroup tag="section" name="bar-list" class="space-y-4 pb-[20px]">
              <div
                v-if="bannedAccounts.length > 0 && normalAccounts.length === 0"
                key="banned-divider-top"
                class="relative h-10"
                :style="{ width: fullGridWidth }"
              >
                <div class="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
                  <div class="h-px flex-1 bg-[#4a2630]" />
                  <span class="rounded-full border border-[#4a2630] bg-[#221018] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/90">
                    Banned Accounts
                  </span>
                  <div class="h-px flex-1 bg-[#4a2630]" />
                </div>
              </div>
              <template v-for="account in accounts" :key="account.id">
              <article
                :data-bar-id="account.id"
                class="bar-shell relative h-16 cursor-grab touch-none select-none"
                :class="[draggedAccountId === account.id ? 'cursor-grabbing' : '']"
                :style="{ width: fullGridWidth }"
                @pointerdown="handleBarPointerDown(account.id, $event)"
              >
              <div class="absolute inset-y-0 left-0 z-0 overflow-hidden" :style="{ width: `${leadColumnWidth}px` }">
                <div class="flex h-full items-center pl-0 pr-0">
                  <div
                    class="flex w-full items-center justify-center gap-0 transition-[opacity,transform,filter] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    :class="showLeadButtons ? 'translate-x-0 opacity-100 blur-0' : 'translate-x-4 opacity-0 blur-[2px]'"
                  >
                    <button
                      type="button"
                      class="inline-flex h-[56px] w-[46px] items-center justify-center rounded-l-[12px] rounded-r-none border border-r-0 border-[#323744] bg-[#0d1118] text-slate-100/78"
                      title="Copy email"
                      @click.stop="copyAccountCredential(account.id, 'email')"
                    >
                      <User class="h-[22px] w-[22px] translate-y-[0.5px]" :stroke-width="2.25" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-[56px] w-[46px] items-center justify-center rounded-r-[12px] rounded-l-none border border-[#323744] bg-[#0d1118] text-slate-100/78"
                      title="Copy password"
                      @click.stop="copyAccountCredential(account.id, 'password')"
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
                <div class="min-w-0 flex items-center gap-3 px-2.5" @contextmenu.prevent.stop="openAccountContextMenu(account.id, $event)">
                  <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-[#323744] text-slate-100/90 hover:bg-[#181c26]" title="Copy battletag" @click="copyAccountName(account.accountName)"><img :src="battlenetIcon" alt="Copy battletag" class="h-9 w-9 object-contain" draggable="false"></button>
                  <div class="min-w-0 flex-1">
                    <input v-if="isEditingName(account.id)" :data-editor-id="getEditorId(activeEditor)" v-model="activeEditorValue" type="text" class="h-auto w-full border-b border-slate-400/80 bg-transparent px-0 pb-0.5 text-[24px] font-semibold leading-none text-slate-100 outline-none" @blur="commitActiveEditor" @click.stop @keydown.enter.prevent="commitActiveEditor" @keydown.esc.prevent="cancelActiveEditor">
                    <span v-else class="truncate text-[24px] font-semibold text-slate-100">{{ getDisplayAccountName(account.accountName) }}</span>
                  </div>
                </div>
                <div class="role-rank-column h-full px-2" @contextmenu.prevent.stop="openAccountContextMenu(account.id, $event)">
                  <div class="role-lane role-lane-body">
                    <div v-for="(rank, rankIndex) in account.ranks" :key="`${account.id}-${rank.role}`" class="flex items-center justify-center">
                      <button type="button" class="rank-badge-button relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="[rank.predicted ? 'opacity-[0.35]' : rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100', getRankBadgeShineClass(rank.tier), getRankBadgeSparkleClass(rank.tier)]" :style="getRankBadgeMaskStyle(rank.tier)" @click="openRankPicker(account.id, rankIndex, $event)">
                        <img :src="rankIcons[rank.tier]" :alt="`${rank.tier} ${rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                        <span v-if="hasRankBadgeShine(rank.tier)" class="rank-badge-shine" aria-hidden="true" />
                        <span v-if="hasRankBadgeSparkles(rank.tier)" class="rank-badge-sparkles" aria-hidden="true" />
                        <span v-if="hasRankBadgeExtraSparkles(rank.tier)" class="rank-badge-sparkles rank-badge-sparkles-secondary" aria-hidden="true" />
                        <span v-if="rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] rank-badge-number rank-division-number">{{ rank.division }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="showSixV6" class="sixv6-rank-column h-full px-2" @contextmenu.prevent.stop="openAccountContextMenu(account.id, $event)">
                  <div class="single-rank-lane">
                    <button type="button" class="rank-badge-button relative h-[45.6px] w-[106.4px] overflow-hidden rounded-[2px] transition hover:brightness-110" :class="[account.sixV6Rank.predicted ? 'opacity-[0.35]' : account.sixV6Rank.tier === 'Unranked' ? 'opacity-50' : 'opacity-100', getRankBadgeShineClass(account.sixV6Rank.tier), getRankBadgeSparkleClass(account.sixV6Rank.tier)]" :style="getRankBadgeMaskStyle(account.sixV6Rank.tier)" @click="openSixV6Picker(account.id, $event)">
                      <img :src="rankIcons[account.sixV6Rank.tier]" :alt="`${account.sixV6Rank.tier} ${account.sixV6Rank.division}`" class="h-full w-full object-contain [image-rendering:-webkit-optimize-contrast]" draggable="false">
                      <span v-if="hasRankBadgeShine(account.sixV6Rank.tier)" class="rank-badge-shine" aria-hidden="true" />
                      <span v-if="hasRankBadgeSparkles(account.sixV6Rank.tier)" class="rank-badge-sparkles" aria-hidden="true" />
                      <span v-if="hasRankBadgeExtraSparkles(account.sixV6Rank.tier)" class="rank-badge-sparkles rank-badge-sparkles-secondary" aria-hidden="true" />
                      <span v-if="account.sixV6Rank.tier !== 'Unranked'" class="absolute left-[76.5%] top-[calc(45%+1px)] rank-badge-number rank-division-number">{{ account.sixV6Rank.division }}</span>
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
              </div>
              </article>
              <div
                v-if="shouldRenderBannedDividerAfter(account.id)"
                :key="`banned-divider-${account.id}`"
                class="relative h-10"
                :style="{ width: fullGridWidth }"
              >
                <div class="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
                  <div class="h-px flex-1 bg-[#4a2630]" />
                  <span class="rounded-full border border-[#4a2630] bg-[#221018] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/90">
                    Banned Accounts
                  </span>
                  <div class="h-px flex-1 bg-[#4a2630]" />
                </div>
              </div>
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

    <div class="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100vw-24px))] justify-end">
      <TransitionGroup name="toast-list" tag="div" class="flex w-full flex-col items-end gap-2">
        <div
          v-for="toast in notifications"
          :key="toast.id"
          class="pointer-events-auto relative w-full rounded-[10px] border bg-[#070a11]/96 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
          :class="toast.kind === 'error' ? 'border-[#73313c] text-rose-100' : toast.kind === 'success' ? 'border-[#29493c] text-emerald-100' : 'border-[#323744] text-slate-100'"
        >
          <button
            type="button"
            class="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-slate-400/80 transition hover:bg-white/5 hover:text-slate-100"
            aria-label="Dismiss notification"
            @click="removeNotification(toast.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
          <p class="text-[14px] font-semibold leading-[1.3]">{{ toast.title }}</p>
          <p v-if="toast.message" class="mt-1 text-[12px] leading-[1.35] text-slate-300/90">{{ toast.message }}</p>
          <div v-if="toast.showTimer" class="mt-2 h-[2px] overflow-hidden rounded-full bg-white/10">
            <div
              class="toast-timer h-full origin-left"
              :class="toast.kind === 'error' ? 'bg-rose-300/80' : toast.kind === 'success' ? 'bg-emerald-300/80' : 'bg-slate-300/80'"
              :style="{ animationDuration: `${toast.duration}ms` }"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>

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

        <input
          ref="importFileInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="handleImportData"
        >

        <div class="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500/55">
          made by merk - beta 1.0
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

    <div
      v-if="accountContextMenu"
      class="fixed inset-0 z-[70]"
      @click="closeAccountContextMenu"
      @contextmenu.prevent="closeAccountContextMenu"
    >
      <div
        class="absolute min-w-[180px] rounded-[10px] border border-[#323744] bg-[#0c1018] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
        :style="accountContextMenuPositionStyle"
        @click.stop
        @contextmenu.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
          @click="requestEditBattletag(accountContextMenu.accountId)"
        >
          <PencilLine class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
          Edit Battletag
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
          @click="requestEditCredentials(accountContextMenu.accountId)"
        >
          <ShieldEllipsis class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
          Edit Credentials
        </button>
        <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-slate-100/92 transition hover:bg-[#181c26]"
          @click="requestAccountInfo(accountContextMenu.accountId)"
        >
          <IdCard class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
          Account Info
        </button>
        <div class="mx-2 my-1 h-px bg-[#272b35]" aria-hidden="true" />
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left text-[15px] font-semibold text-red-300 transition hover:bg-[#181c26]"
          @click="requestDeleteAccount(accountContextMenu.accountId)"
        >
          <Trash2 class="h-[15px] w-[15px] shrink-0" :stroke-width="2.2" aria-hidden="true" />
          Delete Account
        </button>
      </div>
    </div>

    <div
      v-if="deleteAccountModal"
      class="fixed inset-0 z-[80] bg-black/60"
      @click="closeDeleteAccountModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Delete Account</h2>
        <p class="mt-3 text-[13px] leading-5 text-slate-300">
          Delete
          <span class="font-semibold text-slate-100">{{ getAccountNameForDisplay(deleteAccountModal.accountId) }}</span>
          permanently?
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeDeleteAccountModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-rose-400/20 bg-rose-500/15 px-4 text-[13px] font-semibold text-rose-100 hover:bg-rose-500/25"
            @click="confirmDeleteAccount"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="credentialsModal"
      class="fixed inset-0 z-[85] bg-black/60"
      @click="closeCredentialsModal"
    >
      <div
        class="absolute left-1/2 top-1/2 w-[380px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[#323744] bg-[#0c1018] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        @click.stop
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-[16px] font-semibold tracking-tight text-slate-100">Edit Credentials</h2>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close credentials editor"
            @click="closeCredentialsModal"
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
        <p class="mb-4 text-[17px] text-slate-300">
          {{ getAccountNameForDisplay(credentialsModal.accountId) }}
        </p>
        <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">
          Email
        </label>
        <div class="relative mt-2">
          <input
            v-model="credentialsEmailDraft"
            :type="credentialsEmailVisible ? 'text' : 'password'"
            class="h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-11 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
            placeholder="Enter email"
          >
          <button
            type="button"
            class="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400/80 hover:text-slate-100"
            :aria-label="credentialsEmailVisible ? 'Hide email' : 'Show email'"
            @click="credentialsEmailVisible = !credentialsEmailVisible"
          >
            <Eye
              v-if="credentialsEmailVisible"
              class="h-[16.5px] w-[16.5px]"
              :stroke-width="2.1"
              aria-hidden="true"
            />
            <EyeOff
              v-else
              class="h-[16.5px] w-[16.5px]"
              :stroke-width="2.1"
              aria-hidden="true"
            />
          </button>
        </div>
        <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">
          Password
        </label>
        <div class="relative mt-2">
          <input
            v-model="credentialsPasswordDraft"
            :type="credentialsPasswordVisible ? 'text' : 'password'"
            class="h-11 w-full rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-11 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
            placeholder="Enter password"
          >
          <button
            type="button"
            class="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400/80 hover:text-slate-100"
            :aria-label="credentialsPasswordVisible ? 'Hide password' : 'Show password'"
            @click="credentialsPasswordVisible = !credentialsPasswordVisible"
          >
            <Eye
              v-if="credentialsPasswordVisible"
              class="h-[16.5px] w-[16.5px]"
              :stroke-width="2.1"
              aria-hidden="true"
            />
            <EyeOff
              v-else
              class="h-[16.5px] w-[16.5px]"
              :stroke-width="2.1"
              aria-hidden="true"
            />
          </button>
        </div>
        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeCredentialsModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-500/15 px-4 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-500/25"
            @click="saveCredentials"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="accountInfoModal"
      class="fixed inset-0 z-[86] bg-black/60"
      @click="closeAccountInfoModal"
    >
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
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-slate-100/80 hover:bg-[#181c26]"
            aria-label="Close account info"
            @click="closeAccountInfoModal"
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
        <p class="mb-4 break-all text-[17px] text-slate-300">
          {{ accounts.find((entry) => entry.id === accountInfoModal.accountId)?.accountName ?? 'Battletag' }}
        </p>
        <label class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">
          Country
        </label>
        <div class="mt-2 flex items-center gap-3">
          <div class="relative min-w-0 flex-1">
            <select
              v-model="accountInfoCountryDraft"
              class="h-11 w-full appearance-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 pr-10 text-[14px] text-slate-100 outline-none focus:border-slate-400/70"
            >
              <option value="">No country selected</option>
              <option
                v-for="option in accountCountryOptions"
                :key="option.code"
                :value="option.code"
              >
                {{ option.label }} ({{ option.dialCode }})
              </option>
            </select>
            <ChevronDown
              class="pointer-events-none absolute right-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-slate-400/80"
              :stroke-width="2.2"
              aria-hidden="true"
            />
          </div>
          <div class="flex h-11 w-[74px] shrink-0 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b]">
            <span
              v-if="getCountryOption(accountInfoCountryDraft)"
              :class="getFlagClass(accountInfoCountryDraft)"
              class="rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              :style="{ width: '34px', height: '27px' }"
              aria-hidden="true"
            />
            <span v-else class="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              
            </span>
          </div>
        </div>
        <p class="mt-4 text-[12px] leading-5 text-slate-400/80">
          Save the country tied to this Battle.net account so you know which phone number region to use if it needs to be verified again.
        </p>
        <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">
          Notes
        </label>
        <textarea
          v-model="accountInfoNotesDraft"
          rows="3"
          class="mt-2 min-h-[88px] w-full resize-none rounded-[8px] border border-[#272b35] bg-[#11141b] px-3 py-2.5 text-[14px] leading-5 text-slate-100 outline-none focus:border-slate-400/70"
          placeholder="Add notes for this account"
        />
        <div class="mx-0 mt-4 h-px bg-[#272b35]" aria-hidden="true" />
        <label class="mt-4 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400/80">
          Status
        </label>
        <button
          type="button"
          class="mt-2 flex w-full items-center justify-between rounded-[8px] border px-3 py-3 text-left transition"
          :class="accountInfoBannedDraft ? 'border-rose-500/40 bg-rose-500/12 text-rose-100' : 'border-[#272b35] bg-[#11141b] text-slate-100'"
          @click="accountInfoBannedDraft = !accountInfoBannedDraft"
        >
          <div class="min-w-0 flex-1 pr-4">
            <div class="text-[14px] font-semibold">
              {{ accountInfoBannedDraft ? 'Banned :(' : 'Clean :)' }}
            </div>
            <p class="mt-1 text-[12px] leading-5" :class="accountInfoBannedDraft ? 'text-rose-100/70' : 'text-slate-400/80'">
              Banned accounts stay in their own section.
              That way you know but dont have to delete them.
            </p>
          </div>
          <span
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-200"
            :class="accountInfoBannedDraft ? 'border-rose-300/60 bg-rose-400/70' : 'border-[#3b4150] bg-[#29303d]'"
            aria-hidden="true"
          >
            <span
              class="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-200"
              :style="{ transform: `translateX(${accountInfoBannedDraft ? 20 : 2}px)` }"
            />
          </span>
        </button>
        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#272b35] bg-[#11141b] px-4 text-[13px] font-semibold text-slate-100/90 hover:bg-[#181c26]"
            @click="closeAccountInfoModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-[8px] border border-emerald-400/20 bg-emerald-500/15 px-4 text-[13px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
            @click="saveAccountInfo"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke, isTauri } from '@tauri-apps/api/core'
import { clear as clearNativeClipboard, readText as readNativeClipboardText, writeText as writeNativeClipboardText } from '@tauri-apps/plugin-clipboard-manager'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronDown, ClipboardClock, Download, Eye, EyeOff, IdCard, Info, KeyRound, PencilLine, ShieldEllipsis, SlidersHorizontal, Trash2, Upload, User, ZoomIn } from 'lucide-vue-next'
import 'flag-icons/css/flag-icons.min.css'
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
import battlenetIcon from '~~/assets/Icons/Battlenet_Icon.png'
import mythicPrismsIcon from '~~/assets/Icons/MythicPrisms.png'
import overwatchCoinsIcon from '~~/assets/Icons/OverwatchCoins.png'
import overwatchCreditsIcon from '~~/assets/Icons/OverwatchCredits.png'
import competetivePointsIcon from '~~/assets/Icons/CompetetivePoints.png'
import legacyPointsIcon from '~~/assets/Icons/LegacyPoints.png'
import unrankedIcon from '~~/assets/Ranks/Rank_Icon_Unranked.png'

type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster' | 'Champion' | 'Unranked'
type RankEntry = { role: string; tier: RankTier; division: number; color: string; predicted: boolean }
type ModalOption = { key: string; icon: string; tier?: RankTier; predictedToggle?: boolean; dimmed?: boolean }
type NotificationToast = {
  id: number
  title: string
  message?: string
  kind: 'success' | 'error' | 'info'
  duration: number
  showTimer: boolean
}
type SecureCredentialPayload = {
  email: string
  password: string
}
type CountryOption = {
  code: string
  label: string
  dialCode: string
}
type RoleSortState = {
  roleIndex: number
  direction: 'desc' | 'asc'
}

const assetWarmupSources = [
  bronzeIcon,
  silverIcon,
  goldIcon,
  platinumIcon,
  diamondIcon,
  masterIcon,
  grandmasterIcon,
  championIcon,
  unrankedIcon,
  bronzeModalIcon,
  silverModalIcon,
  goldModalIcon,
  platinumModalIcon,
  diamondModalIcon,
  masterModalIcon,
  grandmasterModalIcon,
  championModalIcon,
  unrankedModalIcon,
  predictedModalIcon,
  tankRoleIcon,
  damageRoleIcon,
  supportRoleIcon,
  flexRoleIcon,
  overwatchIcon,
  battlenetIcon
] as const

useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/futura-no2-d-demi-bold.ttf', as: 'font', type: 'font/ttf', crossorigin: '' },
    ...assetWarmupSources.slice(0, 10).map((href) => ({ rel: 'preload', href, as: 'image' as const }))
  ]
})

type AccountRow = {
  id: number
  accountName: string
  email: string
  password: string
  countryCode: string
  isBanned: boolean
  notes: string
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
const accountCountryOptions: CountryOption[] = [
  { code: 'US', label: 'United States', dialCode: '+1' },
  { code: 'CA', label: 'Canada', dialCode: '+1' },
  { code: 'MX', label: 'Mexico', dialCode: '+52' },
  { code: 'AR', label: 'Argentina', dialCode: '+54' },
  { code: 'BR', label: 'Brazil', dialCode: '+55' },
  { code: 'CL', label: 'Chile', dialCode: '+56' },
  { code: 'CO', label: 'Colombia', dialCode: '+57' },
  { code: 'PE', label: 'Peru', dialCode: '+51' },
  { code: 'GB', label: 'United Kingdom', dialCode: '+44' },
  { code: 'IE', label: 'Ireland', dialCode: '+353' },
  { code: 'FR', label: 'France', dialCode: '+33' },
  { code: 'DE', label: 'Germany', dialCode: '+49' },
  { code: 'ES', label: 'Spain', dialCode: '+34' },
  { code: 'IT', label: 'Italy', dialCode: '+39' },
  { code: 'NL', label: 'Netherlands', dialCode: '+31' },
  { code: 'BE', label: 'Belgium', dialCode: '+32' },
  { code: 'LU', label: 'Luxembourg', dialCode: '+352' },
  { code: 'CH', label: 'Switzerland', dialCode: '+41' },
  { code: 'AT', label: 'Austria', dialCode: '+43' },
  { code: 'DK', label: 'Denmark', dialCode: '+45' },
  { code: 'SE', label: 'Sweden', dialCode: '+46' },
  { code: 'NO', label: 'Norway', dialCode: '+47' },
  { code: 'FI', label: 'Finland', dialCode: '+358' },
  { code: 'PL', label: 'Poland', dialCode: '+48' },
  { code: 'CZ', label: 'Czech Republic', dialCode: '+420' },
  { code: 'SK', label: 'Slovakia', dialCode: '+421' },
  { code: 'HU', label: 'Hungary', dialCode: '+36' },
  { code: 'RO', label: 'Romania', dialCode: '+40' },
  { code: 'BG', label: 'Bulgaria', dialCode: '+359' },
  { code: 'HR', label: 'Croatia', dialCode: '+385' },
  { code: 'SI', label: 'Slovenia', dialCode: '+386' },
  { code: 'RS', label: 'Serbia', dialCode: '+381' },
  { code: 'GR', label: 'Greece', dialCode: '+30' },
  { code: 'PT', label: 'Portugal', dialCode: '+351' },
  { code: 'TR', label: 'Turkey', dialCode: '+90' },
  { code: 'UA', label: 'Ukraine', dialCode: '+380' },
  { code: 'AU', label: 'Australia', dialCode: '+61' },
  { code: 'NZ', label: 'New Zealand', dialCode: '+64' },
  { code: 'JP', label: 'Japan', dialCode: '+81' },
  { code: 'KR', label: 'South Korea', dialCode: '+82' },
  { code: 'TW', label: 'Taiwan', dialCode: '+886' },
  { code: 'HK', label: 'Hong Kong', dialCode: '+852' },
  { code: 'MO', label: 'Macau', dialCode: '+853' },
  { code: 'SG', label: 'Singapore', dialCode: '+65' },
  { code: 'TH', label: 'Thailand', dialCode: '+66' },
  { code: 'PH', label: 'Philippines', dialCode: '+63' },
  { code: 'MY', label: 'Malaysia', dialCode: '+60' },
  { code: 'ID', label: 'Indonesia', dialCode: '+62' },
  { code: 'VN', label: 'Vietnam', dialCode: '+84' },
  { code: 'IN', label: 'India', dialCode: '+91' },
  { code: 'AE', label: 'United Arab Emirates', dialCode: '+971' },
  { code: 'SA', label: 'Saudi Arabia', dialCode: '+966' },
  { code: 'QA', label: 'Qatar', dialCode: '+974' },
  { code: 'KW', label: 'Kuwait', dialCode: '+965' },
  { code: 'BH', label: 'Bahrain', dialCode: '+973' },
  { code: 'OM', label: 'Oman', dialCode: '+968' },
  { code: 'IL', label: 'Israel', dialCode: '+972' },
  { code: 'ZA', label: 'South Africa', dialCode: '+27' },
  { code: 'EG', label: 'Egypt', dialCode: '+20' },
  { code: 'MA', label: 'Morocco', dialCode: '+212' }
].sort((left, right) => left.label.localeCompare(right.label))

const rankPicker = ref<{ accountId: number; target: 'role' | 'sixv6'; rankIndex?: number } | null>(null)
const settingsMenuOpen = ref(false)
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
const notifications = ref<NotificationToast[]>([])
const activeEditor = ref<EditableField | null>(null)
const activeEditorValue = ref('')
const draggedAccountId = ref<number | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const pointerDrag = ref<{
  accountId: number
  pointerId: number
  startY: number
  currentY: number
  height: number
  anchorOffsetY: number
  clonePointerOffsetY: number
} | null>(null)
const dragLayout = ref<Array<{ accountId: number; top: number; height: number }>>([])
let dragElements = new Map<number, HTMLElement>()
let dragCloneElement: HTMLElement | null = null
let dragSourceElement: HTMLElement | null = null
let dragPointerElement: HTMLElement | null = null
let pendingPointerY: number | null = null
let pointerFrameId: number | null = null
let nextNotificationId = 1
const notificationTimeouts = new Map<number, ReturnType<typeof setTimeout>>()
const clipboardExpiryTimeouts = new Map<'email' | 'password', ReturnType<typeof setTimeout>>()
const pickerTier = ref<RankTier>('Bronze')
const pickerDivision = ref<number>(1)
const pickerPredicted = ref(false)
const rankPickerPositionStyle = ref<Record<string, string>>({})
const STORAGE_KEY = 'rankdb_accounts_v2'
const UI_SETTINGS_KEY = 'rankdb_ui_settings_v2'
const LEGACY_UI_SETTINGS_KEY = 'rankdb_ui_settings_v1'
const TAURI_WINDOW_STATE_KEY = 'rankdb_tauri_window_state_v1'
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
const MAX_UI_ZOOM = 120
const UI_ZOOM_STEP = 5
const BASE_MIN_WINDOW_WIDTH = 550
const MIN_CLIPBOARD_CLEAR_SECONDS = 5
const DEFAULT_CLIPBOARD_CLEAR_SECONDS = 10
const MAX_CLIPBOARD_CLEAR_SECONDS = 30
const INFINITE_CLIPBOARD_CLEAR_SECONDS = 31
const MIN_RANK_NUMBER_OFFSET = -16
const MAX_RANK_NUMBER_OFFSET = 16
const MIN_RANK_NUMBER_FONT_SIZE = 14
const MAX_RANK_NUMBER_FONT_SIZE = 34
const DEFAULT_RANK_NUMBER_OFFSET_X = 0
const DEFAULT_RANK_NUMBER_OFFSET_Y = 0
const DEFAULT_RANK_NUMBER_FONT_SIZE = 24
const buildEmptyAccount = (id: number): AccountRow => ({
  id,
  accountName: 'Battletag#0000',
  email: '',
  password: '',
  countryCode: '',
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

const loadStoredUiSettings = () => {
  if (!import.meta.client) {
    return {
      showSixV6: true,
      showNonRankColumns: true,
      showLeadButtons: true,
      badgeAnimationsEnabled: true,
      uiZoom: DEFAULT_UI_ZOOM,
      clipboardClearTimerSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS,
      rankNumberOffsetX: DEFAULT_RANK_NUMBER_OFFSET_X,
      rankNumberOffsetY: DEFAULT_RANK_NUMBER_OFFSET_Y,
      rankNumberFontSize: DEFAULT_RANK_NUMBER_FONT_SIZE
    }
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
      return {
        showSixV6: true,
        showNonRankColumns: true,
        showLeadButtons: true,
        badgeAnimationsEnabled: true,
        uiZoom: DEFAULT_UI_ZOOM,
        clipboardClearTimerSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS,
        rankNumberOffsetX: DEFAULT_RANK_NUMBER_OFFSET_X,
        rankNumberOffsetY: DEFAULT_RANK_NUMBER_OFFSET_Y,
        rankNumberFontSize: DEFAULT_RANK_NUMBER_FONT_SIZE
      }
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
    return {
      showSixV6: true,
      showNonRankColumns: true,
      showLeadButtons: true,
      badgeAnimationsEnabled: true,
      uiZoom: DEFAULT_UI_ZOOM,
      clipboardClearTimerSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS,
      rankNumberOffsetX: DEFAULT_RANK_NUMBER_OFFSET_X,
      rankNumberOffsetY: DEFAULT_RANK_NUMBER_OFFSET_Y,
      rankNumberFontSize: DEFAULT_RANK_NUMBER_FONT_SIZE
    }
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

  const timeoutHandle = setTimeout(() => {
    removeNotification(notificationId)
  }, duration)

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

const loadSecureCredentialPayload = async (accountId: number) => {
  if (!import.meta.client || !isTauri()) {
    return null
  }

  return invoke<SecureCredentialPayload | null>('load_account_credentials', { accountId })
}

const saveSecureCredentialPayload = async (accountId: number, email: string, password: string) => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  await invoke('save_account_credentials', { accountId, email, password })
}

const deleteSecureCredentialPayload = async (accountId: number) => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  await invoke('delete_account_credentials', { accountId })
}

const syncSecureCredentialsFromStore = async () => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  const loadedCredentials = await Promise.all(accounts.value.map(async (account) => ({
    accountId: account.id,
    credentials: await loadSecureCredentialPayload(account.id)
  })))

  loadedCredentials.forEach(({ accountId, credentials }) => {
    const account = accounts.value.find((entry) => entry.id === accountId)
    if (!account) {
      return
    }

    account.email = credentials?.email ?? ''
    account.password = credentials?.password ?? ''
  })
}

const migrateLegacyCredentialsToSecureStore = async () => {
  if (!import.meta.client || !isTauri()) {
    return
  }

  let migratedAnyCredentials = false

  for (const account of accounts.value) {
    if (!account.email && !account.password) {
      continue
    }

    await saveSecureCredentialPayload(account.id, account.email, account.password)
    account.email = ''
    account.password = ''
    migratedAnyCredentials = true
  }

  if (migratedAnyCredentials) {
    saveAccounts()
  }
}

const getClipboardClearDurationMs = () => {
  if (clipboardClearTimerSeconds.value >= INFINITE_CLIPBOARD_CLEAR_SECONDS) {
    return null
  }

  return clipboardClearTimerSeconds.value * 1000
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

  return {
    ...emptyAccount,
    id: Number.isFinite(Number(fromStorage?.id)) ? Number(fromStorage.id) : fallbackId,
    accountName: typeof fromStorage?.accountName === 'string' ? fromStorage.accountName : emptyAccount.accountName,
    email: typeof fromStorage?.email === 'string' ? fromStorage.email : emptyAccount.email,
    password: typeof fromStorage?.password === 'string' ? fromStorage.password : emptyAccount.password,
    countryCode: typeof fromStorage?.countryCode === 'string' ? fromStorage.countryCode.toUpperCase() : emptyAccount.countryCode,
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
const rankNumberPlatformOffsetX = import.meta.client && isTauri() ? -1 : 0
const rankNumberPlatformOffsetY = import.meta.client && isTauri() ? 1 : 0
const rankNumberPlatformFontAdjust = import.meta.client && isTauri() ? -1 : 0

const accounts = ref<AccountRow[]>(loadStoredAccounts())
const activeRoleSort = ref<RoleSortState | null>(null)
const customAccountOrderIds = ref<number[]>(accounts.value.map((account) => account.id))
const normalAccounts = computed(() => accounts.value.filter((account) => !account.isBanned))
const bannedAccounts = computed(() => accounts.value.filter((account) => account.isBanned))
const lastNormalAccountId = computed(() => normalAccounts.value.at(-1)?.id ?? null)

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

const getSectionedAccounts = (sourceAccounts: AccountRow[]) => {
  const customOrderedAccounts = getAccountCustomOrder(sourceAccounts)
  return [
    ...customOrderedAccounts.filter((account) => !account.isBanned),
    ...customOrderedAccounts.filter((account) => account.isBanned)
  ]
}

const shouldRenderBannedDividerAfter = (accountId: number) => (
  bannedAccounts.value.length > 0 && lastNormalAccountId.value === accountId
)

const getRankSortScore = (rank: RankEntry) => {
  const tierScore = rankTierSortValue[rank.tier] ?? 0
  const divisionScore = rank.tier === 'Unranked' ? 0 : (6 - rank.division) / 10
  const predictedScore = rank.tier === 'Unranked' ? 0 : (rank.predicted ? 0.01 : 0)
  return tierScore + divisionScore + predictedScore
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
  accounts.value = getSectionedAccounts(accounts.value)
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
  email: import.meta.client && isTauri() ? '' : account.email,
  password: import.meta.client && isTauri() ? '' : account.password,
  countryCode: account.countryCode,
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

const buildUiSettingsPayload = () => ({
  showSixV6: showSixV6.value,
  showNonRankColumns: showNonRankColumns.value,
  showLeadButtons: showLeadButtons.value,
  badgeAnimationsEnabled: badgeAnimationsEnabled.value,
  uiZoom: normalizeUiZoom(uiZoom.value),
  clipboardClearTimerSeconds: normalizeClipboardClearTimer(clipboardClearTimerSeconds.value),
  rankNumberOffsetX: normalizeRankNumberOffset(rankNumberOffsetX.value),
  rankNumberOffsetY: normalizeRankNumberOffset(rankNumberOffsetY.value),
  rankNumberFontSize: normalizeRankNumberFontSize(rankNumberFontSize.value)
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

const saveAccounts = () => {
  if (!import.meta.client) {
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildAccountsPayload()))
}

onMounted(() => {
  if (!import.meta.client) {
    return
  }

  assetWarmupPromise ??= warmupUiAssets()

  if (!localStorage.getItem(STORAGE_KEY)) {
    saveAccounts()
  }

  window.addEventListener('click', closeMenus)

  if (isTauri()) {
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
        await migrateLegacyCredentialsToSecureStore()
        await syncSecureCredentialsFromStore()
      } catch {
        pushNotification('Credential sync failed', {
          message: 'Could not read secure credentials from Windows Credential Manager.',
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
})

watch(accounts, () => {
  saveAccounts()
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    syncCustomAccountOrderFromAccounts()
  }
}, { deep: true })

watch([showSixV6, showNonRankColumns, showLeadButtons, badgeAnimationsEnabled, uiZoom, () => accounts.value.length], () => {
  scheduleTauriWindowResize()
})

watch([showSixV6, showNonRankColumns, showLeadButtons, badgeAnimationsEnabled, uiZoom, clipboardClearTimerSeconds, rankNumberOffsetX, rankNumberOffsetY, rankNumberFontSize], ([sixV6Value, nonRankColumnsValue, leadButtonsValue, badgeAnimationsValue, zoomValue, clipboardTimerValue, rankOffsetXValue, rankOffsetYValue, rankFontSizeValue]) => {
  if (!import.meta.client) {
    return
  }
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({
    showSixV6: sixV6Value,
    showNonRankColumns: nonRankColumnsValue,
    showLeadButtons: leadButtonsValue,
    badgeAnimationsEnabled: badgeAnimationsValue,
    uiZoom: normalizeUiZoom(zoomValue),
    clipboardClearTimerSeconds: normalizeClipboardClearTimer(clipboardTimerValue),
    rankNumberOffsetX: normalizeRankNumberOffset(rankOffsetXValue),
    rankNumberOffsetY: normalizeRankNumberOffset(rankOffsetYValue),
    rankNumberFontSize: normalizeRankNumberFontSize(rankFontSizeValue)
  }))
})

const exportData = () => {
  if (!import.meta.client) {
    return
  }

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: buildAccountsPayload(),
    uiSettings: buildUiSettingsPayload()
  }

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `rankdb-export-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  pushNotification('Export complete', {
    message: 'Your RankDB data was downloaded as a JSON file.',
    kind: 'success'
  })
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

  try {
    const raw = await file.text()
    const parsed = JSON.parse(raw)
    const importedAccounts = Array.isArray(parsed?.accounts) ? parsed.accounts : null
    if (!importedAccounts) {
      throw new Error('Invalid data file')
    }

    const normalizedAccounts = importedAccounts
      .filter((entry: unknown) => entry && typeof entry === 'object')
      .map((entry: unknown, idx: number) => normalizeStoredAccount(entry, idx + 1))

    accounts.value = normalizedAccounts.length > 0 ? normalizedAccounts : buildEmptyAccounts()

    const importedUiSettings = parsed?.uiSettings && typeof parsed.uiSettings === 'object'
      ? parsed.uiSettings
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

    if (isTauri()) {
      await migrateLegacyCredentialsToSecureStore()
      await syncSecureCredentialsFromStore()
    }

    saveAccounts()
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(buildUiSettingsPayload()))
    closeSettingsMenu()
    pushNotification('Import complete', {
      message: `Loaded ${accounts.value.length} account${accounts.value.length === 1 ? '' : 's'}.`,
      kind: 'success'
    })
  } catch {
    pushNotification('Import failed', {
      message: 'Could not import data from that file.',
      kind: 'error',
      duration: 3200
    })
  } finally {
    if (input) {
      input.value = ''
    }
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

const getAccountNameForDisplay = (accountId: number) => {
  const account = accounts.value.find((entry) => entry.id === accountId)
  return account ? getDisplayAccountName(account.accountName) : 'this account'
}

const closeSettingsMenu = () => {
  settingsMenuOpen.value = false
}

const closeAccountContextMenu = () => {
  accountContextMenu.value = null
  accountContextMenuPositionStyle.value = {}
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

const closeMenus = () => {
  closeSettingsMenu()
  closeAccountContextMenu()
}

const toggleSettingsMenu = () => {
  settingsMenuOpen.value = !settingsMenuOpen.value
}

const toggleLeadButtons = () => {
  showLeadButtons.value = !showLeadButtons.value
}

const openAccountContextMenu = (accountId: number, event: MouseEvent) => {
  commitActiveEditor()
  closeMenus()
  closeRankPicker()

  const menuWidth = 180
  const menuHeight = 172
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
  saveAccounts()
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
    if (import.meta.client && isTauri()) {
      if (!credentialsEmailDraft.value && !credentialsPasswordDraft.value) {
        await deleteSecureCredentialPayload(account.id)
      } else {
        await saveSecureCredentialPayload(account.id, credentialsEmailDraft.value, credentialsPasswordDraft.value)
      }
    }

    account.email = credentialsEmailDraft.value
    account.password = credentialsPasswordDraft.value
    closeCredentialsModal()
    pushNotification('Credentials saved', {
      message: `Updated ${getAccountNameForDisplay(account.id)}.`,
      kind: 'success'
    })
  } catch {
    pushNotification('Credentials not saved', {
      message: 'Windows Credential Manager rejected the update.',
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
      dragCloneElement.style.top = `${pointerDrag.value.currentY - pointerDrag.value.clonePointerOffsetY}px`
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
  const nextAccount = buildEmptyAccount(nextId)
  const firstBannedIndex = accounts.value.findIndex((account) => account.isBanned)
  if (firstBannedIndex === -1) {
    accounts.value.push(nextAccount)
  } else {
    accounts.value.splice(firstBannedIndex, 0, nextAccount)
  }
  if (activeRoleSort.value) {
    applyRoleSort(activeRoleSort.value.roleIndex, activeRoleSort.value.direction)
  } else {
    syncCustomAccountOrderFromAccounts()
  }
}

const removeBar = async (accountId: number) => {
  if (accounts.value.length <= 1) {
    return
  }

  if (import.meta.client && isTauri()) {
    try {
      await deleteSecureCredentialPayload(accountId)
    } catch {
      pushNotification('Credential cleanup failed', {
        message: 'The account was removed, but its secure credential entry could not be deleted.',
        kind: 'error',
        duration: 3600
      })
    }
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

<style scoped>
@font-face {
  font-family: 'Futura No2 Demi';
  src: url('../assets/futura-no2-d-demi-bold.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

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
  font-family: 'Futura No2 Demi', sans-serif;
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
