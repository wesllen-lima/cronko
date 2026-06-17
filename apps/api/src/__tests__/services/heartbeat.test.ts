import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMonitorByToken = vi.fn();
const mockUpdateMonitorStatus = vi.fn();
const mockCreateHeartbeat = vi.fn();
const mockFindLatestHeartbeat = vi.fn();
const mockUpdateHeartbeatDuration = vi.fn();
const mockCreateIncident = vi.fn();
const mockFindOpenIncident = vi.fn();
const mockResolveIncident = vi.fn();

vi.mock("@cronko/database/queries/monitors", () => ({
  findMonitorByToken: (...args: unknown[]) => mockFindMonitorByToken(...args),
  updateMonitorStatus: (...args: unknown[]) => mockUpdateMonitorStatus(...args),
}));

vi.mock("@cronko/database/queries/heartbeats", () => ({
  createHeartbeat: (...args: unknown[]) => mockCreateHeartbeat(...args),
  findLatestHeartbeat: (...args: unknown[]) => mockFindLatestHeartbeat(...args),
  updateHeartbeatDuration: (...args: unknown[]) => mockUpdateHeartbeatDuration(...args),
}));

vi.mock("@cronko/database/queries/incidents", () => ({
  createIncident: (...args: unknown[]) => mockCreateIncident(...args),
  findOpenIncident: (...args: unknown[]) => mockFindOpenIncident(...args),
  resolveIncident: (...args: unknown[]) => mockResolveIncident(...args),
}));

import { processHeartbeat } from "../../services/heartbeat";

function mockMonitor(overrides: Record<string, unknown> = {}) {
  return {
    id: "mon-1",
    name: "Test Monitor",
    status: "healthy",
    paused: false,
    token: "tok-1",
    slug: "test-monitor",
    expectedIntervalSeconds: 86400,
    gracePeriodSeconds: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("processHeartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when monitor is not found", async () => {
    mockFindMonitorByToken.mockResolvedValue(null);

    const result = await processHeartbeat("invalid-token", {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Monitor not found");
  });

  it("returns paused status when monitor is paused", async () => {
    mockFindMonitorByToken.mockResolvedValue(mockMonitor({ paused: true }));

    const result = await processHeartbeat("tok-1", {});

    expect(result.ok).toBe(true);
    expect((result as { data: { status: string } }).data.status).toBe("paused");
  });

  it("creates heartbeat and returns ok for normal ping", async () => {
    mockFindMonitorByToken.mockResolvedValue(mockMonitor());
    mockFindLatestHeartbeat.mockResolvedValue({ receivedAt: new Date(), durationMs: 1000 });
    mockCreateHeartbeat.mockResolvedValue({});

    const result = await processHeartbeat("tok-1", { sourceIp: "1.2.3.4" });

    expect(result.ok).toBe(true);
    expect(mockCreateHeartbeat).toHaveBeenCalled();
  });

  it("creates incident when duration exceeds maxDurationMs", async () => {
    mockFindMonitorByToken.mockResolvedValue(
      mockMonitor({ maxDurationMs: 5000 }),
    );
    mockFindLatestHeartbeat.mockResolvedValue({ receivedAt: new Date(), durationMs: null });
    mockCreateHeartbeat.mockResolvedValue({});
    mockCreateIncident.mockResolvedValue({});
    mockUpdateMonitorStatus.mockResolvedValue({});

    await processHeartbeat("tok-1", { durationMs: 10000 });

    expect(mockCreateIncident).toHaveBeenCalled();
    expect(mockUpdateMonitorStatus).toHaveBeenCalledWith("mon-1", "missed");
  });

  it("resolves incident and sets healthy on recovery", async () => {
    mockFindMonitorByToken.mockResolvedValue(mockMonitor({ status: "down" }));
    mockFindLatestHeartbeat.mockResolvedValue({ receivedAt: new Date(), durationMs: 500 });
    mockCreateHeartbeat.mockResolvedValue({});
    mockFindOpenIncident.mockResolvedValue({ id: "inc-1", status: "open" });
    mockUpdateMonitorStatus.mockResolvedValue({});
    mockResolveIncident.mockResolvedValue({});

    await processHeartbeat("tok-1", {});

    expect(mockUpdateMonitorStatus).toHaveBeenCalledWith("mon-1", "healthy");
    expect(mockResolveIncident).toHaveBeenCalled();
  });
});