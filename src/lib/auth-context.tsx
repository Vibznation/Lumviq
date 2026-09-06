import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type OrgSummary = {
  id: string
  name: string
  role: string
}

export type CurrentUser = {
  id: string
  email: string
  name: string | null
}

type AuthState = {
  token: string | null
  user: CurrentUser | null
  organizations: OrgSummary[]
  currentOrgId: string | null
  loading: boolean
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  refresh: () => Promise<void>
  setCurrentOrgId: (organizationId: string) => void
  currentOrg: OrgSummary | null
}

const TOKEN_KEY = 'lumviq_token'
const ORG_KEY = 'lumviq_current_org'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [organizations, setOrganizations] = useState<OrgSummary[]>([])
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async (activeToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` },
    })
    if (!res.ok) {
      throw new Error('Session expired')
    }
    const json = await res.json()
    setUser(json.user)
    setOrganizations(json.organizations || [])
    return json
  }, [])

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null
    if (!stored) {
      setLoading(false)
      return
    }
    setToken(stored)
    loadMe(stored)
      .then((json) => {
        const storedOrg = window.localStorage.getItem(ORG_KEY)
        const orgs: OrgSummary[] = json.organizations || []
        if (storedOrg && orgs.some((o) => o.id === storedOrg)) {
          setCurrentOrgIdState(storedOrg)
        } else if (orgs.length > 0) {
          setCurrentOrgIdState(orgs[0].id)
        }
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [loadMe])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: false, error: j.error || 'Invalid credentials' }
    }
    const { token: newToken } = await res.json()
    window.localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    const json = await loadMe(newToken)
    const orgs: OrgSummary[] = json.organizations || []
    if (orgs.length > 0) {
      setCurrentOrgIdState(orgs[0].id)
      window.localStorage.setItem(ORG_KEY, orgs[0].id)
    }
    return { ok: true }
  }, [loadMe])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: false, error: j.error || 'Could not register' }
    }
    return login(email, password)
  }, [login])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(ORG_KEY)
    setToken(null)
    setUser(null)
    setOrganizations([])
    setCurrentOrgIdState(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    await loadMe(token)
  }, [token, loadMe])

  const setCurrentOrgId = useCallback((organizationId: string) => {
    setCurrentOrgIdState(organizationId)
    window.localStorage.setItem(ORG_KEY, organizationId)
  }, [])

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === currentOrgId) || null,
    [organizations, currentOrgId]
  )

  const value: AuthContextValue = {
    token,
    user,
    organizations,
    currentOrgId,
    currentOrg,
    loading,
    login,
    register,
    logout,
    refresh,
    setCurrentOrgId,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/** Convenience helper for building authenticated fetch requests. */
export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
