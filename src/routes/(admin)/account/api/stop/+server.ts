import type { RequestHandler } from '@sveltejs/kit';
import { TimerManager } from '../../../../../lib/timer';

export const POST: RequestHandler = async ({ request, locals }) => {
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
    const result = await timerManager.stopTimer();

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      session: result.session 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};