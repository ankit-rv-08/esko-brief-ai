import { describe, expect, it } from "vitest";
import { workspaceLayout } from "./responsive";

describe("workspace breakpoints", () => {
  it("uses mobile below 768px", () => {
    expect(workspaceLayout(767)).toBe("mobile");
  });
  it("uses tablet from 768 through 1024px", () => {
    expect(workspaceLayout(768)).toBe("tablet");
    expect(workspaceLayout(1024)).toBe("tablet");
  });
  it("uses three columns above 1024px", () => {
    expect(workspaceLayout(1025)).toBe("desktop");
  });
});