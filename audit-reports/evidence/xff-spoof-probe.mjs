// Sonde H3 bis : 12 échecs de connexion sur UN compte, X-Forwarded-For différent à chaque essai.
// Si l'en-tête était cru, chaque essai aurait un compteur neuf (clé = IP + compte) : aucun 429.
const BASE = process.env.QUALITY_BASE_URL;
const st = {};
for (let i = 0; i < 12; i++) {
  const ip = `198.51.100.${i + 1}`;
  const c = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": ip } });
  const cookie = (c.headers.getSetCookie?.() ?? []).map((h) => h.split(";")[0]).join("; ");
  const { csrfToken } = await c.json();
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, "x-forwarded-for": ip },
    body: new URLSearchParams({ csrfToken, email: "xff-probe@example.invalid", password: "wrong", json: "true" }),
  });
  await r.arrayBuffer();
  st[r.status] = (st[r.status] || 0) + 1;
}
console.log(JSON.stringify(st), (st[429] || 0) > 0 ? "PASS : XFF usurpé ignoré, compteur partagé" : "FAIL : XFF cru, limite contournée");
