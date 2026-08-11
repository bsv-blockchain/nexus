/**
 * BRC-140 shares of BRC-157 entropy, and the full loop between the two artifacts.
 *
 *   node --experimental-transform-types --test packages/wallet-core/test/backupShares.test.mjs
 *
 * The test that justifies the whole change is "phrase → shares → phrase": before
 * BRC-157 the shares split `m/0'/0'`, so that loop could not close at all and a
 * share-recovered wallet had no phrase. The test that justifies ASKING the user
 * whether a page is legacy is the one below it, which shows the two readings of the
 * same bytes produce two different wallets with nothing to tell them apart.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Mnemonic, PrivateKey } from '@bsv/sdk'
import { SRC } from './loader.mjs'

const {
  DEFAULT_THRESHOLD,
  DEFAULT_TOTAL_SHARES,
  generateEntropyShares,
  generatePrintHTML,
  parseShare,
  parseShareSet,
  recoverEntropyFromShares,
  recoverKeyFromShares,
  recoverMnemonicFromShares,
  validateShareCompatibility
} = await import(`${SRC}utils/backupShares.ts`)
const { ENTROPY_BYTES, entropyBytesForWordCount, entropyToMnemonic, mnemonicToEntropy, padEntropy } =
  await import(`${SRC}utils/entropy.ts`)
const { generateMnemonicWallet, recoverMnemonicWallet, recoverWalletFromEntropy } =
  await import(`${SRC}utils/mnemonicWallet.ts`)

function fill(length, step) {
  return new Array(length).fill(0).map((_, i) => (i * step + 3) & 0xff)
}

const BITS_BY_WORDS = { 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 }
const ALL_WORD_COUNTS = [12, 15, 18, 21, 24]

describe('generateEntropyShares', () => {
  it('defaults to any 2 of 3', () => {
    const shares = generateEntropyShares(fill(32, 7))
    assert.equal(DEFAULT_THRESHOLD, 2)
    assert.equal(DEFAULT_TOTAL_SHARES, 3)
    assert.equal(shares.length, 3)
    assert.equal(parseShare(shares[0]).threshold, 2)
  })

  it('produces shares in BRC-140 format: base58(x).base58(y).threshold.integrity', () => {
    for (const share of generateEntropyShares(fill(32, 7))) {
      const parsed = parseShare(share)
      assert.ok(parsed, share)
      assert.equal(share.split('.').length, 4)
      assert.ok(parsed.integrity.length > 0)
    }
  })

  it('shares from one entropy all carry the same integrity tag', () => {
    const shares = generateEntropyShares(fill(32, 7), 3, 5).map(parseShare)
    assert.equal(new Set(shares.map((s) => s.integrity)).size, 1)
  })

  it('refuses entropy that cannot be a key, with the reason the user sees', () => {
    assert.throws(
      () => generateEntropyShares(new Array(16).fill(0)),
      /cannot .*be split into backup shares/
    )
  })

  it('refuses an impossible split', () => {
    assert.throws(() => generateEntropyShares(fill(32, 7), 1, 3), /at least 2/)
    assert.throws(() => generateEntropyShares(fill(32, 7), 3, 2), /cannot satisfy/)
  })
})

describe('recoverEntropyFromShares', () => {
  it('round-trips 32-byte entropy through 2 of 3', () => {
    const entropy = fill(32, 11)
    const shares = generateEntropyShares(entropy)
    for (const pair of [[0, 1], [0, 2], [1, 2]]) {
      const recovered = recoverEntropyFromShares(pair.map((i) => shares[i]), 24)
      assert.deepEqual(recovered.entropy, entropy)
      assert.deepEqual(recovered.entropy32, entropy)
      assert.equal(recovered.wordCount, 24)
    }
  })

  it('accepts MORE shares than the threshold', () => {
    // The recovery screen lets someone paste every page they have rather than count
    // out exactly two, so a surplus must recover and not throw.
    const entropy = fill(32, 11)
    const shares = generateEntropyShares(entropy)
    assert.deepEqual(recoverEntropyFromShares(shares, 24).entropy, entropy)
    assert.equal(recoverMnemonicFromShares(shares, 24), entropyToMnemonic(entropy))
  })

  it('round-trips 3 of 5, and refuses 2 of them', () => {
    const entropy = fill(32, 13)
    const shares = generateEntropyShares(entropy, 3, 5)
    assert.deepEqual(recoverEntropyFromShares([shares[4], shares[0], shares[2]], 24).entropy, entropy)
    assert.throws(() => recoverEntropyFromShares([shares[0], shares[1]], 24), /needs 3 shares/)
  })

  it('keeps the leading zero bytes a short phrase pads with', () => {
    // The bug this guards: PrivateKey.toArray() is minimal-length, so 16 bytes of
    // entropy padded to 32 would come back as 16 bytes and the trim would cut into
    // real entropy.
    const entropy = fill(16, 17)
    const shares = generateEntropyShares(entropy)
    const recovered = recoverEntropyFromShares([shares[0], shares[1]], 12)
    assert.equal(recovered.entropy32.length, ENTROPY_BYTES)
    assert.deepEqual(recovered.entropy32, padEntropy(entropy))
    assert.deepEqual(recovered.entropy, entropy)
    assert.equal(recovered.wordCount, 12)
  })

  it('recovers every phrase length, with the word count and without it', () => {
    for (const words of ALL_WORD_COUNTS) {
      const entropy = fill(entropyBytesForWordCount(words), 19)
      const shares = generateEntropyShares(entropy)
      const pair = [shares[0], shares[2]]
      assert.deepEqual(recoverEntropyFromShares(pair, words).entropy, entropy, `${words} with count`)
      assert.deepEqual(recoverEntropyFromShares(pair).entropy, entropy, `${words} without count`)
    }
  })

  it('rejects a malformed or mismatched set as a set', () => {
    const a = generateEntropyShares(fill(32, 3))
    const b = generateEntropyShares(fill(32, 5))
    assert.throws(() => recoverEntropyFromShares(['not-a-share', a[1]]), /expected format/)
    assert.throws(() => recoverEntropyFromShares([a[0], b[0]]), /different keys/)
    assert.throws(() => recoverEntropyFromShares([a[0], a[0]]), /already been scanned/)
    assert.throws(() => recoverEntropyFromShares([]), /no shares/)
  })
})

describe('the BRC-157 loop', () => {
  /*
   * This is the change, stated as an assertion. Before it, the shares split `m/0'/0'`
   * and there was no way back to the words at all.
   */
  it('phrase → entropy → shares → entropy → the same phrase and the same wallet', () => {
    for (const words of ALL_WORD_COUNTS) {
      const phrase = Mnemonic.fromRandom(BITS_BY_WORDS[words]).toString()
      const original = recoverMnemonicWallet(phrase)
      assert.equal(original.wordCount, words)

      const shares = generateEntropyShares(original.entropy)
      const back = recoverMnemonicFromShares([shares[1], shares[2]], words)

      assert.equal(back, phrase, `${words} words`)
      assert.equal(recoverMnemonicWallet(back).identityKey, original.identityKey)
    }
  })

  it('closes for a freshly generated wallet too — 24 words, no trim ambiguity', () => {
    const created = generateMnemonicWallet()
    assert.equal(created.wordCount, 24)
    assert.equal(created.entropy.length, ENTROPY_BYTES)

    const shares = generateEntropyShares(created.entropy)
    // No word count passed: a 24-word wallet needs no printed hint.
    const recovered = recoverEntropyFromShares([shares[0], shares[1]])
    assert.deepEqual(recovered.entropy, created.entropy)
    assert.equal(recoverWalletFromEntropy(recovered.entropy).identityKey, created.identityKey)
  })

  it('a second split of the same wallet agrees with the first', () => {
    // What the old scheme could not do: shares made from a share-recovered wallet had
    // to agree with shares made from the phrase.
    const phrase = Mnemonic.fromRandom(128).toString()
    const first = generateEntropyShares(mnemonicToEntropy(phrase))
    const viaShares = recoverMnemonicFromShares([first[0], first[1]], 12)
    const second = generateEntropyShares(mnemonicToEntropy(viaShares))
    assert.equal(parseShare(second[0]).integrity, parseShare(first[0]).integrity)
  })
})

