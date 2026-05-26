#!/bin/bash
#
# Uruchamia środowisko pracy nad mapą:
#  - otwiera DRUGĄ kartę Terminala z gotowym `cd` do projektu (na `git pull`),
#  - w BIEŻĄCEJ karcie startuje serwer z auto-reloadem (`npm run dev`).
#
# Użycie:  ./start-plant-map.sh

# Katalog, w którym leży ten skrypt (czyli folder projektu) — działa
# niezależnie od tego, skąd skrypt uruchomisz.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

# Otwórz drugą kartę Terminala gotową do `git pull`.
# (Za pierwszym razem macOS może poprosić o zgodę na sterowanie Terminalem.)
osascript <<EOF 2>/dev/null
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.4
  do script "cd '$DIR'; clear; echo '== Karta do git pull =='; echo 'Po moich zmianach wpisz tutaj:  git pull'" in front window
end tell
EOF

if [ $? -ne 0 ]; then
  echo "Uwaga: nie udało się otworzyć drugiej karty automatycznie."
  echo "Otwórz ją ręcznie (Cmd+T) i wpisz:  cd \"$DIR\""
fi

echo "Startuję serwer na http://localhost:8000  (zatrzymanie: Ctrl+C)"
npm run dev
