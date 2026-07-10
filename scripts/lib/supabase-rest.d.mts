/**
 * Type declarations for supabase-rest.mjs — consumed by apps/mcp-server (TypeScript, NodeNext).
 * Keep in sync with the runtime module by hand; the surface is deliberately tiny.
 */

/** Load KEY=VALUE pairs from a .env.local-style file into process.env (existing env vars win; missing file is a no-op). */
export function loadEnv(path: string): void;

export interface SupabaseRestClient {
  sbGet<T = unknown>(table: string, query?: string): Promise<T[]>;
  sbPatch<T = unknown>(table: string, query: string, body: unknown): Promise<T[]>;
  sbInsert<T = unknown>(table: string, row: unknown): Promise<T[]>;
}

/** Tiny PostgREST client bound to a Supabase project + service_role key. Throws if url/key missing. */
export function createSupabaseClient(url: string, key: string): SupabaseRestClient;
