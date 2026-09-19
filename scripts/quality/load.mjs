// Charge légère (autocannon) : 10 connexions × 15 s par endpoint, rôle SCHOOL_ADMIN.
// Usage : node scripts/quality/load.mjs ["/api/classes,/api/students?limit=20,/login"]
import autocannon from "autocannon";
import { BASE, login, fakeIp, ROLE_ACCOUNTS, DEMO_PASSWORD } from "./lib.mjs";

const { cookie } = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN, DEMO_PASSWORD);
const paths = (process.argv[2] || "/api/classes,/api/students?limit=20,/login").split(",");
for (const path of paths) {
  const r = await autocannon({
    url: `${BASE}${path}`,
    connections: Number(process.env.QUALITY_CONNECTIONS || 10),
    duration: Number(process.env.QUALITY_DURATION || 15),
    requests: [
      {
        setupRequest(req) {
          req.headers = { ...req.headers, cookie, "x-forwarded-for": fakeIp() };
          return req;
        },
      },
    ],
  });
  console.log(
    JSON.stringify({ path, rps: r.requests.average, p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, errors: r.errors, timeouts: r.timeouts, non2xx: r.non2xx, "4xx": r["4xx"], "5xx": r["5xx"] }),
  );
}
