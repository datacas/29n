import { defineStore } from 'pinia'

export interface AdminState {
  isAuthenticated: boolean
  sessionToken: string | null
}

export const useAdminStore = defineStore('admin', {
  state: (): AdminState => ({
    isAuthenticated: false,
    sessionToken: null
  }),

  getters: {
    canAccessAdmin: (state) => state.isAuthenticated && !!state.sessionToken
  },

  actions: {
    setAuthenticated(token: string) {
      this.isAuthenticated = true
      this.sessionToken = token
    },

    logout() {
      this.isAuthenticated = false
      this.sessionToken = null
    }
  }
})
