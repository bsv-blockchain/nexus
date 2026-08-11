/**
 * BRC-157 conformance for the entropy root.
 *
 * Run with `npm test` from the repo root, or directly:
 *
 *   node --experimental-transform-types --test packages/wallet-core/test/entropy.test.mjs
 *
 * The load-bearing test in this file is "root key equals the existing primary key".
 * If that ever fails, adopting BRC-157 has become a migration rather than a rename,
 * and every wallet on every device would come back with a different identity key.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Mnemonic, PrivateKey } from '@bsv/sdk'
// Registers extensionless resolution; see the file. Static so it evaluates first,
// dynamic imports below so they resolve after it has.
import { SRC } from './loader.mjs'

const {
  ENTROPY_BYTES,
  entropyBytesForWordCount,
  entropyToMnemonic,
  generateEntropy,
  isWordCount,
  mnemonicToEntropy,
  normalizePhrase,
  padEntropy,
  profileKeyFromEntropy,
  rootKeyFromEntropy,
  trimEntropy,
  validateEntropy,
  wordCountForEntropy
} = await import(`${SRC}utils/entropy.ts`)
const { recoverMnemonicWallet } = await import(`${SRC}utils/mnemonicWallet.ts`)

/** Deterministic filler, so a failure is reproducible rather than "sometimes". */
function fill(length, step) {
  return new Array(length).fill(0).map((_, i) => (i * step + 3) & 0xff)
}

const BITS_BY_WORDS = { 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 }
const ALL_WORD_COUNTS = [12, 15, 18, 21, 24]

describe('generateEntropy', () => {
  it('produces 32 bytes that are a valid secp256k1 scalar', () => {
    for (let i = 0; i < 64; i++) {
      const entropy = generateEntropy()
      assert.equal(entropy.length, ENTROPY_BYTES)
      assert.deepEqual(validateEntropy(entropy), { valid: true })
      // Every byte in range, which `new PrivateKey` would silently tolerate.
      assert.ok(entropy.every((b) => Number.isInteger(b) && b >= 0 && b <= 255))
    }
  })

  it('encodes to a 24-word phrase — the length BRC-157 asks new wallets to generate', () => {
    assert.equal(entropyToMnemonic(generateEntropy()).split(' ').length, 24)
  })

  it('does not repeat', () => {
    const seen = new Set()
    for (let i = 0; i < 32; i++) seen.add(generateEntropy().join(','))
    assert.equal(seen.size, 32)
  })
})

describe('validateEntropy', () => {
  it('accepts every BIP-39 length', () => {
    for (const length of [16, 20, 24, 28, 32]) {
      assert.equal(validateEntropy(fill(length, 7)).valid, true, `${length} bytes`)
    }
  })

  it('rejects zero with a reason a user can act on', () => {
    const result = validateEntropy(new Array(32).fill(0))
    assert.equal(result.valid, false)
    assert.match(result.reason, /cannot .*be split into backup shares/)
  })

  it('rejects a value at or above the group order', () => {
    // n itself, and n + 1 by way of all-0xff.
    const n = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
    const bytes = n.match(/../g).map((h) => parseInt(h, 16))
    const atOrder = validateEntropy(bytes)
    assert.equal(atOrder.valid, false)
    assert.match(atOrder.reason, /group order/)
    assert.equal(validateEntropy(new Array(32).fill(255)).valid, false)
  })

  it('rejects more than 32 bytes, and non-bytes', () => {
    assert.equal(validateEntropy(new Array(33).fill(1)).valid, false)
    assert.equal(validateEntropy([1, 2, 999]).valid, false)
    assert.equal(validateEntropy([1, 2, -1]).valid, false)
    assert.equal(validateEntropy([]).valid, false)
  })

  it('rejects "abandon … about" — a valid phrase whose entropy is all zeros', () => {
    const phrase = `${'abandon '.repeat(11)}about`
    const entropy = mnemonicToEntropy(phrase)
    assert.equal(entropy.length, 16)
    assert.ok(entropy.every((b) => b === 0))

    // The wallet still builds — BIP-39's seed is a PBKDF2 of the words, not of the
    // scalar — so this must be a share-generation refusal and not a restore failure.
    assert.equal(validateEntropy(entropy).valid, false)
    assert.ok(recoverMnemonicWallet(phrase).identityKey.length > 0)
  })
})

