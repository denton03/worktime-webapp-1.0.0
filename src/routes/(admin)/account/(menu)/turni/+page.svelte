<script lang="ts">
  import { onMount } from "svelte"
  import { getContext } from "svelte"
  import type { Writable } from "svelte/store"
  import { SupabaseDao, type WorkSessionRow } from "$lib/dao/SupabaseDao"
  import { formatTime } from "$lib/timer"
  import type { SupabaseClient } from "@supabase/supabase-js"
  import type { Database } from "../../../../../DatabaseDefinitions"

  let adminSection: Writable<string> = getContext("adminSection")
  adminSection.set("turni")

  let { data } = $props()

  let supabase: SupabaseClient<Database>
  let dao: SupabaseDao
  let sessions: WorkSessionRow[] = $state([])
  let loading = $state(false)
  let error = $state("")
  let editingSession: WorkSessionRow | null = $state(null)
  let showDeleteConfirm = $state(false)
  let sessionToDelete: WorkSessionRow | null = $state(null)
  let showAddForm = $state(false)

  // Form data for editing
  let editForm = $state({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  })

  // Form data for adding new session
  let addForm = $state({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  })

  import {
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
  } from "$env/static/public"

  onMount(async () => {
    // Initialize Supabase client
    const { createClient } = await import("@supabase/supabase-js")
    supabase = createClient<Database>(
      PUBLIC_SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY,
    )

    dao = new SupabaseDao(supabase, data.userId)
    await loadSessions()
  })

  async function loadSessions() {
    loading = true
    error = ""
    try {
      const result = await dao.listWorkSessions(100)
      if (result.error) {
        error = result.error
      } else {
        sessions = result.data || []
      }
    } catch (err) {
      error = "Errore nel caricamento dei turni"
    } finally {
      loading = false
    }
  }

  function startEdit(session: WorkSessionRow) {
    editingSession = session

    // Populate form with current values
    if (session.start_time) {
      const startDate = new Date(session.start_time)
      editForm.startDate = startDate.toISOString().split("T")[0]
      editForm.startTime = startDate
        .toTimeString()
        .split(" ")[0]
        .substring(0, 5)
    }

    if (session.end_time) {
      const endDate = new Date(session.end_time)
      editForm.endDate = endDate.toISOString().split("T")[0]
      editForm.endTime = endDate.toTimeString().split(" ")[0].substring(0, 5)
    } else {
      editForm.endDate = ""
      editForm.endTime = ""
    }
  }

  function cancelEdit() {
    editingSession = null
    editForm = {
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
    }
  }

  async function saveEdit() {
    if (!editingSession) return

    loading = true
    error = ""

    try {
      const updates: { start_time?: string; end_time?: string } = {}

      if (editForm.startDate && editForm.startTime) {
        updates.start_time = new Date(
          `${editForm.startDate}T${editForm.startTime}`,
        ).toISOString()
      }

      if (editForm.endDate && editForm.endTime) {
        updates.end_time = new Date(
          `${editForm.endDate}T${editForm.endTime}`,
        ).toISOString()
      }

      const result = await dao.updateWorkSession(editingSession.id, updates)

      if (result.error) {
        error = result.error
      } else {
        // Update the session in the list
        const index = sessions.findIndex((s) => s.id === editingSession!.id)
        if (index !== -1 && result.data) {
          sessions[index] = result.data
        }
        editingSession = null
        editForm = {
          startDate: "",
          startTime: "",
          endDate: "",
          endTime: "",
        }
      }
    } catch (err) {
      error = "Errore nell'aggiornamento del turno"
    } finally {
      loading = false
    }
  }

  function toggleAddForm() {
    showAddForm = !showAddForm
    if (!showAddForm) {
      // Reset form when closing
      addForm = {
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
      }
    }
  }

  async function addNewSession() {
    if (!addForm.startDate || !addForm.startTime) {
      error = "Data e ora di inizio sono obbligatorie"
      return
    }

    loading = true
    error = ""

    try {
      const startTime = new Date(
        `${addForm.startDate}T${addForm.startTime}`,
      ).toISOString()

      const endTime =
        addForm.endDate && addForm.endTime
          ? new Date(`${addForm.endDate}T${addForm.endTime}`).toISOString()
          : null

      const result = await dao.startWorkSession()

      if (result.error) {
        error = result.error
      } else if (result.data) {
        // Update the session with custom times
        const updateResult = await dao.updateWorkSession(result.data.id, {
          start_time: startTime,
          end_time: endTime || undefined,
        })

        if (updateResult.error) {
          error = updateResult.error
        } else {
          // Add the new session to the list
          if (updateResult.data) {
            sessions = [updateResult.data, ...sessions]
          }

          // Reset form and close
          addForm = {
            startDate: "",
            startTime: "",
            endDate: "",
            endTime: "",
          }
          showAddForm = false
        }
      }
    } catch (err) {
      error = "Errore nella creazione del turno"
    } finally {
      loading = false
    }
  }

  function confirmDelete(session: WorkSessionRow) {
    sessionToDelete = session
    showDeleteConfirm = true
  }

  function cancelDelete() {
    sessionToDelete = null
    showDeleteConfirm = false
  }

  async function deleteSession() {
    if (!sessionToDelete) return

    loading = true
    error = ""

    try {
      const result = await dao.deleteWorkSession(sessionToDelete.id)

      if (result.error) {
        error = result.error
      } else {
        // Remove the session from the list
        sessions = sessions.filter((s) => s.id !== sessionToDelete!.id)
        showDeleteConfirm = false
        sessionToDelete = null
      }
    } catch (err) {
      error = "Errore nell'eliminazione del turno"
    } finally {
      loading = false
    }
  }

  function calculateDuration(
    startTime: string | null,
    endTime: string | null,
  ): string {
    if (!startTime) return "N/A"
    if (!endTime) return "In corso..."

    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = end.getTime() - start.getTime()
    return formatTime(duration)
  }
