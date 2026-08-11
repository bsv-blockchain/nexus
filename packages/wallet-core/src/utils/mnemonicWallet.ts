/**
 * Mnemonic-based wallet derivation, rooted in entropy (BRC-157).
 *
 * The phrase is no longer the thing a wallet is; it is one of two ENCODINGS of the
 * thing a wallet is. `utils/entropy.ts` owns that thing, and this file is the
 * phrase-shaped door onto it — kept, with its exported names intact, because both
 * shells and their build paths import them.
 *
 * ── WHAT `primaryKey` IS, AND WHY IT IS NOT RENAMED ──
 *
 * `primaryKey` is `m/0'/0'` off the BIP-32 master built from the phrase's seed, which
 * is byte-for-byte BRC-157's ROOT KEY. The two specs use opposite words for it: what
 * BRC-157 calls the root key, Nexus calls the primary key, and what Nexus calls
 * `rootKey` below is the BIP-32 MASTER (`HD.fromSeed(seed).privKey`) that feeds
 * `PrivilegedKeyManager`.
 *
 * Nothing is renamed, because nothing about the bytes changed: every wallet ever
 * created here was already BRC-157-conformant at the operational-key level, and
 * `test/entropy.test.mjs` asserts that equality on every run. Renaming a field forty
 * call sites deep to match a spec's prose would be a large diff that moves no keys.
 *
 * ── WHAT DID CHANGE ──
 *
 * A newly generated wallet now starts from 32 bytes of entropy — a uniform secp256k1
 * scalar, per BRC-157 — and therefore has TWENTY-FOUR words, not twelve. That is not
 * a preference: entropy shorter than 32 bytes is left-padded with zeros before it can
 * be split into BRC-140 backup shares, and every padding byte is a byte the recovery
 * side then has to guess the count of. Generating the full length removes the guess.
 */

import { Mnemonic, HD, PrivateKey } from '@bsv/sdk'
import {
  entropyToMnemonic,
  generateEntropy,
  isWordCount,
  mnemonicToEntropy,
  normalizePhrase,
  wordCountForEntropy,
  type WordCount
} from './entropy'

export interface MnemonicWalletConfig {
  mnemonic?: string // Optional: provide existing mnemonic
  passphrase?: string // Optional BIP39 passphrase
  language?: 'en' | 'es' | 'fr' | 'it' | 'ja' | 'ko' | 'zh_CN' | 'zh_TW' // Default: 'en'
}

export interface MnemonicWalletResult {
  mnemonic: string
  /**
   * The BIP-39 entropy this phrase encodes, at its natural length (16–32 bytes).
   *
   * BRC-157's recoverable object, and what `backupShares.ts` splits. Present on the
   * result so a caller that already paid for the derivation does not have to decode
   * the phrase a second time to make backup shares from it.
   */
  entropy: number[]
  /** 12, 15, 18, 21 or 24. The one fact backup shares cannot carry — print it. */
  wordCount: WordCount
  /** The BIP-32 MASTER key. Feeds PrivilegedKeyManager; never the entropy. */
  rootKey: PrivateKey
  /** `m/0'/0'` — BRC-157's root key. This is the wallet's operational key. */
  primaryKey: number[]
  identityKey: string // Public key hex
}

/**
 * Generate a new mnemonic-based wallet, or re-derive one from a phrase.
 *
 * With no phrase: 32 bytes of BRC-157 entropy → 24 words. With one: the phrase is
 * normalised and decoded, which validates it (wordlist, length, checksum) before any
 * key is derived — a phrase that cannot be decoded must fail here rather than build a
 * wallet nobody can recover.
 */
