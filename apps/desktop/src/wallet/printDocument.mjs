import { BrowserWindow } from 'electron'

/**
 * Put an HTML document in front of the OS print dialogue, and leave nothing behind.
 *
 * ## Why a data: URL and not a file
 *
 * The only caller is `backup.shares`, and the document it renders contains EVERY
 * backup share. Any `threshold` of them together are the wallet. Writing that to a
 * temp file — even one we delete in a `finally` — puts a copy of the wallet in a
 * predictable path, where a crash between the write and the delete orphans it, and
 * where anything indexing the user directory may read it first. A `data:` URL never
 * leaves memory.
 *
 * The size is fine: three pages with three QR codes as inline SVG is tens of
 * kilobytes, far under Chromium's data-URL limit.
 *
 * ## Why an offscreen window
 *
 * `webContents.print()` needs a WebContents that has painted the document. The window
 * is never shown — the user sees only the OS print sheet — and it is destroyed in a
 * `finally` whether they print, cancel, or the print backend fails. A leaked window
 * here is a leaked copy of the shares.
 *
 * ## What the resolved value means
 *
 * `{ printed: false }` is the ordinary outcome of someone pressing Cancel, and it is
 * not an error. `printed: true` means the print job was handed to the OS, which is as
 * far as this process can see — it is for a toast, not for deciding whether paper
 * exists.
 */
export async function printHtmlDocument(html, { parent, title = 'Backup shares' } = {}) {
  const win = new BrowserWindow({
    show: false,
    // Parented so the print sheet appears attached to the app on macOS rather than
    // as a detached window with no obvious owner.
    ...(parent ? { parent } : {}),
    title,
    webPreferences: {
      // Nothing in this document is ours to trust with privilege, and it needs none:
      // it is static HTML with inline SVG and no script at all.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false
    }
  })

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    return await new Promise((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        // Electron reports cancellation through this same callback with
        // success=false and 'cancelled'. Treat it as an answer, not a fault — a user
        // backing out of a print dialogue has not broken anything.
        if (success) return resolve({ printed: true })
        if (!failureReason || /cancel/i.test(failureReason)) return resolve({ printed: false })
        reject(new Error(`the print job failed: ${failureReason}`))
      })
    })
  } finally {
    // Unconditional, including on the throw path: see the header. `isDestroyed` first
    // because a window closed from under us would throw here and mask the real error.
    if (!win.isDestroyed()) win.destroy()
  }
}
