/**
 * The slice of `qrcode` this package uses, typed by hand.
 *
 * `qrcode` ships no types and `@types/qrcode` is not installed — deliberately: CI runs
 * `npm ci`, so adding a dependency here means a lockfile change, and the package itself
 * is already resolvable at the workspace root (`react-native-qrcode-svg` depends on it,
 * and `apps/ui` declares it). A declaration is the part that was missing, not the code.
 *
 * Narrow on purpose. `declare module 'qrcode'` on its own would make the whole module
 * `any`, and the one call we make — the SVG-string renderer — is exactly the one whose
 * signature differs between the node build and the browser build. Writing it out is
 * what documents the intersection both builds honour: `(text, options)` returning a
 * Promise of an SVG string. See `generateQRCodeSVG` in ../utils/backupShares.ts.
 */
declare module 'qrcode' {
  export interface QRCodeToStringOptions {
    /** The node build renders several; the browser build only ever renders SVG. */
    type?: 'svg' | 'utf8' | 'terminal'
    width?: number
    margin?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  }

  export function toString(text: string, options?: QRCodeToStringOptions): Promise<string>

  const QRCode: { toString: typeof toString }
  export default QRCode
}
