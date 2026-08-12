/**
 * Backup shares — BRC-140 shares of the ENTROPY (BRC-157).
 *
 * ## What changed, and why it matters
 *
 * This file used to split the wallet's primary key (`m/0'/0'`). That made the two
 * backup artifacts recover two different wallets: the phrase recovered entropy → seed
 * → `m/0'/0'`, while the shares recovered `m/0'/0'` and nothing above it. A wallet
 * restored from those shares had no phrase, could never produce one, and could not
 * produce a second set of shares that a phrase-restored wallet would agree with.
 *
 * BRC-157 splits the entropy instead. The same 32 bytes are a BIP-39 sentence and a
 * secp256k1 scalar, so either artifact recovers the same entropy and therefore the
 * same wallet — and a share recovery hands the user their words back.
 *
 * ## Legacy shares
 *
 * Pages printed by BSV Browser / metanet-mobile split `m/0'/0'`, and BRC-140's format
 * carries no version marker — its integrity tag is a hash of whatever scalar was
 * split, so a legacy share and a BRC-157 share are indistinguishable by inspection.
 * Guessing between them would either produce a wallet with the wrong identity key or
 * silently drop back into the keyless state BRC-157 exists to abolish. So the user is
 * asked, once, and `recoverKeyFromShares` below is the legacy reader.
 *
 * This is also why the printed page now carries `BRC-157` and the word count: a sheet
 * of paper found in five years has to be self-describing.
 */

/// <reference path="../types/qrcode.d.ts" />
import { PrivateKey } from '@bsv/sdk'
import QRCode from 'qrcode'
import {
  ENTROPY_BYTES,
  entropyToMnemonic,
  padEntropy,
  trimEntropy,
  validateEntropy,
  wordCountForEntropy,
  type WordCount
} from './entropy'

/** BRC-140's default split, and what the print layout is sized for. */
export const DEFAULT_THRESHOLD = 2
export const DEFAULT_TOTAL_SHARES = 3

// ── Share generation ─────────────────────────────────────────────────────────

/**
 * Split BRC-157 entropy into BRC-140 backup shares.
 *
 * The entropy is left-padded to 32 bytes first, because that is the form BRC-157
 * defines and the form a share set must therefore reconstruct. Shorter entropy — a
 * 12-word phrase imported from another wallet — loses its length in the padding, which
 * is what `recoverEntropyFromShares` and the printed word count exist to restore.
 *
 * @throws with a user-facing reason when the entropy is not a valid scalar. The
 *   reachable case is a phrase whose entropy is all zeros (`abandon … about`): a
 *   perfectly good wallet that cannot be split. See `validateEntropy`.
 */
export function generateEntropyShares(
  entropy: number[],
  threshold: number = DEFAULT_THRESHOLD,
  totalShares: number = DEFAULT_TOTAL_SHARES
): string[] {
  const check = validateEntropy(entropy)
  if (!check.valid) throw new Error(check.reason)
  if (!Number.isInteger(threshold) || threshold < 2) {
    throw new Error('a backup needs a threshold of at least 2 shares')
  }
  if (!Number.isInteger(totalShares) || totalShares < threshold) {
    throw new Error(`${totalShares} shares cannot satisfy a threshold of ${threshold}`)
  }

  const key = new PrivateKey(padEntropy(entropy))
  return key.toBackupShares(threshold, totalShares)
}

// ── Share validation ─────────────────────────────────────────────────────────

export interface ParsedShare {
  raw: string
  x: string
  y: string
  threshold: number
  integrity: string
}

/**
 * Parse and validate a single backup share string.
 * @returns Parsed share or null if invalid format
 */
export function parseShare(shareString: string): ParsedShare | null {
  const parts = shareString.trim().split('.')
  if (parts.length !== 4) return null

  const [x, y, thresholdStr, integrity] = parts
  const threshold = Number(thresholdStr)

  if (!x || !y || isNaN(threshold) || threshold < 2 || !integrity) return null

  return { raw: shareString.trim(), x, y, threshold, integrity }
}

/**
 * Validate that a new share is compatible with previously collected shares.
 * @returns Error message string or null if valid
 */
export function validateShareCompatibility(newShare: ParsedShare, existingShares: ParsedShare[]): string | null {
  if (existingShares.length === 0) return null

  const first = existingShares[0]

  if (newShare.threshold !== first.threshold) {
    return 'Threshold does not match previous shares'
  }

  if (newShare.integrity !== first.integrity) {
    return 'Integrity hash does not match — shares are from different keys'
  }

  // Check for duplicate (same x.y point)
  const isDuplicate = existingShares.some(s => s.x === newShare.x && s.y === newShare.y)
  if (isDuplicate) {
    return 'This share has already been scanned'
  }

  return null
}

