<script lang="ts">
  import { onMount } from "svelte"
  import { createClient } from "@supabase/supabase-js"
  import type { SupabaseClient } from "@supabase/supabase-js"
  import type { Database } from "../../../../DatabaseDefinitions"
  import TimerComponent from "$lib/TimerComponent.svelte"
  import {
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
  } from "$env/static/public"

  export let data: {
    full_name: string | null
    userId: string
    sessionToken: string
  }

  let supabase: SupabaseClient<Database> | null = null

  onMount(async () => {
    supabase = createClient(PUBLIC_SUPABASE_URL!, PUBLIC_SUPABASE_ANON_KEY!)

    // Set the session token for authentication
    if (data.sessionToken) {
      await supabase.auth.setSession({
        access_token: data.sessionToken,
        refresh_token: data.sessionToken,
      })
    }
  })
</script>

<svelte:head>
  <title>Account</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-1">Dashboard</h1>
<div class="alert alert-error max-w-lg mt-2">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="stroke-current shrink-0 h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    ><path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    /></svg
  >
  <div>
    <div class="font-bold">Demo Content</div>
    <div class="my-2"></div>
    <div class="my-2">
      The <a href="/account/billing" class="link">billing</a> and
      <a href="/account/settings" class="link">settings</a> pages are functional
      demos.
    </div>
  </div>
</div>

<div class="my-6">
  <h1 class="text-xl font-bold mb-1">Ciao {data.full_name ?? "utente"}</h1>
</div>

<div>
  {#if supabase}
    <TimerComponent {supabase} userId={data.userId} />
  {/if}
</div>
