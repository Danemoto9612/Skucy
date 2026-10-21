// Deno necesita el especificador `npm:` para importar supabase-js dentro de la Edge Function.
const fs = require('fs');
const file = 'supabase/functions/api/index.ts';
const out = fs.readFileSync(file, 'utf8').replace(/from\s+["']@supabase\/supabase-js["']/g, 'from "npm:@supabase/supabase-js@2"');
fs.writeFileSync(file, '// @ts-nocheck — generado por `npm run fn:build` desde supabase/fn-src. No lo edites a mano.\n' + out);
console.log('Función compilada:', file, `(${Math.round(out.length / 1024)} KB)`);
