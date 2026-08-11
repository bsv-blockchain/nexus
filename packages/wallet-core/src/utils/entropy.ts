/**
 * Entropy — the thing a wallet is actually backed up as (BRC-157).
 *
 * ## The problem this module exists to solve
 *
 * Before it, Nexus had two backup artifacts that recovered two different wallets.
 * `mnemonicWallet.ts` generated a BIP-39 phrase and derived the operational key at
 * `m/0'/0'`; `backupShares.ts` Shamir-split THAT KEY. So a wallet recovered from
 * shares had no phrase, could never produce one, and could not produce a second set
 * of shares that a phrase-recovered wallet would agree with.
 *
 * BRC-157 moves the root one level up. A single 32-byte entropy value is BOTH a
 * BIP-39 sentence AND a secp256k1 scalar that BRC-140 can split. Either artifact
 * recovers the same entropy; canonical derivation from that entropy produces the same
 * wallet. Entropy is the recoverable object — not a key, not a phrase.
 *
 * ## What this does NOT change
 *
 * BRC-157's root key is
 *
 *     HD.fromSeed(Mnemonic.fromEntropy(entropy).toSeed()).derive("m/0'/0'").privKey
 *
 * which is byte-for-byte what `mnemonicWallet.ts` has always called `primaryKey`.
 * Every wallet Nexus created from a phrase is therefore already BRC-157-conformant at
 * the operational-key level: same identity key, same database, same funds, no
 * migration. `test/entropy.test.mjs` asserts that equality rather than trusting this
 * comment.
 *
 * The vocabularies differ and are deliberately not reconciled: BRC-157 says ROOT KEY
 * where Nexus says PRIMARY KEY, and Nexus says ROOT KEY for the BIP-32 master
 * (`HD.fromSeed(seed).privKey`, what feeds `PrivilegedKeyManager`). Renaming a field
 * forty call sites deep to match a spec's prose would be a large diff that changes no
 * bytes.
 *
 * ## The entropy key never signs
 *
 * BRC-157 is explicit that the scalar interpretation of entropy exists only so
 * BRC-140 has something to split. Nothing here derives an operational key from it
 * directly — everything goes through the BIP-39 seed, which is a PBKDF2 of the WORDS,
 * so the hardened path below is separated from the entropy by a KDF as well as by
 * derivation.
 */

import { BigNumber, HD, Hash, Mnemonic, PrivateKey } from '@bsv/sdk'

/** BRC-157's canonical serialisation: 32 bytes, big-endian, zero-padded left. */
export const ENTROPY_BYTES = 32

/**
 * The secp256k1 group order. Entropy must land in `[1, n − 1]` to be a valid private
 * key, which is the whole of BRC-157's validity rule for the scalar interpretation.
 */
const GROUP_ORDER = new BigNumber('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 16)

/** The word counts BIP-39 allows, and therefore the only ones BRC-157 allows. */
export type WordCount = 12 | 15 | 18 | 21 | 24

/** Entropy byte lengths, in the same order. */
export type EntropyLength = 16 | 20 | 24 | 28 | 32

const LENGTHS: readonly EntropyLength[] = [16, 20, 24, 28, 32]
const WORD_COUNTS: readonly WordCount[] = [12, 15, 18, 21, 24]

/** BRC-157's derivation path for the root key, and for profile 0. */
const ROOT_PATH = "m/0'/0'"

/**
 * A uniformly random scalar in `[1, n − 1]`, serialised to 32 bytes.
 *
 * `PrivateKey.fromRandom()` rather than 32 random bytes, because a raw draw can land
 * on zero or above the group order and would then have to be rejected and redrawn —
 * which is exactly what the SDK already does. BRC-157 notes the resulting bias
 * against the full 256-bit space is about 2^-128, i.e. not a quantity anyone can
 * observe.
 *
 * 32 bytes means 24 words. That is the standard's requirement, not a preference: a
 * shorter phrase carries fewer entropy bytes, and every byte it does not carry is a
 * leading zero that share recovery then has to guess the length of (see trimEntropy).
 */
export function generateEntropy(): number[] {
  return PrivateKey.fromRandom().toArray('be', ENTROPY_BYTES)
}

/**
 * Whether these bytes are usable as BRC-157 entropy, and why not when they are not.
 *
 * A reason rather than a bare boolean because one of the failures is reachable by an
 * ordinary user with an ordinary phrase: `abandon abandon … about` is a VALID 12-word
 * BIP-39 sentence whose entropy is sixteen zero bytes. It builds a perfectly good
 * wallet — BIP-39's seed is a PBKDF2 of the words, not of the scalar — but as a
 * scalar it is zero, which cannot be Shamir-split. The share-generation path puts
 * this text in front of the user instead of throwing something about curve orders.
 */
export function validateEntropy(bytes: number[]): { valid: boolean; reason?: string } {
  if (!Array.isArray(bytes) || bytes.length === 0) {
    return { valid: false, reason: 'There is no entropy here.' }
  }
  if (bytes.length > ENTROPY_BYTES) {
    return { valid: false, reason: `Entropy is at most ${ENTROPY_BYTES} bytes; got ${bytes.length}.` }
  }
  if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
    return { valid: false, reason: 'Entropy must be whole bytes.' }
  }

  const value = new BigNumber(bytes, 'be')
  if (value.isZero()) {
    return {
      valid: false,
      reason:
        'This recovery phrase carries no entropy — every byte is zero — so it cannot ' +
        'be split into backup shares. The wallet still works; write the words down instead.'
    }
  }
  if (value.cmp(GROUP_ORDER) >= 0) {
    return {
      valid: false,
      reason: 'This entropy is above the secp256k1 group order and cannot be used as a key.'
    }
  }
  return { valid: true }
}

