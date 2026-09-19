import type { Locale } from "@/i18n/config";

function diagLog(...args: unknown[]) {
  console.log("[PDFMAKE]", ...args);
}

export class PdfMakeError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PdfMakeError";
  }
}

type PdfMakeInstance = {
  vfs: Record<string, string>;
  fonts: Record<string, Record<string, string>>;
  createPdf: (docDef: Record<string, unknown>) => {
    download: (name: string) => void;
    getBuffer: () => Promise<ArrayBuffer>;
  };
};

const ARABIC_FONT_FILES = {
  regular: "NotoSansArabic-Regular.ttf",
  bold: "NotoSansArabic-Bold.ttf",
} as const;

let pdfMakeReady: Promise<PdfMakeInstance> | null = null;
let arabicFontsReady: Promise<void> | null = null;


async function initPdfMake() {
  diagLog("initPdfMake: start");

  // Load pdfmake FIRST so window.pdfMake is registered before font
  // modules try to auto-register via side effects.
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const mod = pdfMakeModule as unknown as Record<string, unknown>;
  const pdfMake = (mod.default ?? pdfMakeModule) as unknown as PdfMakeInstance;
  diagLog("initPdfMake: pdfmake loaded");

  // Load VFS fonts — side effect finds window.pdfMake and auto-registers
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  const vfsData = (vfsModule.default ?? vfsModule) as Record<string, string>;

  // addVirtualFileSystem registers fonts in VirtualFileSystem.storage (0.3.x).
  // pdfMake.vfs = ... does NOT work. Must call the method.
  const api = pdfMake as unknown as {
    addVirtualFileSystem: (vfs: Record<string, string>) => void;
  };
  api.addVirtualFileSystem?.(vfsData);

  pdfMake.fonts = {
    Arial: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
    NotoSansArabic: {
      normal: ARABIC_FONT_FILES.regular,
      bold: ARABIC_FONT_FILES.bold,
      italics: ARABIC_FONT_FILES.regular,
      bolditalics: ARABIC_FONT_FILES.bold,
    },
  };
  diagLog("initPdfMake: done");
  return pdfMake;
}

async function loadArabicFonts(pdfMake: PdfMakeInstance) {
  arabicFontsReady ??= (async () => {
    const { ARABIC_PDF_FONT_VFS } = await import(
      "./arabicPdfFonts.generated"
    );
    const api = pdfMake as unknown as {
      addVirtualFileSystem: (vfs: Record<string, string>) => void;
    };
    api.addVirtualFileSystem?.(ARABIC_PDF_FONT_VFS);
  })().catch((error) => {
    arabicFontsReady = null;
    throw error;
  });
  await arabicFontsReady;
}

async function initPdfMakeSafe() {
  try {
    return await initPdfMake();
  } catch (err) {
    diagLog("initPdfMakeSafe: FAILED, resetting cache", err);
    pdfMakeReady = null;
    throw new PdfMakeError("PDF engine initialization failed", err);
  }
}

const C = {
  green: "#4A5B48",
  greenLight: "#7C8B76",
  greenBg: "#EDF0EB",
  warmBg: "#F8F9F7",
  white: "#FFFFFF",
  text: "#1C1C1C",
  textMuted: "#6B7280",
  border: "#E3E6E0",
} as const;

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getPdfMake(includeArabicFonts = false) {
  if (pdfMakeReady === null) diagLog("getPdfMake: cache MISS, initializing");
  pdfMakeReady ??= initPdfMakeSafe();
  const instance = await pdfMakeReady;
  if (includeArabicFonts) await loadArabicFonts(instance);
  diagLog("getPdfMake: success, has createPdf:", typeof instance.createPdf);
  return instance;
}

let qrCodeDataUrlCache: string | null = null;

/**
 * Loads /qr-code.jpeg as a data URL so it can be embedded in pdfMake
 * documents. Cached after the first successful load; resolves to null when
 * the asset is missing (PDF is generated without the QR).
 */
