"use client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapePrintText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return escapeHtml(String(value));
}

/** מסתיר ככל האפשר כותרות/תחתיות של הדפדפן (כולל כתובת URL) בהדפסה */
const PRINT_CHROME_GUARD_CSS = `
@page { margin: 8mm 8mm 0 8mm; }
@media print {
  body {
    padding-bottom: 12mm;
  }
  body::after {
    content: "";
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 14mm;
    background: #fff;
    z-index: 2147483647;
    pointer-events: none;
  }
}
`;

const BASE_PRINT_STYLES = `
@page { size: A4; margin: 10mm; }
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
table { width: 100%; border-collapse: collapse; font-size: 11pt; }
th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
th { background: #f1f5f9; }
.page-title { font-size: 16pt; font-weight: 700; margin-bottom: 4mm; }
.summary { margin-bottom: 3mm; font-size: 10pt; color: #4b5563; }
`;

/** טוען קובץ סטטי (לוגו וכו') כ-data URL — בלי קישור לכתובת האתר במסמך ההדפסה */
export async function fetchAssetAsDataUrl(path: string): Promise<string> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`לא ניתן לטעון ${path}`);
  const blob = await r.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`לא ניתן לקרוא ${path}`));
    reader.readAsDataURL(blob);
  });
}

function buildPrintHtml({
  title,
  bodyHtml,
  css,
  hideBrowserChrome,
}: {
  title: string;
  bodyHtml: string;
  css: string;
  hideBrowserChrome: boolean;
}) {
  const docTitle = hideBrowserChrome ? " " : title;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(docTitle)}</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function waitForImages(win: Window): Promise<void> {
  const imgs = win.document.querySelectorAll("img");
  if (!imgs.length) return Promise.resolve();
  return new Promise((resolve) => {
    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) resolve();
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  });
}

function triggerPrint(win: Window, cleanup: () => void) {
  void waitForImages(win).then(() => {
    try {
      win.focus();
      win.print();
    } catch {
      alert("הדפסה נכשלה. נסי שוב.");
    } finally {
      cleanup();
    }
  });
}

function printViaHiddenIframe(html: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "none",
    visibility: "hidden",
  });

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  iframe.srcdoc = html;
  iframe.addEventListener(
    "load",
    () => {
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        alert("לא ניתן לפתוח חלון הדפסה. נסי שוב.");
        return;
      }
      window.setTimeout(() => triggerPrint(win, cleanup), 100);
    },
    { once: true },
  );

  document.body.appendChild(iframe);
}

function printViaBlankWindow(html: string, title: string): boolean {
  const printWin = window.open("about:blank", "_blank", "noopener,noreferrer,width=0,height=0");
  if (!printWin) return false;

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        printWin.close();
      } catch {
        /* ignore */
      }
    }, 1000);
  };

  try {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.document.title = " ";
    if (printWin.document.readyState === "complete") {
      window.setTimeout(() => triggerPrint(printWin, cleanup), 100);
    } else {
      printWin.addEventListener("load", () => window.setTimeout(() => triggerPrint(printWin, cleanup), 100), {
        once: true,
      });
    }
    return true;
  } catch {
    cleanup();
    return false;
  }
}

/**
 * פותח מסמך הדפסה מבודד (iframe srcdoc / חלון about:blank) —
 * לא מדפיס את עמוד האתר ולא אמור להציג את כתובת האתר בתחתית.
 */
export function openPrintDocument({
  title,
  bodyHtml,
  styles,
  hideBrowserChrome = true,
}: {
  title: string;
  bodyHtml: string;
  /** CSS מלא — אם לא מועבר, משתמשים ב-BASE_PRINT_STYLES */
  styles?: string;
  /** מנסה להסתיר כותרות/תחתיות של הדפדפן (כולל URL) */
  hideBrowserChrome?: boolean;
}) {
  const chromeGuard = hideBrowserChrome ? PRINT_CHROME_GUARD_CSS : "";
  const css = `${styles ?? BASE_PRINT_STYLES}${chromeGuard}`;
  const html = buildPrintHtml({ title, bodyHtml, css, hideBrowserChrome });

  if (!printViaBlankWindow(html, title)) {
    printViaHiddenIframe(html, title);
  }
}
