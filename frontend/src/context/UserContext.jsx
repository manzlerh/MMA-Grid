import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getUserStats, submitScore } from '../services/api'

const USER_ID_KEY = 'ufc_user_id'
const DAILY_STATUS_KEY = 'ufc_daily_status'

const INITIAL_STATS = {
  totalGamesPlayed: 0,
  totalGamesCompleted: 0,
  completionRate: 0,
  currentStreak: 0,
  longestStreak: 0,
  gridStats: {},
  connectionsStats: {},
  recentGames: [],
}

function todayString() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function loadDailyStatus() {
  try {
    const raw = localStorage.getItem(DAILY_STATUS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveDailyStatus(status) {
  try {
    localStorage.setItem(DAILY_STATUS_KEY, JSON.stringify(status))
  } catch (_) {}
}

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [userId, setUserId] = useState(null)
  const [streak, setStreak] = useState(0)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [lastPlayedDate, setLastPlayedDate] = useState('')
  const [todayCompleted, setTodayCompleted] = useState({ grid: false, connections: false })
  const [stats, setStats] = useState(INITIAL_STATS)
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(USER_ID_KEY, id)
    }
    setUserId(id)
  }, [])

  useEffect(() => {
    const saved = loadDailyStatus()
    const today = todayString()
    if (saved && saved.date === today) {
      setTodayCompleted({
        grid: !!saved.grid,
        connections: !!saved.connections,
      })
    } else {
      const fresh = { date: today, grid: false, connections: false }
      saveDailyStatus(fresh)
      setTodayCompleted({ grid: false, connections: false })
    }
  }, [])

  const fetchStats = useCallback(async () => {
    if (!userId) return
    setStatsLoading(true)
    try {
      const data = await getUserStats(userId)
      setStats(data)
    } catch (_) {
      // Silent fallback — leave stats as-is; localStorage-backed UI still works
    } finally {
      setStatsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) fetchStats()
  }, [userId, fetchStats])

  const saveScore = useCallback(
    async (payload) => {
      try {
        const data = await submitScore(payload)
        if (data?.streak != null) {
          setStats((prev) => ({ ...prev, currentStreak: data.streak }))
        }
        await fetchStats()
      } catch (err) {
        console.error('Failed to save score:', err)
        // Don't surface to user; markGameCompleted still updates local state
        throw err
      }
    },
    [fetchStats]
  )

  const markGameCompleted = useCallback((gameType) => {
    if (gameType !== 'grid' && gameType !== 'connections') return
    const today = todayString()
    setTodayCompleted((prev) => {
      const next = { ...prev, [gameType]: true }
      saveDailyStatus({ date: today, grid: next.grid, connections: next.connections })
      return next
    })
    setLastPlayedDate(today)
    setGamesPlayed((n) => n + 1)
  }, [])

  const value = {
    userId,
    streak,
    gamesPlayed,
    lastPlayedDate,
    todayCompleted,
    markGameCompleted,
    stats,
    fetchStats,
    saveScore,
    statsLoading,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