export async function getQrCodeDataUrl(): Promise<string | null> {
  if (qrCodeDataUrlCache !== null) return qrCodeDataUrlCache;
  try {
    const res = await fetch("/qr-code.jpeg");
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    qrCodeDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Inject /Direction /R2L into the PDF by finding the Catalog object
 * and adding /ViewerPreferences << /Direction /R2L >>.
 */
export function injectRTLOptions(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof Uint8Array) buffer = buffer.buffer as ArrayBuffer;
  const text = new TextDecoder("latin1").decode(buffer);

  // Find the trailer to get the Root (catalog) reference
  const trailerMatch = text.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  if (!trailerMatch) return buffer;

  const rootObjNum = trailerMatch[1];
  // Look for the catalog object: "NN 0 obj << /Type /Catalog ... >>"
  const catalogPattern = new RegExp(
    `${rootObjNum}\\s+0\\s+obj\\s*(<<[^>]*\\/Type\\s*\\/Catalog[^>]*>>)`,
  );
  const catalogMatch = text.match(catalogPattern);
  if (!catalogMatch) return buffer;

  const oldDict = catalogMatch[1];
  const insert = " /ViewerPreferences << /Direction /R2L >>";
  // Insert before the closing >>
  const closePos = oldDict.lastIndexOf(">>");
  if (closePos < 0) return buffer;

  const newDict =
    oldDict.substring(0, closePos) + insert + oldDict.substring(closePos);
  const delta = newDict.length - oldDict.length;
  const dictPos = catalogMatch.index! + catalogMatch[0].indexOf(oldDict);
  const modifyEnd = dictPos + oldDict.length;

  let newText =
    text.substring(0, dictPos) +
    newDict +
    text.substring(dictPos + oldDict.length);

  // Fix xref offsets
  const lastXrefIdx = newText.lastIndexOf("xref");
  if (lastXrefIdx < 0) return buffer;

  let afterXref = newText.substring(lastXrefIdx + 4);
  if (afterXref.startsWith("\r\n")) afterXref = afterXref.substring(2);
  else if (afterXref.startsWith("\n")) afterXref = afterXref.substring(1);

  const trailerIdx = afterXref.indexOf("trailer");
  if (trailerIdx < 0) return buffer;

  const xrefBody = afterXref.substring(0, trailerIdx);
  const fixedXrefLines = xrefBody
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\d{10}) (\d{5}) ([fn])/);
      if (!m || m[3] !== "n") return line;
      const offset = parseInt(m[1], 10);
      if (offset <= modifyEnd) return line;
      return `${String(offset + delta).padStart(10, "0")} ${m[2]} n`;
    })
    .join("\n");

  const fixedSection =
    newText.substring(lastXrefIdx, lastXrefIdx + 4) +
    "\n" +
    fixedXrefLines +
    "\n" +
    afterXref.substring(trailerIdx);
  newText = newText.substring(0, lastXrefIdx) + fixedSection;

  // Fix startxref
  const startxrefIdx = newText.lastIndexOf("startxref");
  if (startxrefIdx >= 0) {
    const tail = newText.substring(startxrefIdx + 9).trimStart();
    const valMatch = tail.match(/^(\d+)/);
    if (valMatch) {
      const newOffset = parseInt(valMatch[1], 10) + delta;
      const beforeVal = newText.substring(0, startxrefIdx + 9);
      const afterVal = tail.substring(valMatch[1].length);
      newText = beforeVal.trimEnd() + "\n" + newOffset + afterVal;
    }
  }

  const bytes = new Uint8Array(newText.length);
  for (let i = 0; i < newText.length; i++) bytes[i] = newText.charCodeAt(i) & 0xff;
  return bytes.buffer as ArrayBuffer;
}

export function buildArabicDocDef(
  docDef: Record<string, unknown>,
): Record<string, unknown> {
  const withFonts = applyPdfFonts(docDef, "ar");
  const existingDefault = (withFonts.defaultStyle as Record<string, unknown> | undefined) ?? {};
  return {
    ...withFonts,
    language: "ar-SA",
    defaultStyle: {
      ...existingDefault,
      font: "NotoSansArabic",
      alignment: "right",
    },
  };
}


/**
 * Check whether a string contains Arabic Unicode characters.
 */
function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function getPdfFont(text: string) {
  return hasArabic(text) ? "NotoSansArabic" : "Arial";
}