export function generateMnemonicWallet(config: MnemonicWalletConfig = {}): MnemonicWalletResult {
  const { passphrase = '' } = config

  // Entropy first in both directions, so the phrase and the entropy on the result can
  // never disagree with each other.
  const entropy = config.mnemonic ? mnemonicToEntropy(config.mnemonic) : generateEntropy()
  const mnemonicString = config.mnemonic ? normalizePhrase(config.mnemonic) : entropyToMnemonic(entropy)
  const wordCount = wordCountForEntropy(entropy.length)

  const mnemonicInstance = Mnemonic.fromString(mnemonicString)

  // Derive seed from mnemonic. BRC-157's default is the empty passphrase and no
  // Nexus surface offers another; a non-empty one here changes what every artifact
  // below recovers, which is why it is a parameter and not a setting.
  const seed = mnemonicInstance.toSeed(passphrase)

  // Create HD key from seed
  const hdKey = HD.fromSeed(seed)

  // The BIP-32 master. Nexus's `rootKey`, NOT BRC-157's.
  const rootKey = hdKey.privKey

  // `m/0'/0'` — BRC-157's root key, hardened at both levels so a leaked child cannot
  // walk back up to it.
  const derivedHdKey = hdKey.derive("m/0'/0'")
  /*
   * 32 bytes, big-endian, zero-padded — not the bare `toArray()` this used to be.
   *
   * `BigNumber.toArray()` is MINIMAL-LENGTH: about one key in 256 begins with a zero
   * byte and came out as 31 bytes (one in 65 536 as 30, and so on). Nothing broke,
   * because every consumer re-reads it through `new PrivateKey(bytes)` and that parses
   * big-endian — the integer, and therefore the identity key and every derivation, was
   * always the same. But it meant the length of the wallet's own primary key was a
   * coin flip, which is the sort of thing that breaks the day someone hashes it,
   * length-prefixes it, or compares two of them. A test caught it as a 1-in-256 flake.
   *
   * Safe to change for existing wallets precisely because of that big-endian parse:
   * the padded form is the same scalar, so no identity, database or funds move.
   */
  const primaryKey = derivedHdKey.privKey.toArray('be', 32)

  // Get identity key (public key) for the derived key
  const identityKey = derivedHdKey.privKey.toPublicKey().toString()

  return {
    mnemonic: mnemonicString,
    entropy,
    wordCount,
    rootKey,
    primaryKey,
    identityKey
  }
}

/**
 * Recover wallet from existing mnemonic
 */
export function recoverMnemonicWallet(
  mnemonic: string,
  passphrase: string = ''
): MnemonicWalletResult {
  return generateMnemonicWallet({ mnemonic, passphrase })
}

/**
 * Recover a wallet from BRC-157 entropy — the share-recovery side of the door.
 *
 * Deliberately re-encodes to a phrase and goes through the same derivation rather
 * than deriving from the entropy directly: a wallet recovered from backup shares must
 * be indistinguishable from a phrase-recovered one, including having a phrase it can
 * show the user. Anything else reintroduces the keyless wallet BRC-157 exists to
 * abolish.
 */
export function recoverWalletFromEntropy(entropy: number[]): MnemonicWalletResult {
  return recoverMnemonicWallet(entropyToMnemonic(entropy))
}

/**
 * Validate a mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return parseMnemonic(mnemonic).valid
}

/**
 * Get word count for a mnemonic
 */
export function getMnemonicWordCount(mnemonic: string): number {
  return normalizePhrase(mnemonic).split(' ').filter(Boolean).length
}

/**
 * Convert mnemonic to displayable format with numbered words
 */
export function formatMnemonicForDisplay(mnemonic: string): string[] {
  return normalizePhrase(mnemonic).split(' ').filter(Boolean)
}

export interface MnemonicValidationResult {
  valid: boolean
  wordCount?: number
  error?: string
}

/**
 * The one phrase validator every surface uses.
 *
 * Both shells used to inline `words.length !== 12 && words.length !== 24`, which
 * rejected the 15-, 18- and 21-word phrases BIP-39 defines and BRC-157 requires —
 * a user holding a 15-word phrase from another wallet could not get in at all. One
 * function, so the next surface cannot narrow it again by accident.
 */
export function parseMnemonic(mnemonic: string): MnemonicValidationResult {
  const words = getMnemonicWordCount(mnemonic)

  if (!isWordCount(words)) {
    return {
      valid: false,
      wordCount: words,
      error: `a recovery phrase is 12, 15, 18, 21 or 24 words; got ${words}`
    }
  }

  try {
    // Decoded rather than merely parsed: this is the same call the build path makes,
    // so a phrase that passes here cannot fail there.
    mnemonicToEntropy(mnemonic)
    return { valid: true, wordCount: words }
  } catch (error: any) {
    return {
      valid: false,
      wordCount: words,
      error: error?.message || 'Invalid mnemonic phrase'
    }
  }
}
