import { describe, it, expect } from "vitest";

describe("API smoke tests", () => {
  it("vitest workspace is configured with globals", () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
