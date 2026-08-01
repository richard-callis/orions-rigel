import { NextResponse } from "next/server";

// Liveness probe: process is up and serving requests. Deliberately has no
// dependency on the database — a slow/unavailable DB should surface as a
// failing readiness probe, not get the pod killed and restarted.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
