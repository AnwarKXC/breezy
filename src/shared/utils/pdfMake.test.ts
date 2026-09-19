import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  applyPdfFonts,
  buildAndDownloadPdf,
  buildArabicDocDef,
  formatCurrency,
  getPdfFont,
  getPdfMake,
} from "./pdfMake";

const fontFiles = ["NotoSansArabic-Regular.ttf", "NotoSansArabic-Bold.ttf"];

function fontTables(font: Buffer) {
  const tableCount = font.readUInt16BE(4);
  return new Set(
    Array.from({ length: tableCount }, (_, index) =>
      font.toString("ascii", 12 + index * 16, 16 + index * 16),
    ),
  );
}

describe("Arabic PDF font", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const font = readFileSync(resolve(process.cwd(), `public${url}`));
        return {
          ok: true,
          arrayBuffer: async () =>
            font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
        };
      }),
    );
  });

  it("uses static Arabic OpenType fonts supported by pdfmake", () => {
    for (const fileName of fontFiles) {
      const tables = fontTables(
        readFileSync(resolve(process.cwd(), `public/fonts/${fileName}`)),
      );
      expect(tables).toContain("cmap");
      expect(tables).toContain("GSUB");
      expect(tables).not.toContain("fvar");
    }

    expect(buildArabicDocDef({}).defaultStyle).toMatchObject({
      font: "NotoSansArabic",
    });
    expect(getPdfFont("\u0623\u062d\u0645\u062f", "ar")).toBe(
      "NotoSansArabic",
    );
    expect(getPdfFont("ahmed@example.com", "ar")).toBe("Arial");
    expect(
      applyPdfFonts(
        [{ text: "TAX INVOICE" }, { text: "\u0641\u0627\u062a\u0648\u0631\u0629" }],
        "ar",
      ),
    ).toEqual([
      { text: "TAX INVOICE", font: "Arial" },
      { text: "\u0641\u0627\u062a\u0648\u0631\u0629", font: "NotoSansArabic" },
    ]);
    expect(
      applyPdfFonts({ text: "Invoice \u0623\u062d\u0645\u062f | Thank you" }, "ar"),
    ).toEqual({
      text: [
        { text: "Invoice\u00A0", font: "Arial" },
        { text: "\u0623\u062d\u0645\u062f\u00A0", font: "NotoSansArabic" },
        { text: "|\u00A0Thank\u00A0you", font: "Arial" },
      ],
    });
    expect(applyPdfFonts({ text: "\u0623\u062d\u0645\u062f \u0645\u062d\u0645\u062f" }, "ar")).toEqual({
      text: "\u0623\u062d\u0645\u062f\u00A0\u0645\u062d\u0645\u062f",
      font: "NotoSansArabic",
    });
    expect(formatCurrency(689.7, "EGP", "ar")).toBe("689.7 EGP");
  });

  it("initializes English PDF support without fetching Arabic fonts", async () => {
    await getPdfMake();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("generates a PDF with Arabic Unicode and bold font data", async () => {
    const pdfMake = await getPdfMake(true);
    expect(fetch).not.toHaveBeenCalled();
    const definition = buildArabicDocDef({
      content: [
        { text: "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646", bold: true },
        { text: "TAX INVOICE" },
        { text: "\u0623\u062d\u0645\u062f" },
      ],
    });
    const pdf = Buffer.from(await pdfMake.createPdf(definition).getBuffer());
    const source = pdf.toString("latin1");
    let unicodeMaps = "";

    for (const match of source.matchAll(/stream\r?\n/g)) {
      const start = match.index + match[0].length;
      const end = source.indexOf("endstream", start);
      let stream = pdf.subarray(start, end);
      while (stream.at(-1) === 10 || stream.at(-1) === 13) {
        stream = stream.subarray(0, -1);
      }
      try {
        const inflated = inflateSync(stream).toString("latin1");
        if (inflated.includes("begincmap")) unicodeMaps += inflated;
      } catch {
        // Not every PDF stream uses Flate compression.
      }
    }

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(source).toContain("NotoSansArabic-Bold");
    expect(source).toContain("Roboto-Regular");
    expect(unicodeMaps).toMatch(/<06[0-9a-f]{2}>/i);
  });

  it("embeds both Arabic and Latin fonts in mixed Arabic exports", async () => {
    let downloaded: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      downloaded = blob as Blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    await buildAndDownloadPdf({
      title: "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646",
      headers: ["\u0627\u0644\u0627\u0633\u0645", "Email"],
      rows: [["\u0623\u062d\u0645\u062f", "ahmed@example.com"]],
      locale: "ar",
      fileName: "users.pdf",
    });

    expect(downloaded).toBeDefined();
    const source = Buffer.from(await downloaded!.arrayBuffer()).toString("latin1");
    expect(source).toContain("NotoSansArabic");
    expect(source).toContain("Roboto-Regular");
  });
});