/**
 * Parse a whole collection at once, rejecting the set rather than a share.
 *
 * Used by both shells' `wallet.restoreShares`: a caller that hands over four strings
 * wants one answer about the set, not four answers it has to reconcile.
 */
export function parseShareSet(shareStrings: string[]): { shares: ParsedShare[]; error?: string } {
  const shares: ParsedShare[] = []
  for (const [index, raw] of shareStrings.entries()) {
    const parsed = parseShare(raw)
    if (!parsed) return { shares, error: `share ${index + 1} is not in the expected format` }
    const incompatible = validateShareCompatibility(parsed, shares)
    if (incompatible) return { shares, error: `share ${index + 1}: ${incompatible}` }
    shares.push(parsed)
  }
  if (shares.length === 0) return { shares, error: 'no shares were provided' }
  if (shares.length < shares[0].threshold) {
    return { shares, error: `this backup needs ${shares[0].threshold} shares; got ${shares.length}` }
  }
  return { shares }
}

// ── Recovery ─────────────────────────────────────────────────────────────────

export interface RecoveredEntropy {
  /** The entropy at its original length — what re-encodes to the user's own phrase. */
  entropy: number[]
  /** The same value in BRC-157's canonical 32-byte form, before the trim. */
  entropy32: number[]
  wordCount: WordCount
}

/**
 * Recover BRC-157 entropy from a set of shares.
 *
 * `toArray('be', 32)` and not `toArray()`: the reconstruction is a big integer, and a
 * 12-word phrase's entropy padded to 32 bytes has sixteen leading zero bytes that the
 * minimal-length serialisation would silently drop. Losing them means trimming the
 * wrong number of bytes and re-encoding a phrase that derives a different wallet.
 *
 * `wordCount` comes off the printed page. Without it the trim falls back to BRC-157's
 * leading-zero heuristic, which is right for every phrase whose entropy does not begin
 * with four or more zero bytes of its own.
 *
 * @throws if the shares do not reconstruct, or reconstruct to something that is not a
 *   valid scalar — both of which mean the wrong shares, not a wrong wallet.
 */
export function recoverEntropyFromShares(shareStrings: string[], wordCount?: WordCount): RecoveredEntropy {
  const { error } = parseShareSet(shareStrings)
  if (error) throw new Error(error)

  const recovered = PrivateKey.fromBackupShares(shareStrings.map((s) => s.trim()))
  const entropy32 = recovered.toArray('be', ENTROPY_BYTES)

  const check = validateEntropy(entropy32)
  if (!check.valid) throw new Error(check.reason)

  const entropy = trimEntropy(entropy32, wordCount)
  return { entropy, entropy32, wordCount: wordCountForEntropy(entropy.length) }
}

/**
 * Recover the phrase these shares back up.
 *
 * The whole point of BRC-157: a share recovery ends with the user holding their own
 * words again, not with a wallet that can never be backed up a second way.
 */
export function recoverMnemonicFromShares(shareStrings: string[], wordCount?: WordCount): string {
  return entropyToMnemonic(recoverEntropyFromShares(shareStrings, wordCount).entropy)
}

/**
 * LEGACY reader — for pages printed before BRC-157, which split `m/0'/0'` directly.
 *
 * The returned key IS the primary key; there is no entropy and there will never be a
 * phrase for such a wallet. Reachable only from an import the user explicitly labelled
 * as legacy, because nothing in the share format distinguishes it from a BRC-157 set.
 */
export function recoverKeyFromShares(shareStrings: string[]): PrivateKey {
  const { error } = parseShareSet(shareStrings)
  if (error) throw new Error(error)
  return PrivateKey.fromBackupShares(shareStrings.map((s) => s.trim()))
}

// ── Print HTML generation ────────────────────────────────────────────────────

/**
 * Generate a QR code as an inline SVG string.
 *
 * `qrcode`'s node build and its browser build both accept `(text, opts)` here and both
 * return SVG — the browser build ignores `type` because SVG is all it renders. That
 * matters: this same function runs in Electron's main process and under Hermes.
 */
async function generateQRCodeSVG(data: string, size: number = 180): Promise<string> {
  const svgString = await QRCode.toString(data, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M'
  })
  return svgString
}

/** Shares and identity keys are base58/hex, but a printed page is not the place to trust that. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PrintOptions {
  /**
   * The word count of the phrase these shares recover.
   *
   * The one fact BRC-140 shares cannot carry, and the reason a 12-word wallet
   * recovered from shares alone would otherwise come back as a different 24-word
   * wallet. BRC-157 says to record it; this is where it is recorded.
   */
  wordCount: WordCount
  /** How many of these pages it takes. Read off the shares when not given. */
  threshold?: number
  /** Fixed date stamp, for tests. Defaults to now. */
  now?: Date
}

