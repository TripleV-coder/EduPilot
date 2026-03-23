#!/usr/bin/env node
/**
 * Fix Next.js 15 params Promise: add "const { id } = await params;" after "try {"
 * in handlers that have params: Promise<{ id: string }> and use params.id or id from params.
 * Replaces params.id with id.
 */
import fs from "fs";
import path from "path";

const apiDir = path.join(process.cwd(), "src/app/api");

const filesWithParamsId = [
  "payments/[id]/invoice/route.ts",
  "orientation/[id]/validate/route.ts",
  "teachers/[id]/availability/route.ts",
  "events/[id]/participate/route.ts",
  "medical-records/[id]/vaccinations/route.ts",
  "medical-records/[id]/emergency-contacts/route.ts",
  "medical-records/[id]/allergies/route.ts",
  "compliance/data-requests/[id]/route.ts",
  "modules/[id]/route.ts",
  "modules/[id]/lessons/route.ts",
  "appointments/[id]/route.ts",
  "periods/[id]/route.ts",
  "lessons/[id]/route.ts",
  "scholarships/[id]/route.ts",
  "exams/sessions/[id]/submit/route.ts",
  "courses/[id]/route.ts",
  "users/[id]/delete/route.ts",
  "homework/submissions/[id]/grade/route.ts",
  "payment-plans/[id]/route.ts",
  "lessons/[id]/complete/route.ts",
  "resources/[id]/download/route.ts",
  "incidents/[id]/route.ts",
  "incidents/[id]/sanctions/route.ts",
  "certificates/[id]/route.ts",
  "exams/[id]/start/route.ts",
  "courses/[id]/enroll/route.ts",
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("params: Promise<{ id: string }>") && !content.includes("params: Promise<{ id: string; installmentId: string }>")) {
    return false;
  }
  // Replace params.id with id (only when it's the route param)
  content = content.replace(/\bparams\.id\b/g, "id");
  // Add "const { id } = await params;" after "try {" when not already present in that handler
  // Match: export async function X(...) { try { and next line is not const { id }
  const tryBlockRegex = /(export async function \w+\([^)]+\)\s*\{\s*try\s*\{\s*)(\n)(\s*)(?!const \{ id \} = await params)/g;
  content = content.replace(tryBlockRegex, (_, before, nl, spaces) => {
    return before + nl + spaces + "const { id } = await params;" + nl + spaces;
  });
  fs.writeFileSync(filePath, content);
  return true;
}

// Special: payment-plans [id] installments [installmentId] pay
const installmentPath = path.join(apiDir, "payment-plans/[id]/installments/[installmentId]/pay/route.ts");
if (fs.existsSync(installmentPath)) {
  let content = fs.readFileSync(installmentPath, "utf8");
  content = content.replace(/\{ params \}: \{ params: \{ id: string; installmentId: string \} \}/g,
    "{ params }: { params: Promise<{ id: string; installmentId: string }> }");
  content = content.replace(/(export async function POST\([^)]+\)\s*\{\s*try\s*\{\s*)(\n)/,
    "$1\n    const { id, installmentId } = await params;\n");
  content = content.replace(/\bparams\.installmentId\b/g, "installmentId");
  content = content.replace(/\bparams\.id\b/g, "id");
  fs.writeFileSync(installmentPath, content);
}

for (const rel of filesWithParamsId) {
  const full = path.join(apiDir, rel);
  if (fs.existsSync(full)) {
    const done = fixFile(full);
    if (done) console.log("Fixed:", rel);
  }
}

console.log("Done.");
