#!/usr/bin/env python3
"""Mechanical createApiHandler migrator for EduPilot API routes."""
import re
import sys
from pathlib import Path

ROOT = Path("src/app/api")
SKIP_EXACT = {"auth/[...nextauth]/route.ts"}

PUBLIC = {
    "auth/first-login/route.ts",
    "auth/forgot-password/route.ts",
    "auth/reset-password/route.ts",
    "auth/register/route.ts",
    "auth/verify-email/route.ts",
    "auth/initial-setup/route.ts",
    "setup/route.ts",
    "public/schools/route.ts",
    "public/schools/[code]/route.ts",
    "health/route.ts",
    "docs/route.ts",
    "payments/webhook/route.ts",
    "payments/momo/webhook/route.ts",
    "payments/fedapay/webhook/route.ts",
    "system/automation/route.ts",
    "system/health/route.ts",
    "analytics/web-vitals/route.ts",
    "ux/events/route.ts",
}

METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")


def strip_auth_session(body: str) -> str:
    lines = body.splitlines(True)
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*const\s+session\s*=\s*await\s+auth\(\)\s*;\s*$", line):
            indent = re.match(r"^(\s*)", line).group(1)
            out.append(f"{indent}const session = context.session;\n")
            i += 1
            if i < len(lines) and re.match(r"^\s*if\s*\(\s*!session", lines[i]):
                if_indent = len(re.match(r"^(\s*)", lines[i]).group(1))
                i += 1
                while i < len(lines):
                    m = re.match(r"^(\s*)\}", lines[i])
                    if m and len(m.group(1)) <= if_indent and lines[i].strip() == "}":
                        i += 1
                        break
                    i += 1
            continue
        out.append(line)
        i += 1
    return "".join(out)


def find_matching_brace(s: str, open_idx: int) -> int:
    depth = 0
    i = open_idx
    in_str = None
    escape = False
    while i < len(s):
        c = s[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == in_str:
                in_str = None
        else:
            if c in ('"', "'", "`"):
                in_str = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1


def migrate_content(rel: str, content: str) -> str | None:
    if "createApiHandler" in content:
        return None
    if rel in SKIP_EXACT:
        return None

    require_auth = rel not in PUBLIC
    options = "{ requireAuth: false }" if not require_auth else "{}"

    import_line = 'import { createApiHandler } from "@/lib/api/api-helpers";\n'
    imports = list(re.finditer(r"^import .+?;\s*\n", content, re.M))
    if imports:
        last = imports[-1]
        content = content[: last.end()] + import_line + content[last.end() :]
    else:
        content = import_line + content

    for method in METHODS:
        pattern = re.compile(
            rf"export\s+async\s+function\s+{method}\s*\(([^)]*)\)\s*\{{",
            re.M,
        )
        while True:
            m = pattern.search(content)
            if not m:
                break
            brace_open = m.end() - 1
            brace_close = find_matching_brace(content, brace_open)
            if brace_close < 0:
                print(f"FAIL brace {rel} {method}", file=sys.stderr)
                return None
            params_sig = m.group(1).strip()
            body = content[brace_open + 1 : brace_close]
            body = strip_auth_session(body)

            needs_params = "params" in params_sig
            preamble = ""
            if needs_params and "context.params" not in body:
                preamble = "    const params = await context.params;\n"
                body = re.sub(r"await\s+params\b", "params", body)

            new_fn = (
                f"export const {method} = createApiHandler(\n"
                f"    async (request, context) => {{\n"
                f"{preamble}{body}"
                f"    }},\n"
                f"    {options},\n"
                f");\n"
            )
            content = content[: m.start()] + new_fn + content[brace_close + 1 :]

    if "await auth(" not in content and not re.search(r"\bauth\s*\(", content):
        content = re.sub(
            r'^import\s*\{\s*auth\s*\}\s*from\s*["\']@/lib/auth["\'];\s*\n',
            "",
            content,
            flags=re.M,
        )
        content = re.sub(
            r'^import\s*\{\s*auth\s*,\s*([^}]+)\}\s*from\s*["\']@/lib/auth["\'];\s*\n',
            r'import { \1} from "@/lib/auth";\n',
            content,
            flags=re.M,
        )
        content = re.sub(
            r'^import\s*\{\s*([^}]*),\s*auth\s*\}\s*from\s*["\']@/lib/auth["\'];\s*\n',
            r'import { \1} from "@/lib/auth";\n',
            content,
            flags=re.M,
        )

    if "export const " in content and "createApiHandler" in content:
        return content
    return None


def main() -> None:
    migrated = []
    failed = []
    already = 0
    special = []

    for path in sorted(ROOT.rglob("route.ts")):
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        if rel in SKIP_EXACT:
            special.append(rel)
            continue
        text = path.read_text(encoding="utf-8")
        if "createApiHandler" in text:
            already += 1
            continue
        if re.match(r"^\s*export\s*\{", text) and "async function" not in text:
            special.append(rel + " (reexport)")
            continue
        if "export async function" not in text:
            if re.search(
                r"export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async", text
            ):
                failed.append(rel + " (arrow export)")
            else:
                special.append(rel + " (no handlers)")
            continue

        new = migrate_content(rel, text)
        if new is None:
            failed.append(rel)
            continue
        path.write_text(new, encoding="utf-8")
        migrated.append(rel)

    print(f"MIGRATED {len(migrated)}")
    for r in migrated:
        print(" +", r)
    print(f"FAILED {len(failed)}")
    for r in failed:
        print(" !", r)
    print(f"ALREADY {already}")
    print(f"SPECIAL {len(special)}")
    for r in special:
        print(" ~", r)


if __name__ == "__main__":
    main()
