import type { RequestHandler } from '@sveltejs/kit';
import { TimerManager } from '../../../../../lib/timer';

export const GET: RequestHandler = async ({ locals, url }) => {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const timerManager = new TimerManager(supabase, user.id, () => {});
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    const [currentState, sessionsResult] = await Promise.all([
      timerManager.getCurrentState(),
      timerManager.getWorkSessions(limit)
    ]);

    return new Response(JSON.stringify({ 
      currentState,
      sessions: sessionsResult.sessions,
      error: sessionsResult.error
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting timer status:', error);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};