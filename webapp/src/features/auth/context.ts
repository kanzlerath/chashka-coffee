import type { LoginRequest, UserDto } from '@chashka-coffee/contracts'
import { createContext } from 'react'
import type { AuthApi } from './api'

export type AuthContextValue = {
  user: UserDto | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  login: (input: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  api: Pick<AuthApi, 'request'>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
