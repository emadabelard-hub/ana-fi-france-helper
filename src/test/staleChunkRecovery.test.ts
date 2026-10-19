import { describe, expect, it, vi } from "vitest";
import { recoverStaleChunk } from "../lib/staleChunkRecovery";

const error = new TypeError("Failed to fetch dynamically imported module: /assets/Index-old.js");
const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

describe("Stale page recovery", () => {
  it("reloads once for a stale chunk and never repeats for the same missing asset", () => {
    const s = storage();
    const reload = vi.fn();
    expect(recoverStaleChunk(error, s, reload)).toBe(true);
    expect(recoverStaleChunk(error, s, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("does not reload for ordinary fetch failures", () => {
    const reload = vi.fn();
    expect(recoverStaleChunk(new TypeError("Failed to fetch"), storage(), reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
  it("does not risk a reload loop when session storage is blocked", () => {
    const reload = vi.fn();
    expect(recoverStaleChunk(error, { getItem: () => { throw new Error("Blocked"); }, setItem: vi.fn() }, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});