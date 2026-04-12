import { createBrowserClient } from "@supabase/ssr";

let realtimeClient: ReturnType<typeof createBrowserClient> | null = null;

export function getRealtimeClient() {
  if (!realtimeClient) {
    realtimeClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return realtimeClient;
}

export function subscribeToVocabChanges(
  onInsert: (word: Record<string, unknown>) => void
) {
  const client = getRealtimeClient();

  const channel = client
    .channel("vocab-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vocabulary" },
      (payload: { new: Record<string, unknown> }) => {
        onInsert(payload.new as Record<string, unknown>);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
