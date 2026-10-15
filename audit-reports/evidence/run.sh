#!/usr/bin/env bash
# Usage : run.sh <nom> <commande...> — journalise commande, code de sortie, durée, sortie.
name="$1"; shift
dir="$(cd "$(dirname "$0")" && pwd)"
start=$(date +%s.%N)
"$@" > "$dir/$name.log" 2>&1
code=$?
end=$(date +%s.%N)
dur=$(echo "$end - $start" | bc)
# Les identifiants de connexion ne sont jamais consignés
sed -i -E 's#(postgres(ql)?|redis)://[^@/ ]+@#\1://***:***@#g' "$dir/$name.log"
printf '%s\t%s\t%s\t%s\n' "$name" "$code" "$dur" "$(echo "$*" | sed -E 's#(postgres(ql)?|redis)://[^@/ ]+@#\1://***:***@#g')" >> "$dir/commands.tsv"
echo "$name exit=$code duree=${dur}s"
