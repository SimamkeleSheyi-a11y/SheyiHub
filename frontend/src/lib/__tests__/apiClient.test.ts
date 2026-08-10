import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/lib/apiClient";

describe("ApiError", () => {
  it("surfaces the specific field error instead of the generic summary when there's exactly one", () => {
    const err = new ApiError(400, "Validation failed.", "error", {
      participant_emails: ["One or more of those users don't exist."],
    });
    expect(err.message).toBe("One or more of those users don't exist.");
  });

  it("falls back to the generic summary when there are multiple field errors", () => {
    const err = new ApiError(400, "Validation failed.", "error", {
      email: ["Required."],
      password: ["Too short."],
    });
    expect(err.message).toBe("Validation failed.");
  });

  it("uses the plain detail message when there are no field errors", () => {
    const err = new ApiError(403, "Please verify your email address to do this.", "permission_denied");
    expect(err.message).toBe("Please verify your email address to do this.");
  });
});

describe("apiFetch network failure handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("wraps a raw fetch failure in a specific, recognizable ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiFetch("/whatever")).rejects.toMatchObject({
      code: "network",
      message: "Network connection lost. Check your connection and try again.",
    });
  });
});
