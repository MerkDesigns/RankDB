import type { ThemeTokenKey } from '~~/app/types/rankdb'
import {
  THEME_EXPORT_FORMAT,
  THEME_EXPORT_SCHEMA_VERSION,
  buildCustomThemeId,
  normalizeThemeTokens,
  sanitizeThemeName
} from '~~/app/utils/rankdbThemes'

const APP_STORAGE_FORMAT = 'rankdb-app-state'
const APP_STORAGE_SCHEMA_VERSION = 1

export type PersistedAppStoragePayload = {
  accounts?: unknown
  groups?: unknown
  uiSettings?: unknown
  appMetadata?: unknown
}

export type PersistedAppStorageEnvelope = {
  format: string
  schemaVersion: number
  payload: PersistedAppStoragePayload
}

export type ThemeExportPayload = {
  format: string
  schemaVersion: number
  id: string
  exportedAt: string
  createdAt: string
  updatedAt: string
  name: string
  tokens: Record<ThemeTokenKey, string>
}

export type ParsedThemeImport = {
  name: string
  tokens: Record<ThemeTokenKey, string>
}

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

export const buildPersistedAppStorageEnvelope = (payload: PersistedAppStoragePayload): PersistedAppStorageEnvelope => ({
  format: APP_STORAGE_FORMAT,
  schemaVersion: APP_STORAGE_SCHEMA_VERSION,
  payload
})

export const buildThemeExportPayload = (
  selectedThemeId: string,
  selectedThemeLabel: string,
  activeThemeTokens: Record<ThemeTokenKey, string>
): ThemeExportPayload => {
  const exportedAt = new Date().toISOString()
  return {
    format: THEME_EXPORT_FORMAT,
    schemaVersion: THEME_EXPORT_SCHEMA_VERSION,
    id: selectedThemeId.startsWith('custom-')
      ? selectedThemeId
      : buildCustomThemeId(selectedThemeLabel),
    exportedAt,
    createdAt: exportedAt,
    updatedAt: exportedAt,
    name: selectedThemeLabel,
    tokens: { ...activeThemeTokens }
  }
}

export const parseThemeImportPayload = (value: unknown, fallbackName = 'Imported Theme'): ParsedThemeImport => {
  if (!isRecord(value)) {
    throw new Error('Theme file is not valid JSON data.')
  }

  if ('format' in value || 'schemaVersion' in value || 'tokens' in value) {
    if (value.format !== THEME_EXPORT_FORMAT) {
      throw new Error('Unsupported theme file format.')
    }
    if (value.schemaVersion !== THEME_EXPORT_SCHEMA_VERSION) {
      throw new Error(`Unsupported theme schema v${String(value.schemaVersion)}.`)
    }

    return {
      name: sanitizeThemeName(value.name, fallbackName),
      tokens: normalizeThemeTokens(value.tokens)
    }
  }

  if (isRecord(value.themeTokens)) {
    return {
      name: sanitizeThemeName(value.name, fallbackName),
      tokens: normalizeThemeTokens(value.themeTokens)
    }
  }

  return {
    name: sanitizeThemeName(value.name, fallbackName),
    tokens: normalizeThemeTokens(value)
  }
}

export const parsePersistedAppStorage = (value: unknown): { payload: PersistedAppStoragePayload | null; migratedLegacy: boolean } => {
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
        uiSettings: payload.uiSettings,
        appMetadata: payload.appMetadata
      },
      migratedLegacy: false
    }
  }

  return {
    payload: {
      accounts: value.accounts,
      groups: value.groups,
      uiSettings: value.uiSettings,
      appMetadata: value.appMetadata
    },
    migratedLegacy: true
  }
}
