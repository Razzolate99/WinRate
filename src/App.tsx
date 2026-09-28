import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  KeyRound,
  LoaderCircle,
  Radio,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  Swords,
  X,
} from 'lucide-react'
import './winrate.css'
import type { PlayerAnalysis, ScanResult, Settings } from './types'

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  routing: 'americas',
  games: 5,
  threshold: 2,
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'MID', 'BOTTOM', 'ADC', 'UTILITY', 'SUPPORT']

function roleLabel(position: string) {
  return {
    MIDDLE: 'MID',
    BOTTOM: 'ADC',
    UTILITY: 'SUPPORT',
  }[position] || position || 'Unknown role'
}

function roleRank(position: string) {
  const rank = ROLE_ORDER.indexOf(position)
  return rank === -1 ? ROLE_ORDER.length : rank
}

function demoResult(): ScanResult {
  const names = [
    ['Sunday#777', 'Gnar', false, 1],
    ['Northstar#NA1', 'Vi', false, 0],
    ['Aster#NA1', 'Hwei', true, 3],
    ['Solace#0001', 'Jhin', true, 2],
    ['Tidal Wave#NA1', 'Nami', false, 0],
    ['Low Tempo#NA1', 'Jax', false, 0],
    ['Orbit#MOON', 'Viego', false, 0],
    ['Arc Light#NA1', 'Lux', false, 1],
    ['Nightowl#NA1', 'KaiSa', true, 2],
    ['Cinder#FIRE', 'Brand', true, 4],
  ] as const
  const players: PlayerAnalysis[] = names.map(([riotId, championName, flagged, streak], index) => {
    const losses = flagged ? Math.max(streak, 3) : Math.max(streak, index % 3)
    const wins = 5 - losses
    const results: boolean[] = Array.from({ length: streak }, () => false)
    let winsLeft = wins
    let lossesLeft = losses - streak

    while (results.length < 5) {
      if (winsLeft > 0) {
        results.push(true)
        winsLeft -= 1
      }
      if (lossesLeft > 0 && results.length < 5) {
        results.push(false)
        lossesLeft -= 1
      }
    }

    return {
      riotId,
      gameName: riotId.split('#')[0],
      tagLine: riotId.split('#')[1],
      championName,
      position: ['TOP', 'JUNGLE', 'MIDDLE', 'ADC', 'SUPPORT'][index % 5],
      team: index < 5 ? 'ORDER' : 'CHAOS',
      status: 'ready',
      lossStreak: streak,
      flagged,
      wins,
      losses,
      winRate: wins * 20,
      outcomes: results.map((win) => ({
        win,
        champion: championName,
      })),
    }
  })
  return {
    status: 'live',
    gameTime: 743,
    gameMode: 'CLASSIC',
    mapName: "Summoner's Rift",
    activeTeam: 'ORDER',
    threshold: 2,
    gamesAnalyzed: 5,
    players,
    scannedAt: Date.now(),
  }
}

