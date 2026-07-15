// Stub of @supabase/supabase-js used by _handler_under_test.ts.
// Reads fixture data off globalThis.__sigInviteFixture set by tests.
export function createClient(_url?: string, _key?: string) {
  return {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          const g = (globalThis as any).__sigInviteFixture;
          if (table === "signature_requests")
            return { data: g.sigRow, error: g.sigRow ? null : { message: "not found" } };
          if (table === "documents_comptables") return { data: g.docRow, error: null };
          if (table === "profiles") return { data: g.profileRow, error: null };
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
}