describe('legacy shares', () => {
  /*
   * Why the recovery flow ASKS instead of guessing: the same four strings read two
   * ways give two different wallets, and BRC-140 carries no marker to tell them apart.
   */
  it('read as a primary key and as entropy, the same shares give different wallets', () => {
    const entropy = fill(32, 23)
    const shares = generateEntropyShares(entropy)
    const pair = [shares[0], shares[1]]

    const asEntropy = recoverWalletFromEntropy(recoverEntropyFromShares(pair, 24).entropy).identityKey
    const asPrimaryKey = recoverKeyFromShares(pair).toPublicKey().toString()

    assert.notEqual(asEntropy, asPrimaryKey)
  })

  it('recovers exactly the scalar a legacy page split', () => {
    // What BSV Browser printed: shares of m/0'/0' itself. Run repeatedly, and compared
    // in the canonical 32-byte form on BOTH sides: a key beginning with a zero byte is
    // a 1-in-256 event that used to make this comparison fail on length alone.
    for (let i = 0; i < 8; i++) {
      const primaryKey = recoverMnemonicWallet(Mnemonic.fromRandom(128).toString()).primaryKey
      assert.equal(primaryKey.length, 32)
      const legacyShares = new PrivateKey(primaryKey).toBackupShares(2, 3)
      const recovered = recoverKeyFromShares([legacyShares[0], legacyShares[2]])
      assert.deepEqual(recovered.toArray('be', 32), primaryKey)
    }
  })
})

