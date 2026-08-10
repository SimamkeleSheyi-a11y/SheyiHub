import { useQuery } from "@tanstack/react-query";
import { Eraser, Pencil, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/Button";
import { meetingsApi } from "@/features/meetings/api";
import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { WhiteboardPoint, WhiteboardStroke, WhiteboardTool } from "@/types/whiteboard";

const PEN_COLOURS = ["#111827", "#2563EB", "#DC2626", "#16A34A", "#7C3AED"];
const PEN_WIDTHS = [2, 4, 8];

interface MeetingWhiteboardProps {
  meetingId: string;
  live?: boolean;
  isHost?: boolean;
  className?: string;
}

export function MeetingWhiteboard({ meetingId, live = false, isHost = false, className = "" }: MeetingWhiteboardProps) {
  const me = useAuthStore((state) => state.user);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<WhiteboardStroke[]>([]);
  const activePointsRef = useRef<WhiteboardPoint[]>([]);
  const drawingRef = useRef(false);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [tool, setTool] = useState<WhiteboardTool>("draw");
  const [colour, setColour] = useState(PEN_COLOURS[0]);
  const [penWidth, setPenWidth] = useState(4);
  const [clearArmed, setClearArmed] = useState(false);

  const snapshotQuery = useQuery({
    queryKey: ["meeting-whiteboard", meetingId],
    queryFn: () => meetingsApi.whiteboard(meetingId),
    enabled: !!meetingId,
  });

  useEffect(() => {
    if (snapshotQuery.data) setStrokes(snapshotQuery.data.strokes);
  }, [snapshotQuery.data]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const upsertStroke = useCallback((stroke: WhiteboardStroke) => {
    setStrokes((current) => {
      const index = current.findIndex((item) => item.id === stroke.id);
      if (index === -1) return [...current, stroke];
      const next = [...current];
      next[index] = stroke;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!live) return;
    const offStroke = wsClient.on("whiteboard.stroke", (data) => {
      if (data.meeting_id !== meetingId) return;
      upsertStroke(data.stroke as unknown as WhiteboardStroke);
    });
    const offClear = wsClient.on("whiteboard.cleared", (data) => {
      if (data.meeting_id !== meetingId) return;
      setStrokes([]);
      toast.info("The whiteboard was cleared.");
    });
    const offRemoved = wsClient.on("whiteboard.removed", (data) => {
      if (data.meeting_id !== meetingId) return;
      const strokeId = data.stroke_id as string;
      setStrokes((current) => current.filter((stroke) => stroke.id !== strokeId));
    });
    return () => {
      offStroke();
      offClear();
      offRemoved();
    };
  }, [live, meetingId, upsertStroke]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx || rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, rect.width, rect.height);
  }, []);

  useEffect(() => {
    redraw();
  }, [redraw, strokes]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [redraw]);

  const currentWidth = tool === "erase" ? 24 : penWidth;

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): WhiteboardPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!live || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    activePointsRef.current = [pointFromEvent(event)];
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!live || !drawingRef.current) return;
    const next = pointFromEvent(event);
    const points = activePointsRef.current;
    const previous = points[points.length - 1];
    if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < 0.0015) return;
    points.push(next);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !previous) return;
    const rect = canvas.getBoundingClientRect();
    drawSegment(ctx, previous, next, rect.width, rect.height, tool, colour, currentWidth);
  }

  async function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!live || !drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = activePointsRef.current;
    activePointsRef.current = [];
    if (!points.length) return;

    const stroke: WhiteboardStroke = {
      id: crypto.randomUUID(),
      author_id: me?.id ?? null,
      author_name: me?.display_name ?? "You",
      tool,
      color: tool === "erase" ? "#000000" : colour,
      width: currentWidth,
      points,
      created_at: new Date().toISOString(),
    };
    upsertStroke(stroke);

    const connected = await wsClient.waitUntilConnected();
    const sent = connected && wsClient.send({
      type: "whiteboard-stroke",
      meeting_id: meetingId,
      stroke: {
        id: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points,
      },
    });
    if (!sent) {
      setStrokes((current) => current.filter((item) => item.id !== stroke.id));
      toast.error("Couldn't save that stroke. Realtime connection is unavailable.");
    }
  }

  async function undoOwnStroke() {
    if (!live) return;
    const sent = await wsClient.waitUntilConnected() && wsClient.send({ type: "whiteboard-undo", meeting_id: meetingId });
    if (!sent) toast.error("Couldn't undo while realtime is disconnected.");
  }

  async function clearBoard() {
    if (!isHost || !live) return;
    if (!clearArmed) {
      setClearArmed(true);
      window.setTimeout(() => setClearArmed(false), 3500);
      return;
    }
    setClearArmed(false);
    const sent = await wsClient.waitUntilConnected() && wsClient.send({ type: "whiteboard-clear", meeting_id: meetingId });
    if (!sent) toast.error("Couldn't clear the board while realtime is disconnected.");
  }

  const statusText = useMemo(() => {
    if (snapshotQuery.isLoading) return "Loading board…";
    if (snapshotQuery.isError) return "Couldn't load saved board";
    if (!live) return `${strokes.length} saved ${strokes.length === 1 ? "stroke" : "strokes"}`;
    return "Live collaborative board";
  }, [live, snapshotQuery.isError, snapshotQuery.isLoading, strokes.length]);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-900 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-stone-950/70 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-white">Whiteboard</p>
          <p className="text-xs text-stone-400">{statusText}</p>
        </div>

        {live ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTool("draw")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${tool === "draw" ? "bg-ember text-stone-950" : "bg-white/10 text-white hover:bg-white/15"}`}
              aria-label="Pen tool"
            >
              <Pencil className="size-3.5" /> Pen
            </button>
            <button
              type="button"
              onClick={() => setTool("erase")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${tool === "erase" ? "bg-ember text-stone-950" : "bg-white/10 text-white hover:bg-white/15"}`}
              aria-label="Eraser tool"
            >
              <Eraser className="size-3.5" /> Erase
            </button>

            <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

            <div className="flex items-center gap-1" aria-label="Pen colours">
              {PEN_COLOURS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Use colour ${item}`}
                  onClick={() => { setColour(item); setTool("draw"); }}
                  className={`size-6 rounded-full border-2 ${colour === item && tool === "draw" ? "border-white" : "border-white/20"}`}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>

            <select
              aria-label="Pen width"
              value={penWidth}
              onChange={(event) => { setPenWidth(Number(event.target.value)); setTool("draw"); }}
              className="h-9 rounded-lg border border-white/10 bg-white/10 px-2 text-xs text-white outline-none"
            >
              {PEN_WIDTHS.map((width) => <option key={width} value={width} className="bg-stone-900">{width}px</option>)}
            </select>

            <button
              type="button"
              onClick={() => void undoOwnStroke()}
              className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/15"
              aria-label="Undo my last stroke"
            >
              <Undo2 className="size-4" />
            </button>

            {isHost ? (
              <Button size="sm" variant={clearArmed ? "destructive" : "ghost"} onClick={() => void clearBoard()}>
                <Trash2 className="size-4" /> {clearArmed ? "Confirm clear" : "Clear"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div ref={wrapperRef} className="relative min-h-[360px] flex-1 bg-white">
        {snapshotQuery.isError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm text-stone-600">
            The saved whiteboard couldn't be loaded.
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none ${live ? (tool === "erase" ? "cursor-cell" : "cursor-crosshair") : "cursor-default"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => void finishStroke(event)}
          onPointerCancel={(event) => void finishStroke(event)}
          aria-label={live ? "Collaborative meeting whiteboard" : "Saved meeting whiteboard"}
        />
      </div>
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke, width: number, height: number) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
  for (let i = 1; i < stroke.points.length; i += 1) {
    const point = stroke.points[i];
    ctx.lineTo(point.x * width, point.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  from: WhiteboardPoint,
  to: WhiteboardPoint,
  width: number,
  height: number,
  tool: WhiteboardTool,
  colour: string,
  strokeWidth: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = colour;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * width, from.y * height);
  ctx.lineTo(to.x * width, to.y * height);
  ctx.stroke();
  ctx.restore();
}
