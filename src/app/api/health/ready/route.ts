import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Readiness probe: can this pod actually serve traffic right now — i.e. is
// the database reachable. Kubernetes stops routing traffic to a pod that
// fails this without restarting it (unlike a liveness failure).
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
