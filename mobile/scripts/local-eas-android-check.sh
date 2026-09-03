#!/usr/bin/env bash
# Mirrors the EAS preview Android build steps locally so failures show up before cloud builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

PROFILE="${1:-preview}"
echo "==> Local EAS-parity Android check (profile: $PROFILE)"
echo "    ANDROID_HOME=$ANDROID_HOME"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "ERROR: Android SDK not found at $ANDROID_HOME"
  exit 1
fi

echo "==> 1/4 npm ci"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> 2/4 JS bundle (export:embed)"
npx expo export:embed --eager --platform android --dev false

echo "==> 3/4 expo prebuild --platform android --clean"
npx expo prebuild --platform android --clean

echo "==> 4/4 Gradle assembleRelease (EAS preview APK)"
cd android
chmod +x gradlew
./gradlew :app:assembleRelease --no-daemon

APK=$(find app/build/outputs/apk -name '*.apk' 2>/dev/null | head -1 || true)
echo ""
echo "✅ Local Android build succeeded"
[[ -n "$APK" ]] && echo "APK: $ROOT/android/$APK"
