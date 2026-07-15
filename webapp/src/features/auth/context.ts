import type { LoginRequest, RegisterRequest, UserDto } from '@chashka-coffee/contracts'
import { createContext } from 'react'
import type { AuthApi } from './api'

export type AuthContextValue = {
  user: UserDto | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  register: (input: RegisterRequest) => Promise<void>
  login: (input: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  api: Pick<AuthApi, 'request'>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
