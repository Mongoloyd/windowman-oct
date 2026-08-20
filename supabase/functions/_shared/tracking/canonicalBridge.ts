import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createCanonicalEvent } from "./canonical/createCanonicalEvent.ts";
import type { CreateCanonicalEventInput } from "./canonical/types.ts";

/**
 * Bridge between the canonical event helpers (which are written against a
 * minimal `DBLike` contract) and the real Supabase client used inside edge
 * functions. The Postgrest builder is thenable but is not a `Promise`
 * structurally — wrapping each call in an `async` method awaits the builder
 * and returns the `{ data, error }` shape that `DBLike` declares.
 *
 * Pure plumbing: do not add business logic here.
 */
type DbResult = { data?: unknown; error?: { message?: string } | null };
type DbSingleResult = {
  data?: Record<string, unknown> | null;
  error?: { message?: string } | null;
};

export async function persistCanonicalEvent(
  supabase: SupabaseClient,
  input: CreateCanonicalEventInput,
): Promise<Awaited<ReturnType<typeof createCanonicalEvent>>> {
  return createCanonicalEvent(input, {
    db: {
      from(table: string) {
        const query = supabase.from(table);
        return {
          async insert(
            payload: Record<string, unknown> | Record<string, unknown>[],
          ): Promise<DbResult> {
            const { data, error } = await query.insert(payload as never)
              .select();
            return { data, error: error ? { message: error.message } : null };
          },
          async upsert(
            payload: Record<string, unknown> | Record<string, unknown>[],
            options?: { onConflict?: string },
          ): Promise<DbResult> {
            const { data, error } = await query
              .upsert(payload as never, options as never)
              .select();
            return { data, error: error ? { message: error.message } : null };
          },
          select(columns: string) {
            return {
              eq(column: string, value: string) {
                return {
                  async maybeSingle(): Promise<DbSingleResult> {
                    const { data, error } = await query
                      .select(columns)
                      .eq(column, value)
                      .maybeSingle();
                    return {
                      data: (data as Record<string, unknown> | null) ?? null,
                      error: error ? { message: error.message } : null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  });
}