describe('parseShare / validateShareCompatibility', () => {
  it('rejects anything that is not four dot-separated parts', () => {
    assert.equal(parseShare('a.b.2'), null)
    assert.equal(parseShare('a.b.2.c.d'), null)
    assert.equal(parseShare('.b.2.c'), null)
    assert.equal(parseShare('a.b.notanumber.c'), null)
    assert.equal(parseShare('a.b.1.c'), null)
  })

  it('accepts the first share unconditionally, then holds the set to it', () => {
    const shares = generateEntropyShares(fill(32, 29)).map(parseShare)
    assert.equal(validateShareCompatibility(shares[0], []), null)
    assert.equal(validateShareCompatibility(shares[1], [shares[0]]), null)
    assert.match(validateShareCompatibility(shares[0], [shares[0]]), /already been scanned/)
  })

  it('parseShareSet reports the index of the offending share', () => {
    const shares = generateEntropyShares(fill(32, 31))
    assert.match(parseShareSet([shares[0], 'rubbish']).error, /share 2/)
    assert.equal(parseShareSet([shares[0], shares[1]]).error, undefined)
  })
})

describe('the printed page', () => {
  const NOW = new Date('2026-08-11T09:30:00.000Z')

  it('is self-describing: BRC-157, the word count, the threshold, every share once', async () => {
    const entropy = fill(16, 37)
    const shares = generateEntropyShares(entropy)
    const identityKey = recoverWalletFromEntropy(entropy).identityKey
    const html = await generatePrintHTML(shares, identityKey, { wordCount: 12, now: NOW })

    assert.match(html, /BRC-157/)
    assert.match(html, /Recovers a 12-word recovery phrase/)
    assert.match(html, /You need any 2 of them/)
    assert.match(html, /2026-08-11 09:30:00/)
    assert.match(html, /Restore from backup shares/)

    for (const share of shares) {
      assert.equal(html.split(share).length - 1, 1, `share appears exactly once: ${share}`)
    }
    // One page per share, and the identity key on all of them so an orphaned sheet is
    // identifiable.
    assert.equal(html.split('class="page').length - 1, shares.length)
    assert.equal(html.split(identityKey).length - 1, shares.length)
  })

  it('reads the threshold off the shares when it is not given', async () => {
    const shares = generateEntropyShares(fill(32, 41), 3, 5)
    const html = await generatePrintHTML(shares, 'deadbeef', { wordCount: 24, now: NOW })
    assert.match(html, /Share 1 of 5/)
    assert.match(html, /You need any 3 of them/)
  })

  it('embeds a QR per share plus the identity QR on each page', async () => {
    const shares = generateEntropyShares(fill(32, 43))
    const html = await generatePrintHTML(shares, 'deadbeef', { wordCount: 24, now: NOW })
    // 3 share QRs + 3 copies of the identity QR.
    assert.equal(html.split('<svg').length - 1, shares.length * 2)
  })

  it('refuses to print nothing', async () => {
    await assert.rejects(() => generatePrintHTML([], 'deadbeef', { wordCount: 24 }), /no shares/)
  })

  it('escapes the values it interpolates', async () => {
    const shares = generateEntropyShares(fill(32, 47))
    const html = await generatePrintHTML(shares, '<script>alert(1)</script>', { wordCount: 24, now: NOW })
    assert.ok(!html.includes('<script>alert(1)</script>'))
    assert.match(html, /&lt;script&gt;/)
  })
})

describe('entropyToMnemonic agrees with the wallet builders', () => {
  it('a wallet built from entropy and one built from its phrase are the same wallet', () => {
    const entropy = fill(28, 53)
    const phrase = entropyToMnemonic(entropy)
    assert.equal(recoverWalletFromEntropy(entropy).identityKey, recoverMnemonicWallet(phrase).identityKey)
    assert.equal(recoverWalletFromEntropy(entropy).mnemonic, phrase)
  })
})
