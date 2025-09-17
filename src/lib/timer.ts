import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../DatabaseDefinitions';

export interface WorkSession {
  id: number;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
}

export interface TimerState {
  isRunning: boolean;
  currentSessionId: number | null;
  startTime: Date | null;
  elapsedTime: number; // in milliseconds
}

export class TimerManager {
  private supabase: SupabaseClient<Database>;
  private userId: string;
  private timerInterval: NodeJS.Timeout | null = null;
  private onUpdate: (state: TimerState) => void;

  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    onUpdate: (state: TimerState) => void
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.onUpdate = onUpdate;
  }

  /**
   * Inizia un nuovo timer
   */
  async startTimer(): Promise<{ success: boolean; sessionId?: number; error?: string }> {
    try {
      // Verifica se c'è già una sessione attiva
      const { data: activeSession, error: checkError } = await this.supabase
        .from('work_sessions')
        .select('id, start_time')
        .eq('user_id', this.userId)
        .is('end_time', null)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        return { success: false, error: checkError.message };
      }

      if (activeSession) {
        return { success: false, error: 'Hai già una sessione attiva' };
      }

      // Crea una nuova sessione
      const { data: newSession, error: insertError } = await this.supabase
        .from('work_sessions')
        .insert({
          user_id: this.userId,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      // Avvia il timer locale
      this.startLocalTimer(newSession.id, new Date(newSession?.start_time || ''));

      return { success: true, sessionId: newSession.id };
    } catch (error) {
      return { success: false, error: 'Errore interno del server' };
    }
  }

  /**
   * Ferma il timer attivo
   */
  async stopTimer(): Promise<{ success: boolean; session?: WorkSession; error?: string }> {
    try {
      // Trova la sessione attiva
      const { data: activeSession, error: findError } = await this.supabase
        .from('work_sessions')
        .select('id, start_time')
        .eq('user_id', this.userId)
        .is('end_time', null)
        .single();

      if (findError) {
        return { success: false, error: 'Nessuna sessione attiva trovata' };
      }

      // Ferma il timer locale
      this.stopLocalTimer();

      // Aggiorna la sessione con l'end_time
      const { data: updatedSession, error: updateError } = await this.supabase
        .from('work_sessions')
        .update({ end_time: new Date().toISOString() })
        .eq('id', activeSession.id)
        .eq('user_id', this.userId)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true, session: updatedSession as WorkSession };
    } catch (error) {
      return { success: false, error: 'Errore interno del server' };
    }
  }

  /**
   * Ottiene lo stato attuale del timer
   */
  async getCurrentState(): Promise<TimerState> {
    try {
      const { data: activeSession, error } = await this.supabase
        .from('work_sessions')
        .select('id, start_time')
        .eq('user_id', this.userId)
        .is('end_time', null)
        .single();

      if (error || !activeSession) {
        return {
          isRunning: false,
          currentSessionId: null,
          startTime: null,
          elapsedTime: 0,
        };
      }

      const startTime = new Date(activeSession.start_time || '');
      const elapsedTime = Date.now() - startTime.getTime();

      return {
        isRunning: true,
        currentSessionId: activeSession.id,
        startTime,
        elapsedTime,
      };
    } catch (error) {
      return {
        isRunning: false,
        currentSessionId: null,
        startTime: null,
        elapsedTime: 0,
      };
    }
  }

  /**
   * Ottiene le sessioni di lavoro dell'utente
   */
  async getWorkSessions(limit: number = 50): Promise<{ sessions: WorkSession[]; error?: string }> {
    try {
      const { data: sessions, error } = await this.supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { sessions: [], error: error.message };
      }

      return { sessions: sessions || [] };
    } catch (error) {
      return { sessions: [], error: 'Errore interno del server' };
    }
  }

  /**
   * Calcola la durata totale delle sessioni in un periodo
   */
  async getTotalTimeInPeriod(startDate: Date, endDate: Date): Promise<{ totalMinutes: number; error?: string }> {
    try {
      const { data: sessions, error } = await this.supabase
        .from('work_sessions')
        .select('start_time, end_time')
        .eq('user_id', this.userId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .not('end_time', 'is', null);

      if (error) {
        return { totalMinutes: 0, error: error.message };
      }

      let totalMinutes = 0;
      sessions?.forEach(session => {
        if (session.start_time && session.end_time) {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          const duration = end.getTime() - start.getTime();
          totalMinutes += Math.floor(duration / (1000 * 60));
        }
      });

      return { totalMinutes };
    } catch (error) {
      return { totalMinutes: 0, error: 'Errore interno del server' };
    }
  }

  private startLocalTimer(sessionId: number, startTime: Date) {
    this.stopLocalTimer(); // Ferma eventuali timer precedenti

    this.timerInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime.getTime();
      this.onUpdate({
        isRunning: true,
        currentSessionId: sessionId,
        startTime,
        elapsedTime,
      });
    }, 1000); // Aggiorna ogni secondo
  }

  private stopLocalTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Pulisce le risorse quando il componente viene distrutto
   */
  destroy() {
    this.stopLocalTimer();
  }
}

/**
 * Utility per formattare il tempo
 */
export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Utility per calcolare la durata di una sessione
 */
export function calculateSessionDuration(startTime: string, endTime: string | null): number {
  if (!endTime) return 0;
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  return end.getTime() - start.getTime();
}