function PlayerCard({ player }: { player: PlayerAnalysis }) {
  const initials = player.championName.slice(0, 2).toUpperCase()
  const ready = player.status === 'ready'
  return (
    <article className={`player-card ${player.flagged ? 'flagged' : ''}`}>
      <div className="champion-avatar">{initials}</div>
      <div className="player-identity">
        <div className="player-name">
          {player.gameName}
          <span>#{player.tagLine}</span>
        </div>
        <div className="champion-name">
          {player.championName} · {roleLabel(player.position)}
        </div>
      </div>

      {ready ? (
        <>
          <div className="form-strip" aria-label="Recent match results">
            {player.outcomes.map((outcome, index) => (
              <span
                className={outcome.win ? 'win' : 'loss'}
                key={`${player.riotId}-${index}`}
                title={outcome.win ? 'Win' : 'Loss'}
              />
            ))}
          </div>
          <div className="record">
            <strong>{player.winRate}%</strong>
            <span>
              {player.wins}W · {player.losses}L
            </span>
          </div>
          <div className={`streak ${player.flagged ? 'danger' : ''}`}>
            {player.flagged ? <AlertTriangle size={15} /> : <Check size={15} />}
            {player.lossStreak ? `${player.lossStreak} loss streak` : 'No loss streak'}
          </div>
        </>
      ) : (
        <div className="player-error">
          <CircleHelp size={15} />
          {player.error || 'History unavailable'}
        </div>
      )}
    </article>
  )
}

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState('')
  const [showIntro, setShowIntro] = useState(true)
  const scanning = useRef(false)

  const scan = useCallback(async () => {
    if (scanning.current) return
    scanning.current = true
    setLoading(true)
    setError('')
    try {
      setResult(await window.winrate.scanGame())
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The scan could not be completed.')
    } finally {
      setLoading(false)
      scanning.current = false
    }
  }, [])

  useEffect(() => {
    window.winrate.getSettings().then((saved) => {
      setSettings(saved)
      setDraft(saved)
      if (saved.apiKey) void scan()
    })
  }, [scan])

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowIntro(false), 3_200)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!settings.apiKey || result?.status === 'live' || result?.status === 'setup_required') return
    const interval = window.setInterval(scan, 15_000)
    return () => window.clearInterval(interval)
  }, [result?.status, scan, settings.apiKey])

  const liveResult = result?.status === 'live' ? result : null
  const needsSetup = !settings.apiKey || result?.status === 'setup_required'
  const teams = useMemo(() => {
    if (!liveResult) return []
    const first = liveResult.activeTeam || 'ORDER'
    const second = first === 'ORDER' ? 'CHAOS' : 'ORDER'
    return [
      { id: first, label: liveResult.activeTeam ? 'Your team' : 'Blue team' },
      { id: second, label: liveResult.activeTeam ? 'Enemy team' : 'Red team' },
    ] as const
  }, [liveResult])

  async function saveSettings() {
    const saved = await window.winrate.saveSettings(draft)
    setSettings(saved)
    setDraft(saved)
    setSettingsOpen(false)
    await scan()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Swords size={18} strokeWidth={2.4} />
          </div>
          <span>WINRATE</span>
        </div>
        <div className="topbar-actions">
          <div className={`client-status ${liveResult ? 'online' : ''}`}>
            <span />
            {liveResult ? 'Live game connected' : 'Waiting for League'}
          </div>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} title="Settings">
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      <main>
        <section className={`hero-panel ${showIntro ? '' : 'intro-hidden'}`}>
          <div className={`hero-copy ${showIntro ? '' : 'hidden'}`}>
            <div className="eyebrow">
              <Radio size={13} /> LIVE MATCH INTELLIGENCE
            </div>
            <h1>Spot the tilt.
            <br />Play the edge.</h1>
            <p>WinRate checks recent match form for every player in your active League game.</p>
          </div>
          <div className="scan-actions">
            <button className="primary-button" onClick={scan} disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}
              {loading ? 'Analyzing players…' : 'Scan live game'}
            </button>
            {!liveResult && (
              <button className="text-button" onClick={() => setResult(demoResult())}>
                Preview with demo data <ChevronRight size={15} />
              </button>
            )}
          </div>
        </section>

        {error && (
          <div className="notice error-notice">
            <AlertTriangle size={17} />
            <span>{error}</span>
            <button onClick={() => setError('')}><X size={15} /></button>
          </div>
        )}

        {liveResult ? (
          <>
            <section className="match-summary">
              <div>
                <Activity size={17} />
                <span>{liveResult.mapName || liveResult.gameMode}</span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>{formatTime(liveResult.gameTime)}</span>
              </div>
              <div className="flag-count">
                <AlertTriangle size={17} />
                <span>
                  {liveResult.players.filter((player) => player.flagged).length} players flagged
                </span>
              </div>
              <div className="summary-note">
                Last {liveResult.gamesAnalyzed} games · {liveResult.threshold}+ consecutive losses
              </div>
            </section>

            <section className="teams">
              {teams.map((team) => {
                const players = liveResult.players
                  .filter((player) => player.team === team.id)
                  .sort((a, b) => roleRank(a.position) - roleRank(b.position))
                const flagged = players.filter((player) => player.flagged).length
                return (
                  <div className="team-block" key={team.id}>
                    <div className="team-heading">
                      <div>
                        <Shield size={17} />
                        <h2>{team.label}</h2>
                        <span>{players.length} players</span>
                      </div>
                      {flagged > 0 && <div className="danger-pill">{flagged} on a loss streak</div>}
                    </div>
                    <div className="player-list">
                      {players.map((player) => <PlayerCard key={player.riotId} player={player} />)}
                    </div>
                  </div>
                )
              })}
            </section>
          </>
        ) : (
          <section className="empty-state">
            <div className="radar">
              <div className="radar-ring ring-one" />
              <div className="radar-ring ring-two" />
              <div className="radar-core"><Swords size={28} /></div>
            </div>
            <h2>
              {needsSetup
                ? 'Connect your Riot API key'
                : 'No live match detected'}
            </h2>
            <p>
              {needsSetup
                ? 'Add a development key in settings before scanning player history.'
                : 'Launch League and enter a match. WinRate will detect it automatically when you scan.'}
            </p>
            {needsSetup && (
              <button className="secondary-button" onClick={() => setSettingsOpen(true)}>
                <KeyRound size={17} /> Open settings
              </button>
            )}
          </section>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="modal-icon"><SettingsIcon size={18} /></span>
                <div>
                  <h2>Settings</h2>
                  <p>Configure match-history analysis.</p>
                </div>
              </div>
              <button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
            </div>

            <label>
              <span>Riot development API key</span>
              <input
                type="password"
                value={draft.apiKey}
                placeholder={settings.apiKey ? 'Key saved — enter a new key to replace it' : 'RGAPI-…'}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              />
              <small>
                Stored locally with Windows encryption.{' '}
                <button onClick={() => window.winrate.openDeveloperPortal()}>Get a key from Riot</button>
              </small>
            </label>

            <div className="field-row">
              <label>
                <span>Regional routing</span>
                <select
                  value={draft.routing}
                  onChange={(event) =>
                    setDraft({ ...draft, routing: event.target.value as Settings['routing'] })
                  }
                >
                  <option value="americas">Americas — NA, BR, LAN, LAS</option>
                  <option value="europe">Europe — EUW, EUNE, TR, RU</option>
                  <option value="asia">Asia — KR, JP</option>
                  <option value="sea">SEA — OCE, PH, SG, TH, TW, VN</option>
                </select>
              </label>
            </div>

            <div className="field-row two">
              <label>
                <span>Games to analyze</span>
                <input
                  type="number"
                  min="3"
                  max="8"
                  value={draft.games}
                  onChange={(event) => setDraft({ ...draft, games: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Flag after losses</span>
                <input
                  type="number"
                  min="2"
                  max="5"
                  value={draft.threshold}
                  onChange={(event) => setDraft({ ...draft, threshold: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="privacy-note">
              <Shield size={16} />
              Your API key stays on this PC and is never sent anywhere except Riot's API.
            </div>

            <div className="modal-actions">
              <button className="text-button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="primary-button compact" onClick={saveSettings}>
                Save & scan
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
