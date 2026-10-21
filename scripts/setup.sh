#!/usr/bin/env bash
# Instala las dependencias de Skucy con las versiones compatibles con tu SDK de Expo.
# `expo install` elige automáticamente la versión correcta de cada librería.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Node $(node -v) · npm $(npm -v)"

echo "▶ Limpiando instalaciones fallidas anteriores..."
rm -rf node_modules package-lock.json

echo "▶ Instalando Expo..."
npm install --legacy-peer-deps

echo "▶ Instalando librerías compatibles con el SDK de Expo instalado..."
npx expo install \
  expo-router \
  react \
  react-native \
  react-native-screens \
  react-native-safe-area-context \
  expo-status-bar \
  expo-linking \
  expo-constants \
  expo-font \
  @expo/vector-icons \
  @expo-google-fonts/plus-jakarta-sans \
  @react-native-async-storage/async-storage \
  expo-secure-store \
  expo-image-picker \
  expo-video \
  react-dom \
  react-native-web \
  @expo/metro-runtime \
  expo-auth-session \
  expo-crypto \
  expo-web-browser

echo "▶ Instalando TypeScript..."
npx expo install typescript @types/react -- --save-dev

echo "▶ Verificando que todo esté alineado con el SDK..."
npx expo install --fix

if [ ! -f .env ]; then
  cp .env.example .env
  echo "▶ Creé .env: ábrelo y pon EXPO_PUBLIC_API_URL (docs/DEPLOY.md, paso 6)."
fi

echo
echo "✔ Listo. Sigue docs/DEPLOY.md para crear Supabase, desplegar la función y completar .env"
echo "  Luego:  npm start  (app: 'i' simulador iOS, 'w' navegador)"
