#!/usr/bin/env bash
#
# Compila el APK de CaFriend.
#
# Espera un JDK 21 y un SDK de Android instalados en ~/android-tools (ver el
# README). Si los tenés en otro lado, exportá JAVA_HOME y ANDROID_HOME antes
# de llamarlo y el script los respeta.
#
# Normalmente no se llama directo: `npm run build:apk` hace el build web, el
# sync de Capacitor y después esto.
set -euo pipefail

TOOLS="${CAFRIEND_ANDROID_TOOLS:-$HOME/android-tools}"
# Capacitor 8 compila contra Java 21; con 17 falla en "invalid source release: 21".
export JAVA_HOME="${JAVA_HOME:-$TOOLS/jdk-21.0.12+8}"
export ANDROID_HOME="${ANDROID_HOME:-$TOOLS/sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "No encuentro un JDK en $JAVA_HOME" >&2
  echo "Instalalo con las instrucciones del README o exportá JAVA_HOME." >&2
  exit 1
fi

if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "No encuentro el SDK de Android en $ANDROID_HOME" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
./android/gradlew -p android --no-daemon assembleDebug

APK="android/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p dist-apk
cp "$APK" dist-apk/cafriend.apk

echo
echo "APK listo: dist-apk/cafriend.apk ($(du -h dist-apk/cafriend.apk | cut -f1))"
