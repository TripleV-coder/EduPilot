#!/usr/bin/env bash
# Convertit les .webm enregistrés par Playwright en .mp4 par rôle, ajoute un
# carton-titre (texte du rôle) au début de chacun, puis concatène le tout en une
# vidéo combinée. Sortie : e2e/tour/output/videos/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/output"
VID="$OUT/videos"
mkdir -p "$VID"

# Ordre + libellés lisibles (clé:libellé)
ROLES=(
  "super-admin:Super Admin — Vue réseau"
  "school-admin:Direction — École"
  "director:Directrice"
  "accountant:Comptabilité"
  "teacher:Enseignant"
  "student:Élève"
  "parent:Parent"
)

FONT="$(fc-match -f '%{file}' sans 2>/dev/null || echo /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf)"

CONCAT_LIST="$VID/concat.txt"
: > "$CONCAT_LIST"

for entry in "${ROLES[@]}"; do
  key="${entry%%:*}"
  label="${entry#*:}"
  src_dir="$OUT/$key"
  [ -d "$src_dir" ] || { echo "skip $key (pas de dossier)"; continue; }
  # Playwright écrit un .webm par contexte ; prendre le plus récent/plus gros.
  webm="$(ls -S "$src_dir"/*.webm 2>/dev/null | head -1 || true)"
  [ -n "$webm" ] || { echo "skip $key (pas de .webm)"; continue; }

  mp4="$VID/$key.mp4"
  echo ">> $key : $(basename "$webm") -> $mp4"
  # Carton-titre 2s + vidéo, ré-encodé en H.264 720p25, audio muet ajouté pour
  # une concat homogène.
  esc_label=$(printf '%s' "$label" | sed "s/:/\\\:/g; s/'/\\\\\\\\'/g")
  ffmpeg -y -loglevel error \
    -f lavfi -t 2 -i "color=c=0x0B1220:s=1280x720:r=25" \
    -i "$webm" \
    -f lavfi -t 0.1 -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -filter_complex "\
      [0:v]drawtext=fontfile='$FONT':text='$esc_label':fontcolor=white:fontsize=54:x=(w-tw)/2:y=(h-th)/2-30, \
           drawtext=fontfile='$FONT':text='EduPilot — parcours automatisé':fontcolor=0x7C8DB5:fontsize=26:x=(w-tw)/2:y=(h-th)/2+50[title]; \
      [1:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[body]; \
      [title][body]concat=n=2:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 26 -movflags +faststart "$mp4"

  echo "file '$mp4'" >> "$CONCAT_LIST"
done

# Vidéo combinée
if [ -s "$CONCAT_LIST" ]; then
  COMBINED="$VID/00-edupilot-tour-complet.mp4"
  echo ">> Combinaison -> $COMBINED"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$COMBINED" \
    || ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT_LIST" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 26 "$COMBINED"
  echo "OK combinée : $COMBINED"
fi

echo "=== Vidéos générées ==="
ls -lh "$VID"/*.mp4
