import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseClientConfig = {
  url?: string;
  anonKey?: string;
};

function getProcessEnvValue(key: string): string {
  return typeof process === "undefined" ? "" : (process.env[key]?.trim() ?? "");
}

export function getDefaultSupabaseConfig(): SupabaseClientConfig {
  return {
    url: getProcessEnvValue("VITE_SUPABASE_URL") || getProcessEnvValue("SUPABASE_URL"),
    anonKey:
      getProcessEnvValue("VITE_SUPABASE_ANON_KEY") ||
      getProcessEnvValue("SUPABASE_ANON_KEY"),
  };
}

export function isSupabaseConfigured(
  config: SupabaseClientConfig = getDefaultSupabaseConfig()
): boolean {
  return Boolean(config.url?.trim() && config.anonKey?.trim());
}

let client: SupabaseClient | null = null;
let clientKey = "";

export function getSupabaseClient(
  config: SupabaseClientConfig = getDefaultSupabaseConfig()
): SupabaseClient | null {
  const supabaseUrl = config.url?.trim() ?? "";
  const supabaseAnonKey = config.anonKey?.trim() ?? "";

  if (!isSupabaseConfigured({ url: supabaseUrl, anonKey: supabaseAnonKey })) {
    return null;
  }

  const nextClientKey = `${supabaseUrl}|${supabaseAnonKey}`;
  if (!client || clientKey !== nextClientKey) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    clientKey = nextClientKey;
  }

  return client;
}
