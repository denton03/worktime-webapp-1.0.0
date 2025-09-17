<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { formatTime } from "$lib/timer"
  import { SupabaseDao, type WorkSessionRow } from "$lib/dao/SupabaseDao"
  import type { SupabaseClient } from "@supabase/supabase-js"
  import type { Database } from "../DatabaseDefinitions"

  interface Props {
    supabase: SupabaseClient<Database>
    userId: string
  }
  let { supabase, userId }: Props = $props()

  interface TimerState {
    isRunning: boolean
    currentSessionId: number | null
    startTime: Date | null
    elapsedTime: number
  }

  let dao: SupabaseDao
  let timerState: TimerState = $state({
    isRunning: false,
    currentSessionId: null,
    startTime: null,
    elapsedTime: 0,
  })
  let sessions: WorkSessionRow[] = $state([])
  let loading = $state(false)
  let error = $state("")
  let showSavedToast = $state(false)
  let timerInterval: NodeJS.Timeout | null = null

  onMount(async () => {
    dao = new SupabaseDao(supabase, userId)
    await loadInitialState()
  })

  onDestroy(() => {
    stopLocalTimer()
  })

  async function loadInitialState() {
    loading = true
    try {
      const [activeResult, sessionsResult] = await Promise.all([
        dao.getActiveWorkSession(),
        dao.listWorkSessions(20),
      ])

      // Check for active session
      if (activeResult.data && activeResult.data.start_time) {
        const startTime = new Date(activeResult.data.start_time)
        timerState = {
          isRunning: true,
          currentSessionId: activeResult.data.id,
          startTime,
          elapsedTime: Date.now() - startTime.getTime(),
        }
        startLocalTimer()
      }

      // Load sessions
      if (sessionsResult.error) {
        error = sessionsResult.error
      } else {
        sessions = sessionsResult.data || []
      }
    } catch (err) {
      error = "Errore nel caricamento dei dati"
    } finally {
      loading = false
    }
  }

  async function startTimer() {
    console.log("startTimer è partito")

    loading = true
    error = ""
    try {
      const result = await dao.startWorkSession()
      if (result.error) {
        error = result.error
      } else if (result.data) {
        // Start local timer
        const startTime = new Date()
        timerState = {
          isRunning: true,
          currentSessionId: result.data.id,
          startTime,
          elapsedTime: 0,
        }
        startLocalTimer()
      }
    } catch (err) {
      error = "Errore nell'avvio del timer"
    } finally {
      loading = false
    }
  }

  async function stopTimer() {
    loading = true
    error = ""
    try {
      const result = await dao.stopWorkSession()
      if (result.error) {
        error = result.error
      } else {
        // Stop local timer
        stopLocalTimer()
        timerState = {
          isRunning: false,
          currentSessionId: null,
          startTime: null,
          elapsedTime: 0,
        }

        // Reload sessions
        const sessionsResult = await dao.listWorkSessions(20)
        if (sessionsResult.data) {
          sessions = sessionsResult.data
        }

        showSavedToast = true
        setTimeout(() => (showSavedToast = false), 2500)
      }
    } catch (err) {
      error = "Errore nell'arresto del timer"
    } finally {
      loading = false
    }
  }

  function startLocalTimer() {
    stopLocalTimer() // Clean up any existing timer

    timerInterval = setInterval(() => {
      if (timerState.startTime) {
        timerState.elapsedTime = Date.now() - timerState.startTime.getTime()
      }
    }, 1000)
  }

  function stopLocalTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function formatSessionDuration(
    startTime: string | null,
    endTime: string | null,
  ): string {
    if (!endTime || !startTime) return "In corso..."
    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = end.getTime() - start.getTime()
    return formatTime(duration)
  }
</script>

<div class="timer-container">
  <div class="timer-display">
    <h2>Timer Lavoro</h2>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if showSavedToast}
      <div class="toast toast-center toast-top">
        <div class="alert alert-success">
          <span>Turno di Lavoro salvato</span>
        </div>
      </div>
    {/if}

    <div class="timer-controls">
      {#if timerState.isRunning}
        <button onclick={stopTimer} disabled={loading} class="btn btn-stop">
          {loading ? "Fermando..." : "Stop Turno"}
        </button>

        <!-- Counter sotto in hh:mm:ss -->
        <div class="timer-time">{formatTime(timerState.elapsedTime)}</div>
      {:else}
        <button onclick={startTimer} disabled={loading} class="btn btn-start">
          {loading ? "Avviando..." : "Avvia Turno"}
        </button>
        <!-- Timer nascosto quando non in corso -->
      {/if}
    </div>
  </div>

  <div class="sessions-list">
    <h3>Sessioni Recenti</h3>
    {#if loading && sessions.length === 0}
      <div class="loading">Caricamento...</div>
    {:else if sessions.length === 0}
      <div class="no-sessions">Nessuna sessione trovata</div>
    {:else}
      <div class="sessions">
        {#each sessions as session}
          <div class="session-item">
            <div class="session-time">
              <strong>Inizio:</strong>
              {session.start_time
                ? new Date(session.start_time).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "-"}
            </div>
            {#if session.end_time}
              <div class="session-time">
                <strong>Fine:</strong>
                {new Date(session.end_time).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div class="session-duration">
                <strong>Durata:</strong>
                {formatSessionDuration(session.start_time, session.end_time)}
              </div>
            {:else}
              <div class="session-duration current">
                <strong>In corso...</strong>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .timer-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  .timer-display {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    background: #f9f9f9;
  }

  .timer-time {
    font-size: 3rem;
    font-weight: bold;
    color: #333;
    margin: 12px 0 0;
    font-family: "Courier New", monospace;
  }

  .timer-controls {
    margin-top: 20px;
  }

  .btn {
    padding: 12px 24px;
    font-size: 1.1rem;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .btn-start {
    background: #4caf50;
    color: white;
  }

  .btn-start:hover:not(:disabled) {
    background: #45a049;
  }

  .btn-stop {
    background: #f44336;
    color: white;
  }

  .btn-stop:hover:not(:disabled) {
    background: #da190b;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    background: #ffebee;
    color: #c62828;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 15px;
  }

  .sessions-list h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .sessions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .session-item {
    padding: 15px;
    border: 1px solid #e0e0e0;
    border-radius: 5px;
    background: white;
  }

  .session-time {
    margin-bottom: 5px;
    color: #666;
  }

  .session-duration {
    font-weight: bold;
    color: #333;
  }

  .session-duration.current {
    color: #4caf50;
  }

  .loading,
  .no-sessions {
    text-align: center;
    color: #666;
    padding: 20px;
  }
</style>