describe('BIP-39 round trip', () => {
  it('entropy → phrase → entropy is byte-identical at every length', () => {
    for (const words of ALL_WORD_COUNTS) {
      const length = entropyBytesForWordCount(words)
      const entropy = fill(length, 11)
      const phrase = entropyToMnemonic(entropy)
      assert.equal(phrase.split(' ').length, words)
      assert.deepEqual(mnemonicToEntropy(phrase), entropy)
    }
  })

  it('agrees with the SDK for randomly generated phrases', () => {
    for (const words of ALL_WORD_COUNTS) {
      const phrase = Mnemonic.fromRandom(BITS_BY_WORDS[words]).toString()
      const entropy = mnemonicToEntropy(phrase)
      assert.equal(entropy.length, entropyBytesForWordCount(words))
      assert.equal(entropyToMnemonic(entropy), phrase)
    }
  })

  it('normalises case and whitespace before decoding', () => {
    const phrase = Mnemonic.fromRandom(128).toString()
    const messy = `  ${phrase.toUpperCase().replace(/ /g, '   ')}\n`
    assert.deepEqual(mnemonicToEntropy(messy), mnemonicToEntropy(phrase))
    assert.equal(normalizePhrase(messy), phrase)
  })

  it('refuses a mistyped word, a bad checksum and a wrong length', () => {
    assert.throws(() => mnemonicToEntropy(`${'abandon '.repeat(11)}zzzznotaword`))
    // Twelve valid words whose checksum is wrong.
    assert.throws(() => mnemonicToEntropy('abandon '.repeat(12).trim()))
    assert.throws(() => mnemonicToEntropy('abandon abandon abandon'))
  })

  it('refuses to encode entropy that is not a BIP-39 length', () => {
    assert.throws(() => entropyToMnemonic(fill(17, 5)), /not a BIP-39 entropy length/)
  })
})

describe('padEntropy / trimEntropy', () => {
  it('pads on the left, because the bytes are a big-endian integer', () => {
    const entropy = fill(16, 13)
    const padded = padEntropy(entropy)
    assert.equal(padded.length, ENTROPY_BYTES)
    assert.deepEqual(padded.slice(0, 16), new Array(16).fill(0))
    assert.deepEqual(padded.slice(16), entropy)
  })

  it('is a no-op copy at 32 bytes', () => {
    const entropy = fill(32, 3)
    const padded = padEntropy(entropy)
    assert.deepEqual(padded, entropy)
    assert.notEqual(padded, entropy)
  })

  it('trims exactly when the word count is known', () => {
    for (const words of ALL_WORD_COUNTS) {
      const entropy = fill(entropyBytesForWordCount(words), 17)
      assert.deepEqual(trimEntropy(padEntropy(entropy), words), entropy)
    }
  })

  it("trims by BRC-157's heuristic when the word count is not", () => {
    for (const words of ALL_WORD_COUNTS) {
      const entropy = fill(entropyBytesForWordCount(words), 17)
      assert.deepEqual(trimEntropy(padEntropy(entropy)), entropy, `${words} words`)
    }
  })

  it('survives entropy whose own first byte is zero, via the round-up', () => {
    for (const words of [15, 18, 21, 24]) {
      const length = entropyBytesForWordCount(words)
      const entropy = fill(length, 17)
      entropy[0] = 0
      assert.deepEqual(trimEntropy(padEntropy(entropy)), entropy, `${words} words`)
    }
  })

  it('never returns less than 16 bytes, whatever the leading zeros say', () => {
    const bytes = new Array(32).fill(0)
    bytes[31] = 1
    assert.equal(trimEntropy(bytes).length, 16)
  })

  it('only applies to 32-byte input', () => {
    assert.throws(() => trimEntropy(fill(16, 5)), /32-byte entropy/)
  })
})

