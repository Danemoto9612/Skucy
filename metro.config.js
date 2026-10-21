// Evita que Metro rastree la carpeta supabase/ (función de Deno y SQL): no forma parte de la app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const supabaseDir = path.join(__dirname, 'supabase').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blocked = new RegExp(`^${supabaseDir}[/\\\\].*`);
const existing = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existing) ? [...existing, blocked] : existing ? [existing, blocked] : [blocked];

module.exports = config;
