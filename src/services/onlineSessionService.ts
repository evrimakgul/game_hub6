import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  getSupabaseClient,
  isSupabaseConfigured,
  type SupabaseClientConfig,
} from "../lib/supabaseClient.ts";
import type { OnlineProfile } from "../types/realtimeSession.ts";

export type OnlineAuthStatus = "unconfigured" | "loading" | "anonymous" | "authenticated";

export type OnlineSessionSnapshot = {
  isConfigured: boolean;
  status: OnlineAuthStatus;
  user: User | null;
  profile: OnlineProfile | null;
  authError: string | null;
};

export type OnlineSessionServiceOptions = {
  client?: SupabaseClient | null;
  config?: SupabaseClientConfig;
};

export type OnlineSessionListener = (snapshot: OnlineSessionSnapshot) => void;

function mapProfileRow(
  row: {
    id?: string | null;
    user_id?: string | null;
    display_name: string | null;
    created_at?: string | null;
  },
  fallbackId: string
): OnlineProfile {
  const id = row.id ?? row.user_id ?? fallbackId;

  return {
    id,
    displayName: row.display_name?.trim() || id,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function getUserDisplayName(user: User | null, fallback = "Player"): string {
  if (!user) {
    return fallback;
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataName.trim() || user.email?.trim() || fallback;
}

function createFallbackProfile(user: User): OnlineProfile {
  return {
    id: user.id,
    displayName: getUserDisplayName(user),
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

function getDefaultRedirectTo(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

export class OnlineSessionService {
  private readonly client: SupabaseClient | null;
  private readonly listeners = new Set<OnlineSessionListener>();
  private unsubscribeAuth: (() => void) | null = null;
  private snapshot: OnlineSessionSnapshot;

  constructor(options: OnlineSessionServiceOptions = {}) {
    this.client = options.client ?? getSupabaseClient(options.config);
    const configured = options.client !== undefined ? Boolean(options.client) : isSupabaseConfigured(options.config);
    this.snapshot = {
      isConfigured: configured,
      status: configured ? "loading" : "unconfigured",
      user: null,
      profile: null,
      authError: null,
    };
  }

  getSnapshot(): OnlineSessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: OnlineSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (!this.client) {
      this.setSnapshot({
        ...this.snapshot,
        status: "unconfigured",
        user: null,
        profile: null,
      });
      return;
    }

    const { data, error } = await this.client.auth.getSession();
    if (error) {
      this.setSnapshot({ ...this.snapshot, authError: error.message });
    }

    const nextUser = data.session?.user ?? null;
    this.setSnapshot({
      ...this.snapshot,
      user: nextUser,
      status: nextUser ? "authenticated" : "anonymous",
    });
    await this.refreshProfileForUser(nextUser);

    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      this.setSnapshot({
        ...this.snapshot,
        user,
        status: user ? "authenticated" : "anonymous",
      });
      void this.refreshProfileForUser(user);
    });

    this.unsubscribeAuth = () => subscription.unsubscribe();
  }

  dispose(): void {
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
  }

  async signUpWithPassword(args: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<string | null> {
    if (!this.client) {
      return "Supabase is not configured.";
    }

    this.setSnapshot({ ...this.snapshot, authError: null });
    const { data, error } = await this.client.auth.signUp({
      email: args.email.trim(),
      password: args.password,
      options: {
        data: {
          full_name: args.displayName.trim(),
        },
      },
    });

    if (error) {
      this.setSnapshot({ ...this.snapshot, authError: error.message });
      return error.message;
    }

    await this.refreshProfileForUser(data.user);
    return null;
  }

  async signInWithPassword(email: string, password: string): Promise<string | null> {
    if (!this.client) {
      return "Supabase is not configured.";
    }

    this.setSnapshot({ ...this.snapshot, authError: null });
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      this.setSnapshot({ ...this.snapshot, authError: error.message });
      return error.message;
    }

    return null;
  }

  async signInWithDiscord(redirectTo = getDefaultRedirectTo()): Promise<string | null> {
    if (!this.client) {
      return "Supabase is not configured.";
    }

    this.setSnapshot({ ...this.snapshot, authError: null });
    const { error } = await this.client.auth.signInWithOAuth({
      provider: "discord",
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
      this.setSnapshot({ ...this.snapshot, authError: error.message });
      return error.message;
    }

    return null;
  }

  async signOut(): Promise<string | null> {
    if (!this.client) {
      return "Supabase is not configured.";
    }

    this.setSnapshot({ ...this.snapshot, authError: null });
    const { error } = await this.client.auth.signOut();
    if (error) {
      this.setSnapshot({ ...this.snapshot, authError: error.message });
      return error.message;
    }

    this.setSnapshot({
      ...this.snapshot,
      user: null,
      profile: null,
      status: "anonymous",
    });
    return null;
  }

  async refreshProfile(): Promise<void> {
    await this.refreshProfileForUser(this.snapshot.user);
  }

  private async refreshProfileForUser(nextUser: User | null): Promise<void> {
    if (!this.client || !nextUser) {
      this.setSnapshot({ ...this.snapshot, profile: null });
      return;
    }

    this.setSnapshot({ ...this.snapshot, authError: null });

    const { data: existingProfile, error: readError } = await this.client
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("id", nextUser.id)
      .maybeSingle();

    if (!readError && existingProfile) {
      this.setSnapshot({
        ...this.snapshot,
        profile: mapProfileRow(existingProfile, nextUser.id),
      });
      return;
    }

    if (readError) {
      const { data: legacyProfile, error: legacyReadError } = await this.client
        .from("profiles")
        .select("user_id, display_name, created_at")
        .eq("user_id", nextUser.id)
        .maybeSingle();

      if (!legacyReadError && legacyProfile) {
        this.setSnapshot({
          ...this.snapshot,
          profile: mapProfileRow(legacyProfile, nextUser.id),
        });
        return;
      }
    }

    const displayName = getUserDisplayName(nextUser);
    const { data: insertedProfile, error: insertError } = await this.client
      .from("profiles")
      .insert({
        id: nextUser.id,
        display_name: displayName,
      })
      .select("id, display_name, created_at")
      .single();

    if (!insertError && insertedProfile) {
      this.setSnapshot({
        ...this.snapshot,
        profile: mapProfileRow(insertedProfile, nextUser.id),
      });
      return;
    }

    const { data: insertedLegacyProfile, error: legacyInsertError } = await this.client
      .from("profiles")
      .insert({
        user_id: nextUser.id,
        display_name: displayName,
      })
      .select("user_id, display_name, created_at")
      .single();

    if (!legacyInsertError && insertedLegacyProfile) {
      this.setSnapshot({
        ...this.snapshot,
        profile: mapProfileRow(insertedLegacyProfile, nextUser.id),
      });
      return;
    }

    this.setSnapshot({
      ...this.snapshot,
      profile: createFallbackProfile(nextUser),
    });
  }

  private setSnapshot(snapshot: OnlineSessionSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function createOnlineSessionService(
  options: OnlineSessionServiceOptions = {}
): OnlineSessionService {
  return new OnlineSessionService(options);
}
