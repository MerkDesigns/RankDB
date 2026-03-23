export type RankTier =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'Grandmaster'
  | 'Champion'
  | 'Unranked'

export type RankEntry = {
  role: string
  tier: RankTier
  division: number
  color: string
  predicted: boolean
}

export type ModalOption = {
  key: string
  icon: string
  tier?: RankTier
  predictedToggle?: boolean
  dimmed?: boolean
}

export type NotificationToast = {
  id: number
  title: string
  message?: string
  kind: 'success' | 'error' | 'info' | 'loading'
  duration: number
  showTimer: boolean
}

export type CountryOption = {
  code: string
  label: string
  dialCode: string
}

export type RoleSortState = {
  roleIndex: number
  direction: 'desc' | 'asc'
}

export type AccountRow = {
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

export type EditableField =
  | { accountId: number; kind: 'name' }
  | { accountId: number; kind: 'valuesA'; index: number }
  | { accountId: number; kind: 'valuesB'; index: number }

export type UiSettings = {
  showSixV6: boolean
  showNonRankColumns: boolean
  showLeadButtons: boolean
  badgeAnimationsEnabled: boolean
  uiZoom: number
  clipboardClearTimerSeconds: number
  rankNumberOffsetX: number
  rankNumberOffsetY: number
  rankNumberFontSize: number
}