/**
 * Generate printable HTML with one page per backup share.
 *
 * Layout follows the reference implementation (secure-key-backup-and-recovery) with
 * three additions, all so the page is self-describing years later: the `BRC-157`
 * marker, the word count, and instructions that name this app.
 *
 * Pages are separated by CSS page-break-after for the print dialogue.
 */
export async function generatePrintHTML(
  shares: string[],
  identityKey: string,
  options: PrintOptions
): Promise<string> {
  if (shares.length === 0) throw new Error('there are no shares to print')

  const { wordCount, now = new Date() } = options
  const threshold = options.threshold ?? parseShare(shares[0])?.threshold ?? DEFAULT_THRESHOLD

  const iso = now.toISOString()
  const dateStamp = `${iso.split('T')[0]} ${iso.split('T')[1].split('.')[0]}`

  // Pre-generate all QR codes
  const shareQRs = await Promise.all(shares.map(s => generateQRCodeSVG(s, 180)))
  const identityQR = await generateQRCodeSVG(identityKey, 150)

  const pages = shares.map(
    (share, i) => `
    <div class="page${i < shares.length - 1 ? '' : ' last'}">
      <div class="header">
        <span class="share-label">Share ${i + 1} of ${shares.length}</span>
        <span class="date-stamp">BRC-157 &middot; ${dateStamp}</span>
      </div>

      <div class="section">
        <div class="qr-container identity-qr">
          ${identityQR}
        </div>
        <div class="data-label">Identity Key</div>
        <div class="data-value">${escapeHtml(identityKey)}</div>
        <div class="identity-caption">Scan this QR code to send BSV payments to this wallet.</div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="qr-container">
          ${shareQRs[i]}
        </div>
        <div class="data-label">Backup Share</div>
        <div class="data-value share-text">${escapeHtml(share)}</div>
        <div class="scheme">Recovers a ${wordCount}-word recovery phrase (BRC-157 entropy)</div>
      </div>

      <div class="divider"></div>

      <div class="instructions">
        <strong>Recovery Instructions</strong>
        <p>This is 1 of ${shares.length} backup shares. You need any ${threshold} of them to recover this wallet.</p>
        <p>Store each share in a separate, secure location. Do not store shares together — any ${threshold} together are the wallet.</p>
        <p>To recover: in Nexus, choose Set up your wallet &rarr; Restore from backup shares, and enter any ${threshold} shares.</p>
      </div>
    </div>
  `
  )

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Nexus backup shares</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Courier New', Courier, monospace;
          font-weight: 700;
          color: #000;
          background: #fff;
        }

        .page {
          width: 100%;
          padding: 12mm 15mm;
          page-break-after: always;
        }
        .page.last {
          page-break-after: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6mm;
          padding-bottom: 3mm;
          border-bottom: 1px solid #ccc;
        }
        .share-label {
          font-size: 16pt;
          font-weight: 700;
        }
        .date-stamp {
          font-size: 9pt;
          color: #444;
        }

        .section {
          margin-bottom: 4mm;
        }
        .qr-container {
          margin-bottom: 3mm;
        }
        .qr-container svg {
          width: 50mm;
          height: 50mm;
        }
        .identity-qr svg {
          width: 40mm;
          height: 40mm;
        }

        .data-label {
          font-size: 11pt;
          font-weight: 700;
          color: #000;
          margin-bottom: 1.5mm;
        }
        .data-value {
          font-size: 7pt;
          font-weight: 700;
          word-break: break-all;
          line-height: 1.4;
          color: #000;
        }
        .share-text {
          font-size: 8.2pt;
          word-break: normal;
          white-space: nowrap;
        }
        .scheme {
          margin-top: 2mm;
          font-size: 9pt;
          font-weight: 700;
          color: #000;
        }

        .identity-caption {
          margin-top: 2mm;
          font-size: 9pt;
          font-weight: 700;
          color: #000;
        }

        .divider {
          border-top: 1px solid #e0e0e0;
          margin: 4mm 0;
        }

        .instructions {
          margin-top: 4mm;
          font-size: 10pt;
          font-weight: 700;
          line-height: 1.6;
          color: #000;
        }
        .instructions strong {
          display: block;
          font-size: 11pt;
          margin-bottom: 2mm;
        }
        .instructions p {
          margin-bottom: 1.5mm;
        }

        @media print {
          body { background: #fff; }
          .page { padding: 10mm 12mm; }
        }
      </style>
    </head>
    <body>
      ${pages.join('\n')}
    </body>
    </html>
  `
}