function splitMixedPdfText(text: string) {
  const runs: Array<{ text: string; font: string }> = [];
  let currentFont = "Arial";

  for (const character of text) {
    const font = hasArabic(character)
      ? "NotoSansArabic"
      : /\s/.test(character)
        ? currentFont
        : "Arial";
    currentFont = font;
    const last = runs.at(-1);
    if (last?.font === font) last.text += character;
    else runs.push({ text: character, font });
  }
  return runs;
}

export function applyPdfFonts<T>(value: T, locale: string): T {
  if (Array.isArray(value)) {
    return value.map((item) => applyPdfFonts(item, locale)) as T;
  }
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result = Object.fromEntries(
    Object.entries(source).map(([key, item]) => [
      key,
      applyPdfFonts(item, locale),
    ]),
  );
  if (typeof source.text === "string" && source.font === undefined) {
    const text = hasArabic(source.text)
      ? preserveArabicWordSpacing(source.text)
      : source.text;
    const mixed = hasArabic(text) && /[^\u0600-\u06FF\s\u00A0]/.test(text);
    if (mixed) result.text = splitMixedPdfText(text);
    else {
      result.text = text;
      result.font = getPdfFont(text);
    }
  }
  return result as T;
}

/**
 * Prepare Arabic text without bidi control characters because pdfmake can
 * render those invisible markers as missing-glyph rectangles.
 * Non-Arabic text passes through unchanged.
 */
export function preserveArabicWordSpacing(
  text: string,
  maxLineLength = Number.POSITIVE_INFINITY,
): string {
  if (!hasArabic(text)) return text;
  const lines: string[] = [];

  for (const sourceLine of text.split(/\r?\n/)) {
    if (!sourceLine.trim()) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of sourceLine.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && candidate.length > maxLineLength) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
  }

  return lines
    .map((value) => (value ? value.replace(/ /g, "\u00A0") : ""))
    .join("\n");
}

/**
 * Format a date for PDF display.
 * For Arabic locale returns YYYY-MM-DD to avoid pdfmake rendering issues
 * with localized Arabic numeral/glyph strings.
 */
