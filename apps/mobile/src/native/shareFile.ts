import { Directory, File, Paths } from 'expo-file-system'
import { isAvailableAsync, shareAsync } from 'expo-sharing'

/**
 * Write a string to a real file and hand it to the OS share sheet.
 *
 * Extracted from `useShareBridge` because there are now two callers with very
 * different stakes: the chrome's `share.file` (a CSV of transactions) and the wallet
 * bridge's `backup.shares` (a document containing every backup share — i.e. the
 * wallet). Duplicating this would have meant duplicating the path-traversal guard and
 * the `finally` that deletes the directory, and the second copy is the one that would
 * have drifted.
 *
 * A WebView drops a download and `navigator.share` is not wired to anything in a
 * hosted document, so this is how bytes produced in-app reach the outside world at all.
 */

/** One directory, emptied around every share — see below for why it is reused. */
const TEMP_DIR = 'nexus-share'

/**
 * iOS chooses which apps appear in the sheet from the UTI. Passing one for the
 * types this app actually exports is the difference between a CSV that offers
 * Numbers, Mail and Files and one that only offers "Copy".
 */
const UTI_BY_MIME: Record<string, string> = {
  'text/csv': 'public.comma-separated-values-text',
  'text/plain': 'public.plain-text',
  'text/html': 'public.html',
  'application/json': 'public.json',
  'application/octet-stream': 'public.data'
}

/**
 * The chrome is a hosted document, so its filename is untrusted input:
 * `new File(dir, '../../wallet.db')` resolves outside the temp directory and
 * would hand the sheet a file we never wrote — and then delete its parent.
 */
export function safeName(filename: unknown): string {
  const base = String(filename ?? '').split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/^\.+/, '').trim()
  return cleaned || `nexus-export-${Math.floor(Date.now() / 1000)}.txt`
}

/**
 * One share at a time. Both platforms present a single sheet, and the temp
 * directory is reused: a second call would delete the first call's file while
 * the sheet still holds a URI to it, producing an empty attachment rather than
 * an error anyone can see. Refusing is the visible failure.
 *
 * Module scope rather than a ref, because the two callers are different hooks and the
 * constraint is the OS's, not any one component's.
 */
let sharing = false

export interface ShareFileArgs {
  filename?: unknown
  contents?: string
  mimeType?: string
}

/**
 * @returns `{ shared }` — weaker than it looks: `expo-sharing` resolves identically
 *   whether the user picked a destination or dismissed the sheet, so `true` means the
 *   sheet ran and closed without error. It is for a toast, not for deciding whether
 *   the export happened.
 */
export async function shareFile({ filename, contents, mimeType }: ShareFileArgs): Promise<{ shared: boolean }> {
  // Refuse rather than write a file nobody will ever see: with no native
  // sharing the sheet never appears, and `shared: false` would read as a
  // user dismissing a sheet they were never shown.
  if (!(await isAvailableAsync())) throw new Error('this device cannot open a share sheet')
  if (sharing) throw new Error('a share sheet is already open')

  const name = safeName(filename)
  const mime = String(mimeType || 'text/plain')

  sharing = true
  try {
    // Cache, not documents: this file exists only for the seconds the sheet
    // is up, and the OS is free to reclaim anything we fail to delete.
    //
    // Inside the try, not before it: the OS can reclaim or lock this
    // directory between calls, and a throw from delete()/create() outside
    // the try would latch `sharing` true for the life of the process —
    // every later export would then be refused with "a share sheet is
    // already open" when no sheet was ever shown.
    const dir = new Directory(Paths.cache, TEMP_DIR)
    if (dir.exists) dir.delete()
    dir.create({ intermediates: true })
    const file = new File(dir, name)
    file.write(String(contents ?? ''))
    await shareAsync(file.uri, { mimeType: mime, dialogTitle: name, UTI: UTI_BY_MIME[mime] })
    return { shared: true }
  } finally {
    sharing = false
    // Unconditional, including on the throw path: what passes through here
    // is a wallet's whole transaction history — or, for backup.shares, the wallet
    // itself — and leaving it in readable cache storage outlives the reason the user
    // asked for it. Re-derived rather than closed over, because the directory may not
    // have been constructed if this is unwinding from an early failure.
    try {
      const stale = new Directory(Paths.cache, TEMP_DIR)
      if (stale.exists) stale.delete()
    } catch {}
  }
}
