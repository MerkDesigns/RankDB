import type { ThemeLibraryItem, ThemeTokenKey } from '~~/app/types/rankdb'

type ThemeJsonPayload = {
  id?: unknown
  name?: unknown
  tokens?: unknown
}

export const THEME_EXPORT_FORMAT = 'rankdb-theme'
export const THEME_EXPORT_SCHEMA_VERSION = 1

export const DEFAULT_THEME_TOKENS: Record<ThemeTokenKey, string> = {
  appBackground: '#07090f',
  headerSurface: '#11141b',
  headerIcon: '#f1f5f9',
  panelSurface: '#0c0e13',
  panelSurfaceRaised: '#0c1018',
  rowPrimarySurface: '#10131a',
  borderSubtle: '#323744',
  textPrimary: '#f1f5f9',
  textMuted: '#94a3b8',
  hoverSurface: '#181c26',
  accent: '#22d3ee',
  toggleAccent: '#22d3ee',
  bannedAccent: '#4a2630'
}

const premadeThemeModules = import.meta.glob<ThemeJsonPayload>('../themes/premade/*.json', {
  eager: true,
  import: 'default'
})

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isThemeJsonRecord = (value: unknown): value is Record<string, unknown> => isRecord(value)

const normalizeBundledTheme = (value: ThemeJsonPayload, fallbackIndex: number): ThemeLibraryItem | null => {
  if (!isThemeJsonRecord(value.tokens)) {
    return null
  }

  const id = typeof value.id === 'string' && value.id.startsWith('preset-')
    ? value.id
    : `preset-theme-${fallbackIndex + 1}`
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : `Premade Theme ${fallbackIndex + 1}`

  return {
    id,
    name,
    source: 'preset',
    tokens: value.tokens as Partial<Record<ThemeTokenKey, string>>
  }
}

const SHIPPED_PRESET_THEMES: ThemeLibraryItem[] = Object.values(premadeThemeModules)
  .map(normalizeBundledTheme)
  .filter((theme): theme is ThemeLibraryItem => Boolean(theme))
  .sort((left, right) => left.name.localeCompare(right.name))

export const PRESET_THEMES: ThemeLibraryItem[] = [
  {
    id: 'preset-rankdb-default',
    name: 'RankDB Default',
    source: 'preset',
    tokens: DEFAULT_THEME_TOKENS
  },
  ...SHIPPED_PRESET_THEMES
]

export const DEFAULT_THEME_ID = PRESET_THEMES[0]?.id ?? 'preset-rankdb-default'

export const themeTokenControls: Array<{ key: ThemeTokenKey; label: string; elements: string; count: string }> = [
  { key: 'appBackground', label: 'App background', elements: 'Main canvas and page backdrop', count: '1' },
  { key: 'headerSurface', label: 'Header surface', elements: 'Top bar and column headers', count: '5+' },
  { key: 'headerIcon', label: 'Header icons', elements: 'Toolbar icons, role headers, 6v6 header', count: '8+' },
  { key: 'panelSurface', label: 'Panel surface', elements: 'Settings controls, theme rows, fields, cards', count: '8+' },
  { key: 'panelSurfaceRaised', label: 'Floating windows', elements: 'Settings, popovers, modals, context menus', count: '6+' },
  { key: 'rowPrimarySurface', label: 'Account area', elements: 'Battletag, ranks, currency, login buttons, action buttons', count: '12+' },
  { key: 'borderSubtle', label: 'Borders', elements: 'Rows, panels, buttons, inputs, popovers', count: '20+' },
  { key: 'textPrimary', label: 'Primary text', elements: 'Names, labels, buttons, modal headings', count: '20+' },
  { key: 'textMuted', label: 'Muted text', elements: 'Secondary labels, descriptions, counters', count: '10+' },
  { key: 'hoverSurface', label: 'Hover surface', elements: 'Toolbar, icon, row, menu hover states', count: '10+' },
  { key: 'accent', label: 'Accent', elements: 'Primary actions, sliders, focus controls', count: '6+' },
  { key: 'toggleAccent', label: 'Toggle accent', elements: 'Enabled settings toggles', count: '3' },
  { key: 'bannedAccent', label: 'Banned section', elements: 'Banned divider lines and label background', count: '3' }
]

export const themePreviewTokenKeys: ThemeTokenKey[] = ['appBackground', 'headerSurface', 'panelSurface', 'accent', 'bannedAccent']

export const isThemeColor = (value: unknown): value is string => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
)

export const normalizeThemeTokens = (value: unknown) => {
  const nextTokens = { ...DEFAULT_THEME_TOKENS }
  if (!isRecord(value)) {
    return nextTokens
  }

  for (const key of Object.keys(DEFAULT_THEME_TOKENS) as ThemeTokenKey[]) {
    if (isThemeColor(value[key])) {
      nextTokens[key] = value[key]
    }
  }

  if (!isThemeColor(value.toggleAccent) && isThemeColor(value.accent)) {
    nextTokens.toggleAccent = value.accent
  }
  if (!isThemeColor(value.headerSurface) && isThemeColor(value.panelSurface)) {
    nextTokens.headerSurface = value.panelSurface
  }
  if (!isThemeColor(value.headerIcon) && isThemeColor(value.textPrimary)) {
    nextTokens.headerIcon = value.textPrimary
  }

  return nextTokens
}

export const sanitizeThemeName = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 48)
  return normalized || fallback
}

export const buildCustomThemeId = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `custom-${slug || 'theme'}-${Date.now()}`
}

export const normalizeCustomThemes = (value: unknown): ThemeLibraryItem[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null
      }

      const tokens = normalizeThemeTokens(entry.tokens)
      const entryId = typeof entry.id === 'string' && (entry.id.startsWith('custom-') || entry.id.startsWith('imported-'))
        ? entry.id.replace(/^imported-/, 'custom-')
        : `custom-${index + 1}`
      return {
        id: entryId,
        name: sanitizeThemeName(entry.name, `Custom Theme ${index + 1}`),
        source: 'custom' as const,
        tokens
      }
    })
    .filter((entry): entry is ThemeLibraryItem => Boolean(entry))
}
