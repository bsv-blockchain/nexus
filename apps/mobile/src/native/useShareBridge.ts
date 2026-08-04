import { useMemo, useRef } from 'react'
import { Share } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import { isAvailableAsync, shareAsync } from 'expo-sharing'

/**
 * The OS share sheet, as the DOM chrome sees it.
 *
 * The chrome can produce the bytes of an export but has nowhere to put them: a
 * WebView drops a download, and `navigator.share` is not wired to anything in a
 * hosted document. So the chrome hands the shell a name and a string, and the
 * shell does what BSV Browser's exportTransactions.ts did with the same bytes —
 * writes a real file and gives it to the OS.
 *
 * Unlike scan.qr this does NOT go through NativeModalHost. The sheet is an OS
 * view controller presented over the whole window, not a React view in our tree,
 * so there is nothing for the tab layer to stand down from and nothing for the
 * modal host to arbitrate.
 */

/** One directory, emptied around every share — see shareFile for why it is reused. */
const TEMP_DIR = 'nexus-share'

/**
 * iOS chooses which apps appear in the sheet from the UTI. Passing one for the
 * types this app actually exports is the difference between a CSV that offers
 * Numbers, Mail and Files and one that only offers "Copy".
 */
const UTI_BY_MIME: Record<string, string> = {
  'text/csv': 'public.comma-separated-values-text',
  'text/plain': 'public.plain-text',
  'application/json': 'public.json',
  'application/octet-stream': 'public.data'
}

/**
 * The chrome is a hosted document, so its filename is untrusted input:
 * `new File(dir, '../../wallet.db')` resolves outside the temp directory and
 * would hand the sheet a file we never wrote — and then delete its parent.
 */
function safeName(filename: unknown): string {
  const base = String(filename ?? '').split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/^\.+/, '').trim()
  return cleaned || `nexus-export-${Math.floor(Date.now() / 1000)}.txt`
}

export function useShareBridge(): Record<string, (params: any) => any> {
  /**
   * One share at a time. Both platforms present a single sheet, and the temp
   * directory is reused: a second call would delete the first call's file while
   * the sheet still holds a URI to it, producing an empty attachment rather than
   * an error anyone can see. Refusing is the visible failure.
   */
  const sharing = useRef(false)

  return useMemo<Record<string, (params: any) => any>>(
    () => ({
      /**
       * Share a string — a payment link, an address, a URL. React Native's Share
       * rather than expo-sharing, because this has no file: the same call BSV
       * Browser makes from HandleReceive and the address bar.
       */
      'share.text': async ({ text, title }: { text?: string; title?: string }) => {
        const message = String(text ?? '')
        if (!message) throw new Error('there is nothing to share')
        try {
          const result = await Share.share(title ? { message, title: String(title) } : { message })
          return { shared: result.action === Share.sharedAction }
        } catch {
          // Some platforms reject instead of resolving when the sheet is
          // dismissed. Backing out is a decision the user made, so it reports as
          // "not shared" rather than as a failure the chrome would show in red.
          return { shared: false }
        }
      },

      /**
       * Write `contents` to a real file and give it to the OS.
       *
       * `shared` is weaker here than for text: expo-sharing resolves identically
       * whether the user picked a destination or dismissed the sheet, so a `true`
       * means the sheet ran and closed without error. Do not build anything on
       * this that a wrong answer would break — it is for a toast, not for
       * deciding whether the export happened.
       */
      'share.file': async ({
        filename,
        contents,
        mimeType
      }: {
        filename?: string
        contents?: string
        mimeType?: string
      }) => {
        // Refuse rather than write a file nobody will ever see: with no native
        // sharing the sheet never appears, and `shared: false` would read as a
        // user dismissing a sheet they were never shown.
        if (!(await isAvailableAsync())) throw new Error('this device cannot open a share sheet')
        if (sharing.current) throw new Error('a share sheet is already open')

        const name = safeName(filename)
        const mime = String(mimeType || 'text/plain')

        sharing.current = true
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
          sharing.current = false
          // Unconditional, including on the throw path: what passes through here
          // is a wallet's whole transaction history, and leaving it in readable
          // cache storage outlives the reason the user asked for it. Re-derived
          // rather than closed over, because the directory may not have been
          // constructed if this is unwinding from an early failure.
          try {
            const stale = new Directory(Paths.cache, TEMP_DIR)
            if (stale.exists) stale.delete()
          } catch {}
        }
      }
    }),
    []
  )
}
