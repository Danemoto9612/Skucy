// Edge Function `api` de Skucy (Supabase). Se compila a supabase/functions/api/index.ts con `npm run fn:build`.
import { SupabaseBackend, supabaseClient } from './backend';
import { createHandler } from './handler';

declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void };

const handler = createHandler({
  backend: () => new SupabaseBackend(),
  storage: () => supabaseClient(),
});

Deno.serve(handler);
