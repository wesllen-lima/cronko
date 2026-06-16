import { describe, it, expect } from "vitest";
import { monitors, heartbeats, incidents, users, settings } from "../schema";

describe("Database smoke tests", () => {
  it("exports schema tables", () => {
    expect(monitors).toBeDefined();
    expect(heartbeats).toBeDefined();
    expect(incidents).toBeDefined();
    expect(users).toBeDefined();
    expect(settings).toBeDefined();
  });
});