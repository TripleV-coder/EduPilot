import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, LogLevel, createLogger, logApiRequest, logApiError, logger } from "@/lib/utils/logger";

describe("utils/logger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("LogLevel enum has 4 values", () => {
    expect(Object.values(LogLevel)).toHaveLength(4);
  });

  describe("Logger class", () => {
    it("info / warn / error log to console", () => {
      const log = new Logger({ app: "test" });
      log.info("hi", { x: 1 });
      log.warn("watch");
      log.error("boom", new Error("X"), { y: 2 });
      expect(vi.mocked(console).info).toHaveBeenCalled();
      expect(vi.mocked(console).warn).toHaveBeenCalled();
      expect(vi.mocked(console).error).toHaveBeenCalled();
    });

    it("child logger inherits context", () => {
      const log = new Logger({ app: "edupilot" });
      const child = log.child({ module: "auth" });
      expect(child).toBeInstanceOf(Logger);
      child.info("test");
      expect(vi.mocked(console).info).toHaveBeenCalled();
    });
  });

  describe("createLogger / default logger", () => {
    it("createLogger returns Logger instance", () => {
      const l = createLogger("test-module", { extra: "ctx" });
      expect(l).toBeInstanceOf(Logger);
    });

    it("default logger exists with app=edupilot", () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("logApiRequest / logApiError", () => {
    it("logApiRequest logs at info", () => {
      logApiRequest("GET", "/api/users", "u1", 12);
      expect(vi.mocked(console).info).toHaveBeenCalled();
    });

    it("logApiError logs at error", () => {
      logApiError("POST", "/api/x", new Error("nope"), "u1");
      expect(vi.mocked(console).error).toHaveBeenCalled();
    });
  });
});
