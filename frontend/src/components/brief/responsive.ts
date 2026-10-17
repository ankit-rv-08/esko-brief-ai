export type WorkspacePanel = "brief" | "sources" | "evidence";

export function workspaceLayout(width: number) {
  return width < 768 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
}