import { useMemo } from 'react'
import { Share } from 'react-native'
import { shareFile } from './shareFile'

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
 *
 * The file half lives in ./shareFile.ts, because the wallet bridge's `backup.shares`
 * needs the same write-share-delete path for a document it must NOT hand to the
 * chrome. See that file for the temp-directory and filename reasoning.
 */

export function useShareBridge(): Record<string, (params: any) => any> {
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

      /** Write `contents` to a real file and give it to the OS. See ./shareFile.ts. */
      'share.file': async (params: { filename?: string; contents?: string; mimeType?: string }) =>
        shareFile(params ?? {})
    }),
    []
  )
}
