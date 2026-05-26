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

# Otwórz drugie okno Terminala gotowe do `git pull`.
# Używamy `do script` (nowe okno) zamiast symulacji Cmd+T — dzięki temu
# wystarczy zgoda "Terminal chce sterować Terminalem" (jedno kliknięcie OK),
# bez ręcznego włączania uprawnień Dostępności.
osascript <<EOF 2>/dev/null
tell application "Terminal"
  do script "cd '$DIR'; clear; echo '== Okno do git pull =='; echo 'Po moich zmianach wpisz tutaj:  git pull'"
  activate
end tell
EOF

if [ $? -ne 0 ]; then
  echo "Uwaga: nie udało się otworzyć drugiego okna automatycznie."
  echo "Otwórz je ręcznie (Cmd+N) i wpisz:  cd \"$DIR\""
fi

echo "Startuję serwer na http://localhost:8000  (zatrzymanie: Ctrl+C)"
npm run dev
