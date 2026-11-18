#!/bin/bash
# OGIMORA – wysyła wszystko do GitHuba jednym poleceniem:  bash runme.sh
# Robi: git add (wszystkie zmiany) → commit z datą i godziną w nazwie → push razem ze znacznikami wersji.
# Jeśli nie ma nic nowego do zapisania, pomija commit i tylko wysyła to, co czeka (np. commit zrobiony przez Claude).
cd "$(dirname "$0")" || exit 1

git add -A
if git diff --cached --quiet; then
  echo "Brak nowych zmian do zapisania – wysyłam tylko to, co już czeka."
else
  NAZWA="$(date '+%Y-%m-%d %H:%M')"
  git commit -m "$NAZWA" || { echo "BŁĄD: commit się nie udał."; exit 1; }
  echo "Zapisano commit: $NAZWA"
fi

if git push --follow-tags; then
  echo "GOTOWE – wysłane do GitHuba."
else
  echo "BŁĄD: nie udało się wysłać (sprawdź internet i klucz SSH)."
  exit 1
fi
