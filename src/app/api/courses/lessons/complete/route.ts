import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json({ error: "Not Implemented: Schema missing LessonProgress" }, { status: 501 });
}
