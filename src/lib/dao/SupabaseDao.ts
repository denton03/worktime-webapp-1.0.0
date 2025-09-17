import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../DatabaseDefinitions"

export type PublicClient = SupabaseClient<Database>

export interface DaoResult<T> {
  data: T | null
  error: string | null
}

export interface ProfileUpsertInput {
  full_name: string
  company_name: string
  website: string
  unsubscribed?: boolean
}

export interface WorkSessionRow {
  id: number
  user_id: string
  start_time: string | null
  end_time: string | null
  created_at: string | null
}

/**
 * SupabaseDao centralizza le operazioni sul DB con tipi forti.
 * Usa RLS: ogni metodo presuppone che il client sia autenticato come l'utente corrente.
 */
export class SupabaseDao {
  private readonly client: PublicClient
  private readonly userId: string

  constructor(client: PublicClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  // =====================
  // Profiles
  // =====================

  async getProfile(): Promise<DaoResult<Database["public"]["Tables"]["profiles"]["Row"]>> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", this.userId)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data, error: null }
  }

  async upsertProfile(input: ProfileUpsertInput): Promise<DaoResult<Database["public"]["Tables"]["profiles"]["Row"]>> {
    const row: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: this.userId,
      full_name: input.full_name,
      company_name: input.company_name,
      website: input.website,
      updated_at: new Date().toISOString(),
      unsubscribed: input.unsubscribed ?? false,
    }

    const { data, error } = await this.client
      .from("profiles")
      .upsert(row)
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data, error: null }
  }

  // =====================
  // Work Sessions
  // =====================

  async getActiveWorkSession(): Promise<DaoResult<Pick<WorkSessionRow, "id" | "start_time">>> {
    const { data, error } = await this.client
      .from("work_sessions")
      .select("id, start_time")
      .eq("user_id", this.userId)
      .is("end_time", null)
      .single()

    if (error) {
      // PostgREST: PGRST116 = no rows found
      // Non trattarlo come errore: semplicemente nessuna sessione attiva
      const noRows = (error as any).code === "PGRST116"
      if (noRows) return { data: null, error: null }
      return { data: null, error: error.message }
    }
    return { data, error: null }
  }

  async startWorkSession(): Promise<DaoResult<{ id: number }>> {
    // Evita doppie sessioni
    const active = await this.getActiveWorkSession()
    if (active.data) {
      return { data: null, error: "Hai già una sessione attiva" }
    }

    const insertRow: Database["public"]["Tables"]["work_sessions"]["Insert"] = {
      user_id: this.userId,
      start_time: new Date().toISOString(),
    }

    const { data, error } = await this.client
      .from("work_sessions")
      .insert(insertRow)
      .select("id")
      .single()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data: { id: data.id }, error: null }
  }

  async stopWorkSession(): Promise<DaoResult<WorkSessionRow>> {
    const active = await this.getActiveWorkSession()
    if (!active.data) {
      return { data: null, error: "Nessuna sessione attiva trovata" }
    }

    const { data, error } = await this.client
      .from("work_sessions")
      .update({ end_time: new Date().toISOString() })
      .eq("id", active.data.id)
      .eq("user_id", this.userId)
      .select("*")
      .single()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data: data as WorkSessionRow, error: null }
  }

  async listWorkSessions(limit = 50): Promise<DaoResult<WorkSessionRow[]>> {
    const { data, error } = await this.client
      .from("work_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return { data: null, error: error.message }
    }
    return { data: (data || []) as WorkSessionRow[], error: null }
  }

  async getTotalMinutesBetween(start: Date, end: Date): Promise<DaoResult<number>> {
    const { data, error } = await this.client
      .from("work_sessions")
      .select("start_time, end_time")
      .eq("user_id", this.userId)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .not("end_time", "is", null)

    if (error) {
      return { data: null, error: error.message }
    }

    let totalMinutes = 0
    ;(data || []).forEach((row) => {
      if (row.start_time && row.end_time) {
        const s = new Date(row.start_time)
        const e = new Date(row.end_time)
        totalMinutes += Math.floor((e.getTime() - s.getTime()) / (1000 * 60))
      }
    })
    return { data: totalMinutes, error: null }
  }

  async updateWorkSession(
    sessionId: number, 
    updates: { start_time?: string; end_time?: string }
  ): Promise<DaoResult<WorkSessionRow>> {
    const { data, error } = await this.client
      .from("work_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("user_id", this.userId)
      .select("*")
      .single()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data: data as WorkSessionRow, error: null }
  }

  async deleteWorkSession(sessionId: number): Promise<DaoResult<boolean>> {
    const { error } = await this.client
      .from("work_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", this.userId)

    if (error) {
      return { data: null, error: error.message }
    }
    return { data: true, error: null }
  }
}


