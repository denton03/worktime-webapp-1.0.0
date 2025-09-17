export type { Database } from '../../DatabaseDefinitions'

export type UserProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string | null
  updated_at: string | null
  company_name: string | null
  website: string | null
  unsubscribed: boolean
}

export const getFullName = (profile: UserProfile | null | undefined): string | null => {
  return profile?.full_name ?? null
}

export const getId = (profile: UserProfile | null | undefined): string | null => {
  return profile?.id ?? null
}