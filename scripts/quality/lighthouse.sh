#!/usr/bin/env bash
# Lighthouse (mobile par défaut, 4G lente simulée + CPU x4) sur des pages publiques et authentifiées.
# Usage : QUALITY_COOKIE="<cookie de session>" scripts/quality/lighthouse.sh <outdir> [page ...]
#   page = nom:chemin[:desktop]   ex. dashboard:/dashboard  grades:/dashboard/grades:desktop
# Requiert Chrome/Chromium. LIGHTHOUSE_BIN surcharge le binaire (défaut : npx lighthouse@12).
set -euo pipefail
OUT=${1:?outdir requis}; shift
BASE=${QUALITY_BASE_URL:-http://localhost:3100}
LH=${LIGHTHOUSE_BIN:-"npx --yes lighthouse@12"}
PAGES=("$@"); [ ${#PAGES[@]} -eq 0 ] && PAGES=(landing:/ login:/login dashboard:/dashboard dashboard-desktop:/dashboard:desktop grades-desktop:/dashboard/grades:desktop)
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
for spec in "${PAGES[@]}"; do
  IFS=: read -r name path mode <<<"$spec"
  args=(--quiet --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$OUT/$name.json")
  [ "${mode:-}" = "desktop" ] && args+=(--preset=desktop)
  [ -n "${QUALITY_COOKIE:-}" ] && args+=(--extra-headers="{\"Cookie\":\"$QUALITY_COOKIE\"}")
  $LH "$BASE$path" "${args[@]}" >/dev/null 2>&1 || true
  node -e '
    const r = require(process.argv[1]); const c = r.categories, a = r.audits;
    const f = (u) => (u && u.numericValue != null ? Math.round(u.numericValue) : "-");
    console.log(JSON.stringify({ page: process.argv[2], perf: c.performance.score, a11y: c.accessibility.score, bp: c["best-practices"].score, seo: c.seo.score,
      FCP: f(a["first-contentful-paint"]), LCP: f(a["largest-contentful-paint"]), TBT: f(a["total-blocking-time"]),
      CLS: a["cumulative-layout-shift"].numericValue.toFixed(3), weightKB: Math.round(a["total-byte-weight"].numericValue / 1024),
      requests: a["network-requests"].details.items.length }));' "$OUT/$name.json" "$name"
done
