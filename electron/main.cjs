const { app, BrowserWindow, ipcMain, net, safeStorage, session, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const LIVE_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata'
const DEFAULT_SETTINGS = { apiKey: '', routing: 'americas', games: 5, threshold: 2 }
const ROUTINGS = new Set(['americas', 'europe', 'asia', 'sea'])

let mainWindow

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

async function readSettings() {
  try {
    const stored = JSON.parse(await fs.readFile(settingsPath(), 'utf8'))
    let apiKey = ''
    if (stored.apiKey) {
      apiKey = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(stored.apiKey, 'base64'))
        : Buffer.from(stored.apiKey, 'base64').toString('utf8')
    }
    return { ...DEFAULT_SETTINGS, ...stored, apiKey }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function writeSettings(input) {
  const current = await readSettings()
  const submittedKey = String(input.apiKey || '').trim()
  const settings = {
    apiKey: submittedKey && !submittedKey.includes('•') ? submittedKey : current.apiKey,
    routing: ROUTINGS.has(input.routing) ? input.routing : DEFAULT_SETTINGS.routing,
    games: Math.min(8, Math.max(3, Number(input.games) || DEFAULT_SETTINGS.games)),
    threshold: Math.min(5, Math.max(2, Number(input.threshold) || DEFAULT_SETTINGS.threshold)),
  }
  const encryptedKey = settings.apiKey
    ? (safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(settings.apiKey)
        : Buffer.from(settings.apiKey, 'utf8')
      ).toString('base64')
    : ''
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify({ ...settings, apiKey: encryptedKey }, null, 2))
  return { ...settings, apiKey: settings.apiKey ? '••••••••••••••••' : '' }
}

function publicSettings(settings) {
  return { ...settings, apiKey: settings.apiKey ? '••••••••••••••••' : '' }
}

async function requestJson(url, options = {}) {
  const response = await net.fetch(url, options)
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after')
    const error = new Error(
      response.status === 401 || response.status === 403
        ? 'Riot API key is invalid or expired.'
        : response.status === 429
          ? `Riot rate limit reached${retryAfter ? `; retry in ${retryAfter}s` : ''}.`
          : `Request failed (${response.status}).`,
    )
    error.status = response.status
    throw error
  }
  return response.json()
}

function riotHeaders(apiKey) {
  return { 'X-Riot-Token': apiKey, 'User-Agent': 'WinRate/1.0' }
}

function encode(value) {
  return encodeURIComponent(String(value))
}

async function analyzePlayer(player, settings, matchCache) {
  const gameName = player.riotIdGameName || String(player.riotId || '').split('#')[0]
  const tagLine = player.riotIdTagLine || String(player.riotId || '').split('#')[1]
  const base = {
    riotId: gameName && tagLine ? `${gameName}#${tagLine}` : player.summonerName,
    gameName: gameName || player.summonerName || 'Unknown player',
    tagLine: tagLine || '',
    championName: player.championName,
    position: player.position || '',
    team: player.team,
  }

  if (!gameName || !tagLine) {
    return { ...base, status: 'unavailable', error: 'Riot ID hidden by the client.', outcomes: [] }
  }

  try {
    const account = await requestJson(
      `https://${settings.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encode(gameName)}/${encode(tagLine)}`,
      { headers: riotHeaders(settings.apiKey) },
    )
    const matchIds = await requestJson(
      `https://${settings.routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encode(account.puuid)}/ids?start=0&count=${settings.games}`,
      { headers: riotHeaders(settings.apiKey) },
    )

    const outcomes = []
    for (const matchId of matchIds) {
      let match = matchCache.get(matchId)
      if (!match) {
        match = requestJson(
          `https://${settings.routing}.api.riotgames.com/lol/match/v5/matches/${encode(matchId)}`,
          { headers: riotHeaders(settings.apiKey) },
        )
        matchCache.set(matchId, match)
      }
      const matchData = await match
      const participant = matchData.info?.participants?.find((item) => item.puuid === account.puuid)
      if (participant) outcomes.push({ win: Boolean(participant.win), champion: participant.championName })
    }

    let lossStreak = 0
    for (const outcome of outcomes) {
      if (outcome.win) break
      lossStreak += 1
    }
    const wins = outcomes.filter((outcome) => outcome.win).length
    return {
      ...base,
      status: 'ready',
      outcomes,
      lossStreak,
      wins,
      losses: outcomes.length - wins,
      winRate: outcomes.length ? Math.round((wins / outcomes.length) * 100) : 0,
      flagged: lossStreak >= settings.threshold,
    }
  } catch (error) {
    return { ...base, status: 'error', error: error.message, outcomes: [] }
  }
}

async function scanGame() {
  const settings = await readSettings()
  if (!settings.apiKey) return { status: 'setup_required' }

  let game
  try {
    game = await requestJson(LIVE_URL)
  } catch (error) {
    if (error.status) throw error
    return { status: 'no_game' }
  }

  const activeRiotId =
    game.activePlayer?.riotId ||
    [game.activePlayer?.riotIdGameName, game.activePlayer?.riotIdTagLine].filter(Boolean).join('#')
  const activePlayer = game.allPlayers?.find(
    (player) => player.riotId === activeRiotId || player.summonerName === activeRiotId,
  )
  const matchCache = new Map()
  const players = []

  // Keep concurrency low enough for development-key rate limits.
  for (let index = 0; index < game.allPlayers.length; index += 2) {
    const batch = game.allPlayers.slice(index, index + 2)
    players.push(...(await Promise.all(batch.map((player) => analyzePlayer(player, settings, matchCache)))))
  }

  return {
    status: 'live',
    gameTime: game.gameData?.gameTime || 0,
    gameMode: game.gameData?.gameMode || 'League of Legends',
    mapName: game.gameData?.mapName || '',
    activeTeam: activePlayer?.team || null,
    threshold: settings.threshold,
    gamesAnalyzed: settings.games,
    players,
    scannedAt: Date.now(),
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#080b12',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#080b12', symbolColor: '#8b97a8', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(request.hostname === '127.0.0.1' && request.port === '2999' ? 0 : -3)
  })

  ipcMain.handle('settings:get', async () => publicSettings(await readSettings()))
  ipcMain.handle('settings:save', (_event, settings) => writeSettings(settings))
  ipcMain.handle('game:scan', () => scanGame())
  ipcMain.handle('external:open', (_event, url) => {
    if (String(url).startsWith('https://developer.riotgames.com')) shell.openExternal(url)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
