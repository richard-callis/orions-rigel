import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

// The running Twitch-style chat feed for a live session — ephemeral,
// unmoderated-beyond-length, separate from the curated LiveQuestion queue.
export async function GET(request: Request, { params }: Props) {
  const { id: liveSessionId } = await params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after");

  const messages = await db.liveChatMessage.findMany({
    where: {
      liveSessionId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    // Cap the initial/no-cursor load so a long session doesn't ship its
    // entire chat history on every poll — an "after" cursor only ever
    // fetches the small tail of new messages anyway.
    take: after ? undefined : 100,
  });

  return NextResponse.json({ messages });
}

const postSchema = z.object({ text: z.string().min(1).max(300) });

export async function POST(request: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: liveSessionId } = await params;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const liveSession = await db.liveSession.findUnique({ where: { id: liveSessionId } });
  if (!liveSession || !liveSession.isActive) {
    return NextResponse.json({ error: "Session is not live" }, { status: 400 });
  }

  const message = await db.liveChatMessage.create({
    data: {
      liveSessionId,
      userId: session.user.id,
      userName: session.user.name ?? "Anonymous",
      text: parsed.data.text,
    },
  });

  return NextResponse.json({ message });
}