/** Throw with the validator's reason. Every entry point that needs valid entropy uses this. */
function assertEntropy(bytes: number[]): void {
  const check = validateEntropy(bytes)
  if (!check.valid) throw new Error(check.reason)
}

/**
 * Left-pad to 32 bytes, BRC-157's canonical form.
 *
 * Left, not right: the bytes are a big-endian integer, and padding the other end
 * would multiply it by 256 per byte — a different key that still looks plausible.
 */
export function padEntropy(bytes: number[]): number[] {
  assertEntropy(bytes)
  if (bytes.length === ENTROPY_BYTES) return [...bytes]
  return new Array(ENTROPY_BYTES - bytes.length).fill(0).concat(bytes)
}

/** How many leading zero bytes, which is the only clue a share-only recovery has. */
function leadingZeroBytes(bytes: number[]): number {
  let count = 0
  while (count < bytes.length && bytes[count] === 0) count += 1
  return count
}

function roundUpToMultipleOf4(value: number): number {
  return Math.ceil(value / 4) * 4
}

/**
 * Recover the ORIGINAL entropy length from the 32-byte form — BRC-157's trim rule.
 *
 * A 12-word phrase carries 16 bytes. Padded to 32 and split into shares, what comes
 * back out is 32 bytes with sixteen leading zeros, and re-encoding all 32 of them
 * yields a 24-word phrase that is NOT the phrase the user wrote down. It derives a
 * different wallet. So the length has to come back too.
 *
 * With `wordCount` known — printed on the share page, exactly because shares cannot
 * carry it — the answer is exact. Without it, BRC-157's heuristic:
 *
 *     max(16, roundUpToMultipleOf4(32 − leadingZeroBytes))
 *
 * The round-up is what makes it survive entropy whose own first byte happens to be
 * zero: 20 real bytes starting with a zero gives 13 leading zeros, 32 − 13 = 19, and
 * 19 rounds up to the 20 that was actually there. It is a heuristic and it can be
 * wrong for entropy with four or more of its own leading zero bytes, which is why the
 * word count is printed rather than inferred.
 */
export function trimEntropy(bytes32: number[], wordCount?: WordCount): number[] {
  if (bytes32.length !== ENTROPY_BYTES) {
    throw new Error(`the trim rule applies to ${ENTROPY_BYTES}-byte entropy; got ${bytes32.length}`)
  }

  const length = wordCount === undefined
    ? Math.min(ENTROPY_BYTES, Math.max(16, roundUpToMultipleOf4(ENTROPY_BYTES - leadingZeroBytes(bytes32))))
    : entropyBytesForWordCount(wordCount)

  return bytes32.slice(ENTROPY_BYTES - length)
}

/** 16→12, 20→15, 24→18, 28→21, 32→24. Anything else is not BIP-39 entropy. */
export function wordCountForEntropy(byteLength: number): WordCount {
  const index = LENGTHS.indexOf(byteLength as EntropyLength)
  if (index === -1) {
    throw new Error(`${byteLength} bytes is not a BIP-39 entropy length (${LENGTHS.join(', ')})`)
  }
  return WORD_COUNTS[index]
}

/** The same table read the other way. */
export function entropyBytesForWordCount(words: WordCount): EntropyLength {
  const index = WORD_COUNTS.indexOf(words)
  if (index === -1) {
    throw new Error(`${words} is not a BIP-39 word count (${WORD_COUNTS.join(', ')})`)
  }
  return LENGTHS[index]
}

