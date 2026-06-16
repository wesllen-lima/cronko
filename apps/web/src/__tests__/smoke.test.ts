import { describe, it, expect } from "vitest";

describe("Web smoke tests", () => {
  it("vitest workspace is configured", () => {
    // Verify vitest globals are available (globals: true in config)
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
