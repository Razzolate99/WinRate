export type Routing = 'americas' | 'europe' | 'asia' | 'sea'

export interface Settings {
  apiKey: string
  routing: Routing
  games: number
  threshold: number
}

export interface Outcome {
  win: boolean
  champion: string
}

export interface PlayerAnalysis {
  riotId: string
  gameName: string
  tagLine: string
  championName: string
  position: string
  team: 'ORDER' | 'CHAOS'
  status: 'ready' | 'error' | 'unavailable'
  outcomes: Outcome[]
  lossStreak?: number
  wins?: number
  losses?: number
  winRate?: number
  flagged?: boolean
  error?: string
}

export type ScanResult =
  | { status: 'setup_required' | 'no_game'; message: string }
  | { status: 'error'; code: 'API_KEY' | 'RATE_LIMIT' | 'SCAN_FAILED'; message: string }
  | {
      status: 'live'
      gameTime: number
      gameMode: string
      mapName: string
      activeTeam: 'ORDER' | 'CHAOS' | null
      threshold: number
      gamesAnalyzed: number
      players: PlayerAnalysis[]
      warnings: string[]
      scannedAt: number
    }

declare global {
  interface Window {
    winrate: {
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Settings) => Promise<Settings>
      scanGame: () => Promise<ScanResult>
      openDeveloperPortal: () => Promise<void>
    }
  }
}
