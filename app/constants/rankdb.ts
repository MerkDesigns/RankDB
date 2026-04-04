import type { CountryOption, ModalOption, RankTier } from '~~/app/types/rankdb'

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

export {
  battlenetIcon,
  bronzeIcon,
  championIcon,
  championModalIcon,
  competetivePointsIcon,
  damageRoleIcon,
  diamondIcon,
  flexRoleIcon,
  goldIcon,
  grandmasterIcon,
  legacyPointsIcon,
  masterIcon,
  mythicPrismsIcon,
  overwatchCoinsIcon,
  overwatchCreditsIcon,
  overwatchIcon,
  platinumIcon,
  silverIcon,
  supportRoleIcon,
  tankRoleIcon,
  unrankedIcon
}

export const assetWarmupSources = [
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

export const rankTiers: RankTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Champion', 'Unranked']
export const divisions = [1, 2, 3, 4, 5]

export const rankIcons: Record<RankTier, string> = {
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

export const modalRankIcons: Record<RankTier, string> = {
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

export const modalOptions: ModalOption[] = [
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

export const accountCountryOptions: CountryOption[] = [
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

export const roleTemplate = [
  { role: 'T', color: 'text-emerald-300' },
  { role: 'D', color: 'text-lime-400' },
  { role: 'S', color: 'text-violet-400' }
] as const

export const STORAGE_KEY = 'rankdb_accounts_v2'
export const UI_SETTINGS_KEY = 'rankdb_ui_settings_v2'
export const LEGACY_UI_SETTINGS_KEY = 'rankdb_ui_settings_v1'
export const TAURI_WINDOW_STATE_KEY = 'rankdb_tauri_window_state_v1'
export const emptyRankTier: RankTier = 'Unranked'
export const emptyDivision = 1
export const emptyValuesA = [0, 0, 0]
export const emptyValuesB = [0, 0]
export const DEFAULT_ROW_COUNT = 5
export const DEFAULT_UI_ZOOM = 100
export const MIN_UI_ZOOM = 80
export const MAX_UI_ZOOM = 150
export const UI_ZOOM_STEP = 5
export const BASE_MIN_WINDOW_WIDTH = 550
export const MIN_CLIPBOARD_CLEAR_SECONDS = 5
export const DEFAULT_CLIPBOARD_CLEAR_SECONDS = 10
export const MAX_CLIPBOARD_CLEAR_SECONDS = 30
export const INFINITE_CLIPBOARD_CLEAR_SECONDS = 31
export const MIN_RANK_NUMBER_OFFSET = -16
export const MAX_RANK_NUMBER_OFFSET = 16
export const MIN_RANK_NUMBER_FONT_SIZE = 14
export const MAX_RANK_NUMBER_FONT_SIZE = 34
export const DEFAULT_RANK_NUMBER_OFFSET_X = 0
export const DEFAULT_RANK_NUMBER_OFFSET_Y = 0
export const DEFAULT_RANK_NUMBER_FONT_SIZE = 24
export const MIN_RANK_BADGE_GLOW_OFFSET = -16
export const MAX_RANK_BADGE_GLOW_OFFSET = 16
export const MIN_RANK_BADGE_GLOW_RADIUS = 1
export const MAX_RANK_BADGE_GLOW_RADIUS = 95
export const MIN_RANK_BADGE_GLOW_OPACITY = 0
export const MAX_RANK_BADGE_GLOW_OPACITY = 100
export const MIN_RANK_BADGE_GLOW_PULSE_AMOUNT = 0
export const MAX_RANK_BADGE_GLOW_PULSE_AMOUNT = 100
export const MIN_RANK_BADGE_GLOW_PULSE_SPEED = 1
export const MAX_RANK_BADGE_GLOW_PULSE_SPEED = 6
export const DEFAULT_RANK_BADGE_GLOW_OFFSET_X = -16
export const DEFAULT_RANK_BADGE_GLOW_OFFSET_Y = -1.5
export const DEFAULT_RANK_BADGE_GLOW_RADIUS = 29
export const DEFAULT_RANK_BADGE_GLOW_OPACITY = 63
export const DEFAULT_RANK_BADGE_GLOW_PULSE_AMOUNT = 50
export const DEFAULT_RANK_BADGE_GLOW_PULSE_SPEED = 5
export const MIN_RANK_BADGE_SPARKLE_INSET = 0
export const MAX_RANK_BADGE_SPARKLE_INSET = 40
export const MIN_RANK_BADGE_SPARKLE_SPREAD = 0
export const MAX_RANK_BADGE_SPARKLE_SPREAD = 28
export const MIN_RANK_BADGE_SPARKLE_SIZE = 4
export const MAX_RANK_BADGE_SPARKLE_SIZE = 20
export const MIN_RANK_BADGE_SPARKLE_DELAY = 0
export const MAX_RANK_BADGE_SPARKLE_DELAY = 30
export const MIN_RANK_BADGE_SPARKLE_DURATION = 0.5
export const MAX_RANK_BADGE_SPARKLE_DURATION = 6
export const MIN_RANK_BADGE_SPARKLE_RERANDOMIZE_SECONDS = 1
export const MAX_RANK_BADGE_SPARKLE_RERANDOMIZE_SECONDS = 12
export const DEFAULT_RANK_BADGE_SPARKLE_INSET_X = 20
export const DEFAULT_RANK_BADGE_SPARKLE_INSET_Y = 18
export const DEFAULT_RANK_BADGE_SPARKLE_SPREAD_X = 8
export const DEFAULT_RANK_BADGE_SPARKLE_SPREAD_Y = 10
export const DEFAULT_RANK_BADGE_SPARKLE_SIZE_MIN = 8
export const DEFAULT_RANK_BADGE_SPARKLE_SIZE_MAX = 13
export const DEFAULT_RANK_BADGE_SPARKLE_DELAY_MAX = 16
export const DEFAULT_RANK_BADGE_SPARKLE_DURATION_MIN = 2.1
export const DEFAULT_RANK_BADGE_SPARKLE_DURATION_MAX = 3.4
export const DEFAULT_RANK_BADGE_SPARKLE_RERANDOMIZE_SECONDS = 4.2
