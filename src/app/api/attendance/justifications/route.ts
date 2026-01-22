import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json({ error: "Not Implemented: Schema missing AbsenceJustification" }, { status: 501 });
}

export async function GET(_request: Request) {
  return NextResponse.json({ error: "Not Implemented: Schema missing AbsenceJustification" }, { status: 501 });
}