</script>

<svelte:head>
  <title>Gestione Turni</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">Gestione Turni di Lavoro</h1>
    <button onclick={toggleAddForm} class="btn btn-primary" disabled={loading}>
      {showAddForm ? "Annulla" : "Aggiungi Turno"}
    </button>
  </div>

  {#if error}
    <div class="alert alert-error mb-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="stroke-current shrink-0 h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <!-- Add New Session Form -->
  {#if showAddForm}
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">Aggiungi Nuovo Turno</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="startDate">
              <span class="label-text">Data Inizio *</span>
            </label>
            <input
              id="startDate"
              type="date"
              bind:value={addForm.startDate}
              class="input input-bordered"
              required
            />
          </div>
          <div class="form-control">
            <label class="label" for="startTime">
              <span class="label-text">Ora Inizio *</span>
            </label>
            <input
              id="startTime"
              type="time"
              bind:value={addForm.startTime}
              class="input input-bordered"
              required
            />
          </div>
          <div class="form-control">
            <label class="label" for="endDate">
              <span class="label-text">Data Fine (opzionale)</span>
            </label>
            <input
              id="endDate"
              type="date"
              bind:value={addForm.endDate}
              class="input input-bordered"
            />
          </div>
          <div class="form-control">
            <label class="label" for="endTime">
              <span class="label-text">Ora Fine (opzionale)</span>
            </label>
            <input
              id="endTime"
              type="time"
              bind:value={addForm.endTime}
              class="input input-bordered"
            />
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <button
            onclick={addNewSession}
            disabled={loading || !addForm.startDate || !addForm.startTime}
            class="btn btn-success"
          >
            {loading ? "Aggiungendo..." : "Aggiungi Turno"}
          </button>
          <button
            onclick={toggleAddForm}
            disabled={loading}
            class="btn btn-ghost"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Data Inizio</th>
            <th>Ora Inizio</th>
            <th>Data Fine</th>
            <th>Ora Fine</th>
            <th>Durata</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each sessions as session (session.id)}
            <tr>
              <td>
                {#if editingSession?.id === session.id}
                  <input
                    type="date"
                    bind:value={editForm.startDate}
                    class="input input-bordered input-sm"
                  />
                {:else}
                  {session.start_time
                    ? new Date(session.start_time).toLocaleDateString("it-IT")
                    : "N/A"}
                {/if}
              </td>
              <td>
                {#if editingSession?.id === session.id}
                  <input
                    type="time"
                    bind:value={editForm.startTime}
                    class="input input-bordered input-sm"
                  />
                {:else}
                  {session.start_time
                    ? new Date(session.start_time).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                {/if}
              </td>
              <td>
                {#if editingSession?.id === session.id}
                  <input
                    type="date"
                    bind:value={editForm.endDate}
                    class="input input-bordered input-sm"
                  />
                {:else}
                  {session.end_time
                    ? new Date(session.end_time).toLocaleDateString("it-IT")
                    : "In corso..."}
                {/if}
              </td>
              <td>
                {#if editingSession?.id === session.id}
                  <input
                    type="time"
                    bind:value={editForm.endTime}
                    class="input input-bordered input-sm"
                  />
                {:else}
                  {session.end_time
                    ? new Date(session.end_time).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "In corso..."}
                {/if}
              </td>
              <td>
                {calculateDuration(session.start_time, session.end_time)}
              </td>
              <td>
                {#if editingSession?.id === session.id}
                  <div class="flex gap-2">
                    <button
                      onclick={saveEdit}
                      disabled={loading}
                      class="btn btn-success btn-sm"
                    >
                      {loading ? "Salvando..." : "Salva"}
                    </button>
                    <button
                      onclick={cancelEdit}
                      disabled={loading}
                      class="btn btn-ghost btn-sm"
                    >
                      Annulla
                    </button>
                  </div>
                {:else}
                  <div class="flex gap-2">
                    <button
                      onclick={() => startEdit(session)}
                      class="btn btn-primary btn-sm"
                    >
                      Modifica
                    </button>
                    <button
                      onclick={() => confirmDelete(session)}
                      class="btn btn-error btn-sm"
                    >
                      Elimina
                    </button>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if sessions.length === 0}
        <div class="text-center py-8 text-gray-500">
          <p>Nessun turno trovato.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && sessionToDelete}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Conferma Eliminazione</h3>
      <p class="py-4">
        Sei sicuro di voler eliminare questo turno?<br />
        <strong>Data:</strong>
        {sessionToDelete.start_time
          ? new Date(sessionToDelete.start_time).toLocaleDateString("it-IT")
          : "N/A"}<br />
        <strong>Ora:</strong>
        {sessionToDelete.start_time
          ? new Date(sessionToDelete.start_time).toLocaleTimeString("it-IT")
          : "N/A"}
      </p>
      <div class="modal-action">
        <button
          onclick={deleteSession}
          disabled={loading}
          class="btn btn-error"
        >
          {loading ? "Eliminando..." : "Elimina"}
        </button>
        <button onclick={cancelDelete} disabled={loading} class="btn btn-ghost">
          Annulla
        </button>
      </div>
    </div>
  </div>
{/if}
