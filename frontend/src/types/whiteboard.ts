export type WhiteboardTool = "draw" | "erase";

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  author_id: string | null;
  author_name: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: WhiteboardPoint[];
  created_at: string;
}

export interface WhiteboardSnapshot {
  meeting_id: string;
  strokes: WhiteboardStroke[];
}
