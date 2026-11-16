"use client";
import { afterSync } from "./store";

// Client-side analytics. Events are batched and sent to /api/events; they never block the UI.
//   Content events (generated, edited, copied, scheduled, ...) need a postId or generationId.
//   Anything else is a product event (onboarding_step, door_chosen, ...).

interface TrackEvent {
  name: string;
  props?: Record<string, unknown>;
  postId?: string;
  generationId?: string;
  brandId?: string;
}

let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const events = queue;
  queue = [];
  // Content events point at a post that may still be saving.
  const waits = [...new Set(events.map((e) => e.postId).filter(Boolean) as string[])].map((id) => afterSync(id));
  Promise.all(waits)
    .then(() =>
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      })
    )
    .catch(() => undefined);
}

export function track(name: string, data: Omit<TrackEvent, "name"> = {}) {
  queue.push({ name, ...data });
  if (!timer) timer = setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}

/** Explicit rating of a generation (thumbs: 1 / -1). */
export async function sendFeedback(input: { postId?: string; generationId?: string; rating: number; reasons?: string[]; comment?: string }) {
  if (input.postId) await afterSync(input.postId);
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't send feedback");
}

export { editRatio } from "./edit-ratio";