describe('word count table', () => {
  it('maps both directions', () => {
    for (const words of ALL_WORD_COUNTS) {
      assert.equal(wordCountForEntropy(entropyBytesForWordCount(words)), words)
    }
  })

  it('refuses lengths BIP-39 does not define', () => {
    assert.throws(() => wordCountForEntropy(31))
    assert.throws(() => entropyBytesForWordCount(13))
  })

  it('isWordCount is the shared gate for the five accepted lengths', () => {
    for (const words of ALL_WORD_COUNTS) assert.equal(isWordCount(words), true)
    for (const words of [0, 11, 13, 23, 25, 48]) assert.equal(isWordCount(words), false)
  })
})

describe('BRC-157 root key', () => {
  /*
   * THE load-bearing assertion. BRC-157 calls this key the root key; Nexus has always
   * called it the primary key and derived it straight from the phrase. If these two
   * ever disagree, existing wallets do not survive the change.
   */
  it('equals the primary key mnemonicWallet has always derived', () => {
    for (const words of ALL_WORD_COUNTS) {
      const phrase = Mnemonic.fromRandom(BITS_BY_WORDS[words]).toString()
      const fromEntropy = rootKeyFromEntropy(mnemonicToEntropy(phrase)).toArray('be', 32)
      const fromPhrase = recoverMnemonicWallet(phrase).primaryKey
      assert.deepEqual(fromEntropy, fromPhrase, `${words} words`)
    }
  })

  /*
   * Guards a 1-in-256 flake, not a hypothesis: BigNumber.toArray() is minimal-length,
   * so a primary key beginning with a zero byte used to come out as 31 bytes. Harmless
   * as it happened — every consumer re-parses big-endian — but a length that is a coin
   * flip is a bug waiting for the first caller that hashes or length-prefixes it.
   */
  it('is always 32 bytes, even when the key begins with a zero byte', () => {
    for (let i = 0; i < 400; i++) {
      const { primaryKey } = recoverMnemonicWallet(Mnemonic.fromRandom(128).toString())
      assert.equal(primaryKey.length, 32)
    }
  })

  it('is deterministic and hardened-derived from the entropy alone', () => {
    const entropy = fill(32, 29)
    assert.equal(rootKeyFromEntropy(entropy).toHex(), rootKeyFromEntropy([...entropy]).toHex())
  })

  it('changes completely when one entropy bit changes', () => {
    const a = fill(32, 29)
    const b = [...a]
    b[31] ^= 1
    assert.notEqual(rootKeyFromEntropy(a).toHex(), rootKeyFromEntropy(b).toHex())
  })

  it('refuses entropy that is not a valid scalar', () => {
    assert.throws(() => rootKeyFromEntropy(new Array(16).fill(0)), /cannot/)
  })
})

describe('BRC-157 profiles', () => {
  it('profile 0 is the root key', () => {
    const entropy = fill(32, 23)
    assert.equal(profileKeyFromEntropy(entropy, 0).toHex(), rootKeyFromEntropy(entropy).toHex())
  })

  it('profiles 1..4 are distinct peers under the same entropy', () => {
    const entropy = fill(32, 23)
    const keys = [0, 1, 2, 3, 4].map((i) => profileKeyFromEntropy(entropy, i).toHex())
    assert.equal(new Set(keys).size, 5)
  })

  it('every profile is a usable private key', () => {
    const entropy = fill(32, 23)
    for (const index of [0, 1, 7]) {
      const key = profileKeyFromEntropy(entropy, index)
      assert.ok(key instanceof PrivateKey)
      assert.equal(key.toPublicKey().toString().length, 66)
    }
  })

  it('refuses a negative or fractional index', () => {
    const entropy = fill(32, 23)
    assert.throws(() => profileKeyFromEntropy(entropy, -1), /non-negative/)
    assert.throws(() => profileKeyFromEntropy(entropy, 1.5), /non-negative/)
  })
})
