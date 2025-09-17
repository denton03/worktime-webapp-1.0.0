import type { PageServerLoad } from '../$types'

export const load: PageServerLoad = async ({ locals }) => {
  const { safeGetSession } = locals
  const { session, user } = await safeGetSession()

  if (!session || !user) {
    throw new Error('Not authenticated')
  }

  return {
    full_name: user.user_metadata?.full_name || null,
    userId: user.id,
    sessionToken: session.access_token
  }
}
