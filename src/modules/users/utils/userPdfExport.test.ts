import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAndDownloadPdf } from "@/shared/utils/pdfMake";
import { exportUsersPdf } from "./userPdfExport";

vi.mock("@/shared/utils/pdfMake", async () => {
  const actual = await vi.importActual<typeof import("@/shared/utils/pdfMake")>(
    "@/shared/utils/pdfMake",
  );
  return { ...actual, buildAndDownloadPdf: vi.fn() };
});

const downloadPdf = vi.mocked(buildAndDownloadPdf);

describe("exportUsersPdf", () => {
  beforeEach(() => downloadPdf.mockClear());

  it("uses a bidi-safe numeric date in Arabic PDFs", async () => {
    const createdAt = new Date(2026, 6, 27, 6, 20);

    await exportUsersPdf(
      [
        {
          id: "1",
          name: "\u0623\u062d\u0645\u062f",
          email: "ahmed@example.com",
          role: "front_desk",
          phone: "0123456789",
          createdAt: {
            seconds: Math.floor(createdAt.getTime() / 1000),
            nanoseconds: 0,
          },
        },
      ],
      {
        title: "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646",
        name: "\u0627\u0644\u0627\u0633\u0645",
        email: "\u0627\u0644\u0628\u0631\u064a\u062f",
        role: "\u0627\u0644\u062f\u0648\u0631",
        phone: "\u0627\u0644\u0647\u0627\u062a\u0641",
        createdAt: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
      },
      "ar",
      "users.pdf",
    );

    expect(downloadPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [[
          "\u0623\u062d\u0645\u062f",
          "ahmed@example.com",
          "front_desk",
          "0123456789",
          "2026-07-27 06:20",
        ]],
      }),
    );
  });
});