export function formatPdfDate(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (locale !== "ar") {
    if (!value) return "";
    if (typeof value === "string") return value.split("T")[0];
    return value.toISOString().split("T")[0];
  }
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a date and time for PDF display.
 * Arabic PDFs use a digits-only format to avoid bidi reordering.
 */
export function formatPdfDateTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  if (locale !== "ar") {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const datePart = formatPdfDate(date, locale);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}`;

}
/**
 * Format currency for PDF display.
 * For Arabic locale returns "amount currency" (number-first) to work
 * correctly in RTL contexts.
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale?: string,
): string {
  if (locale === "ar") {
    const amount = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return `${amount} ${currency}`;
  }
  return new Intl.NumberFormat(locale ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function toastError(msg: string) {
  // Lazy import to avoid circular deps
  import("@/shared/toast/toastEvents").then(
    (m) => m.toast.error(msg),
    () => {},
  );
}

export interface PdfSection {
  title: string;
  headers: string[];
  rows: string[][];
}

export async function buildAndDownloadPdf(params: {
  title: string;
  headers?: string[];
  rows?: string[][];
  columnWidths?: number[];
  sections?: PdfSection[];
  locale: Locale;
  fileName: string;
}): Promise<void> {
  try {
    await buildAndDownloadPdfImpl(params);
  } catch (err) {
    console.error("[buildAndDownloadPdf] FAILED", err);
    toastError("Failed to generate PDF");
    throw err;
  }
}

async function buildAndDownloadPdfImpl(params: {
  title: string;
  headers?: string[];
  rows?: string[][];
  columnWidths?: number[];
  sections?: PdfSection[];
  locale: Locale;
  fileName: string;
}): Promise<void> {
  const { title, headers, rows, columnWidths, sections, locale, fileName } = params;
  const isRTL = locale === "ar";
  // Arabic record data can appear even in LTR docs, so always load the font.
  const pdfMake = await getPdfMake(true);
  const qrCodeDataUrl = await getQrCodeDataUrl();

  const al = isRTL ? "right" : "left";
  const wrapTitle = isRTL ? preserveArabicWordSpacing : (text: string) => text;

  const rtl = <T>(arr: T[]): T[] => (isRTL ? [...arr].reverse() : arr);

  const buildContent = () => {
    if (sections) {
      const content: unknown[] = [];
      sections.forEach((sec, i) => {
        const maxCellLen = Math.max(12, Math.floor(160 / Math.max(sec.headers.length, 1)));
        const wrapCell = isRTL
          ? (text: string) => preserveArabicWordSpacing(text, maxCellLen)
          : (text: string) => text;

        const tableBody = [
          rtl(sec.headers).map((h) => ({
            text: wrapCell(h),
            style: "tableHeader",
            alignment: al,
          })),
          ...sec.rows.map((row) =>
            rtl(row).map((c) => ({
              text: wrapCell(c),
              style: "tableCell",
              alignment: al,
            })),
          ),
        ];

        if (i > 0) {
          content.push({ text: "", margin: [0, 0, 0, 8] });
        }

        content.push({
          text: wrapTitle(sec.title),
          style: "subheader",
          alignment: "center",
          margin: [0, 0, 0, 8],
        });

        content.push({
          table: {
            headerRows: 1,
            widths: new Array(sec.headers.length).fill("*"),
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return C.green;
              return rowIndex % 2 === 0 ? C.warmBg : C.white;
            },
            hLineWidth: (rowIndex: number, node: { table?: { body?: unknown[] } }) => {
              if (rowIndex === 0) return 0;
              if (rowIndex === (node.table?.body?.length ?? 1) - 1) return 0.5;
              return 0.5;
            },
            hLineColor: () => C.border,
            vLineWidth: () => 0,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 0, 0, 0],
        });
      });
      return content;
    }

    const columnCount = headers!.length;
    const maxCellLineLength = Math.max(
      12,
      Math.floor(160 / Math.max(columnCount, 1)),
    );
    const wrapCell = isRTL
      ? (text: string) => preserveArabicWordSpacing(text, maxCellLineLength)
      : (text: string) => text;

    const singleTableBody = [
      rtl(headers!).map((h) => ({
        text: wrapCell(h),
        style: "tableHeader",
        alignment: al,
      })),
      ...rows!.map((row) =>
        rtl(row).map((c) => ({
          text: wrapCell(c),
          style: "tableCell",
          alignment: al,
        })),
      ),
    ];

    return [
      {
        text: wrapTitle(title),
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: columnWidths ? rtl(columnWidths) : new Array(columnCount).fill("*"),
          body: singleTableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return C.green;
            return rowIndex % 2 === 0 ? C.warmBg : C.white;
          },
          hLineWidth: (rowIndex: number, node: { table?: { body?: unknown[] } }) => {
            if (rowIndex === 0) return 0;
            if (rowIndex === (node.table?.body?.length ?? 1) - 1) return 0.5;
            return 0.5;
          },
          hLineColor: () => C.border,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 0],
      },
    ];
  };

  const docDef: Record<string, unknown> = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [48, 32, 48, 32],
    info: { title },
    content: (() => {
      const content = buildContent();
      if (qrCodeDataUrl) {
        // QR pinned to the top-right corner (top-left in RTL), above the title.
        content.unshift({
          image: qrCodeDataUrl,
          width: 64,
          alignment: isRTL ? "left" : "right",
          margin: [0, 0, 0, 8],
        });
      }
      return content;
    })(),
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        color: C.green,
      },
      subheader: {
        fontSize: 12,
        bold: true,
        color: C.green,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: C.white,
      },
      tableCell: {
        fontSize: 9,
        color: C.text,
      },
    },
    defaultStyle: {
      font: "Arial",
      fontSize: 9,
      color: C.text,
      alignment: al,
    },
  };

  const finalDef = isRTL ? buildArabicDocDef(docDef) : applyPdfFonts(docDef, locale);
  const pdfInstance = pdfMake.createPdf(finalDef);

  if (isRTL) {
    const buffer = await pdfInstance.getBuffer();
    const rtlBuffer = injectRTLOptions(buffer);
    downloadBuffer(rtlBuffer, fileName);
  } else {
    pdfInstance.download(fileName);
  }
}