/** True for 12, 15, 18, 21, 24 — the check both shells and the chrome share. */
export function isWordCount(value: number): value is WordCount {
  return (WORD_COUNTS as readonly number[]).includes(value)
}

/** Words of a phrase, normalised the way both shells normalise before storing. */
export function normalizePhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Entropy → BIP-39 sentence. Length must be one of the five BIP-39 lengths. */
export function entropyToMnemonic(bytes: number[]): string {
  wordCountForEntropy(bytes.length)
  return Mnemonic.fromEntropy(bytes).toString()
}

/**
 * BIP-39 sentence → entropy. Written out because @bsv/sdk has no decoder.
 *
 * `Mnemonic` (v2.1.9) encodes entropy (`fromEntropy`, `entropy2Mnemonic`) and derives
 * seeds (`toSeed`), and there is no way back to the entropy — which is the one
 * direction BRC-157 needs, both to split an imported phrase and to know how many
 * bytes a short phrase carried.
 *
 * `Mnemonic.fromString` runs first and does the real validation: unknown words,
 * invalid length and a bad checksum all throw there. The bit arithmetic below is then
 * only required to be correct. The checksum is re-verified anyway, because a silent
 * disagreement between the SDK's check and ours would mean we had decoded something
 * other than what it validated.
 *
 * The wordlist comes off a `Mnemonic` instance rather than through a subpath import
 * into `@bsv/sdk/dist`: the instance property is public API, the dist path is not.
 */
export function mnemonicToEntropy(phrase: string): number[] {
  const normalized = normalizePhrase(phrase)
  // Throws on unknown words, a length that is not a multiple of three, or a bad
  // checksum. Its message is user-facing in both shells.
  const parsed = Mnemonic.fromString(normalized)
  const wordlist = parsed.Wordlist
  const words = parsed.toString().split(wordlist.space).filter(Boolean)

  if (!isWordCount(words.length)) {
    throw new Error(`a recovery phrase is 12, 15, 18, 21 or 24 words; got ${words.length}`)
  }

  const indices = new Map<string, number>(wordlist.value.map((word, i) => [word, i]))
  let bits = ''
  for (const word of words) {
    const index = indices.get(word)
    if (index === undefined) throw new Error(`"${word}" is not a BIP-39 word`)
    bits += index.toString(2).padStart(11, '0')
  }

  // BIP-39: 11 bits per word, of which one thirty-third is checksum.
  const checksumBits = bits.length / 33
  const entropyBits = bits.length - checksumBits

  const bytes: number[] = []
  for (let i = 0; i < entropyBits; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))

  let digestBits = ''
  for (const byte of Hash.sha256(bytes)) digestBits += byte.toString(2).padStart(8, '0')
  if (digestBits.slice(0, checksumBits) !== bits.slice(entropyBits)) {
    throw new Error('recovery phrase checksum does not match — check for a mistyped word')
  }

  return bytes
}

/**
 * BRC-157's root key: `m/0'/0'` off the BIP-32 master built from the entropy's seed.
 *
 * Identical bytes to `recoverMnemonicWallet(phrase).primaryKey` for the phrase this
 * entropy encodes. Hardened at both levels, which is what separates the operational
 * key from the entropy: a leaked child cannot walk back up to it.
 *
 * The empty BIP-39 passphrase is BRC-157's default and Nexus has never offered
 * another. Adding one later changes what these bytes are, so it would be a change to
 * the backup artifact and not just to a settings screen.
 */
export function rootKeyFromEntropy(entropy: number[]): PrivateKey {
  return profileKeyFromEntropy(entropy, 0)
}

/**
 * BRC-157 profiles: `m/0'/i'`. Profile 0 IS the root key; 1, 2, 3… are its peers,
 * all recoverable from the one entropy value.
 *
 * Shipped and tested with nothing rendering it, so that the derivation is settled
 * before any UI depends on it — a profile scheme that changes after wallets exist is
 * a scheme that loses wallets.
 */
export function profileKeyFromEntropy(entropy: number[], index: number): PrivateKey {
  assertEntropy(entropy)
  if (!Number.isInteger(index) || index < 0) throw new Error('a profile index is a non-negative integer')
  const seed = Mnemonic.fromEntropy(entropy).toSeed('')
  const path = index === 0 ? ROOT_PATH : `m/0'/${index}'`
  return HD.fromSeed(seed).derive(path).privKey
}
