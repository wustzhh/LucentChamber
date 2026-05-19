import { defineStore } from 'pinia'
import { ref } from 'vue'

const SESSION_KEY = 'lucent_session'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export const useUserStore = defineStore('user', () => {
  const userId = ref<number | null>(null)
  const username = ref('')
  const isLoggedIn = ref(false)

  function setUser(id: number, name: string) {
    userId.value = id
    username.value = name
    isLoggedIn.value = true
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: id, username: name, ts: Date.now() }))
  }

  function logout() {
    userId.value = null
    username.value = ''
    isLoggedIn.value = false
    localStorage.removeItem(SESSION_KEY)
  }

  function loadSession(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (Date.now() - data.ts > SESSION_TTL) {
        localStorage.removeItem(SESSION_KEY)
        return false
      }
      userId.value = data.userId
      username.value = data.username
      isLoggedIn.value = true
      return true
    } catch {
      localStorage.removeItem(SESSION_KEY)
      return false
    }
  }

  return { userId, username, isLoggedIn, setUser, logout, loadSession }
})
