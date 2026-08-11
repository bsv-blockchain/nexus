# SPEC: Backup and recovery — entropy is the wallet (BRC-157)

Status: agreed 2026-08-11, not implemented. Scope of one implementation pass.
Standard: [BRC-157](https://bsv.brc.dev/key-derivation/0157) — *Entropy-Rooted Backup
and Recovery with Mnemonics and Backup Shares*. Related: BRC-140 (share format),
BRC-32 (BIP-32 paths), BRC-42 (derivation below the root key), BRC-100 (identity key).

## Why

Nexus has two backup artifacts and they recover two different wallets.

`packages/wallet-core/src/utils/mnemonicWallet.ts` generates a BIP-39 phrase, takes
its seed, and derives the operational key at `m/0'/0'` — it calls that key
`primaryKey`. `packages/wallet-core/src/utils/backupShares.ts` takes that same
`primaryKey` and Shamir-splits **it**. So:

- the phrase recovers entropy → seed → `m/0'/0'`
- the shares recover `m/0'/0'` and nothing above it

A wallet recovered from shares therefore has no phrase, cannot ever produce one, and
cannot produce a *second* set of shares that a phrase-recovered wallet would agree
with. `apps/mobile/src/wallet/WalletContext.tsx:1269` makes that concrete: it takes
the scalar recovered from shares and installs it as `primaryKey` directly, then
stores it as a `recoveredKey` WIF — a third kind of wallet identity, alongside
"mnemonic wallet" and "snapshot wallet".

BRC-157 fixes this by moving the root one level up. **Entropy is the recoverable
object.** A single 32-byte entropy value is *both* a BIP-39 sentence *and* a
secp256k1 scalar that BRC-140 can split. Either artifact recovers the same entropy;
canonical derivation from that entropy produces the same wallet. That is the whole
of the standard, and it is why this pass exists.

Two more things are wrong today and get fixed on the way past:

- **Only 12 and 24 words are accepted.** Both shells hard-reject anything else
  (`apps/desktop/src/wallet/host.mjs:389`, `apps/mobile/src/wallet/useWalletBridge.ts:250`),
  and so does the chrome (`apps/ui/components/hub/wallet-gate.tsx:42`). BRC-157
  requires 12, 15, 18, 21 and 24, and a user with a 15-word phrase from another
  wallet currently cannot get in at all.
- **`backup.shares` does not exist.** It is declared in `packages/bridge/src/protocol.js:74`
  and called in `packages/bridge/src/client.js:168`, and no shell answers it. The
  print-HTML generator it would call has never run.

## The load-bearing finding

BRC-157's root key is:

```
rootKey = HD.fromSeed(Mnemonic.fromEntropy(entropy).toSeed()).derive("m/0'/0'").privKey
```

Nexus's `primaryKey` is `HD.fromSeed(mnemonic.toSeed()).derive("m/0'/0'").privKey`.

**These are the same bytes.** Verified against `@bsv/sdk@2.1.9`: for the same phrase,
`Mnemonic.fromEntropy(entropy).toString() === mnemonic` and the derived key is
byte-identical. So every wallet Nexus has ever created from a phrase is *already*
BRC-157-conformant at the operational-key level. Nothing about existing wallets
changes: same identity key, same database, same funds, no migration.

What changes is only what the *other* artifact splits — entropy instead of
`m/0'/0'` — plus the vocabulary. BRC-157 calls `m/0'/0'` the **root key**; Nexus
calls it the **primary key**. They are the same key and the code will say so rather
than renaming a field 40 call sites deep.

### One thing the equality test shook out

`primaryKey` was `derivedHdKey.privKey.toArray()`, and `BigNumber.toArray()` is
**minimal-length**: about one key in 256 begins with a zero byte and came out as 31
bytes rather than 32. Nothing was broken by it — every consumer re-reads the array
through `new PrivateKey(bytes)`, which parses big-endian, so the integer and therefore
the identity key were always right — but the length of the wallet's own primary key was
a coin flip. A test asserting a legacy share round-trip caught it as a 1-in-256 flake.

It is now `toArray('be', 32)`. Safe for existing wallets for exactly the reason it was
harmless: the padded form is the same scalar, so no identity, database or balance
moves. `test/entropy.test.mjs` asserts the length over 400 draws.

The BIP-32 master private key (`HD.fromSeed(seed).privKey`, what Nexus calls
`rootKey` and hands to `PrivilegedKeyManager`) is **not** touched. BRC-157 forbids
the *entropy* key from signing or deriving operational keys; the BIP-32 master is
separated from entropy by PBKDF2 and is not the entropy. Changing what feeds the
privileged key manager would invalidate existing privileged operations for no gain,
so it stays exactly as it is.

## Decisions taken

| question | decision |
|---|---|
| what a new wallet generates | **32 bytes of entropy → 24 words.** BRC-157 requires a uniform scalar in `[1, n−1]` serialised as 32 bytes; that is 24 words, not 12 |
| what shares split | **the entropy**, left-padded to 32 bytes — never `m/0'/0'` |
| what share recovery stores | **the reconstructed mnemonic**, so a share-recovered wallet is a fully backed-up wallet |
| accepted import lengths | 12, 15, 18, 21, 24 words |
| how word count survives a share-only recovery | **printed on the share page**, plus BRC-157's leading-zero fallback heuristic when it is absent |
| legacy shares (BSV Browser / metanet-mobile, which split `m/0'/0'`) | supported as an explicitly-labelled **legacy** import that keeps the existing `recoveredKey` path. Not silently guessed at |
| profiles (`m/0'/i'`) | derivation function ships and is tested; **no UI** this pass |
| `backup.exportDb` / `backup.importDb` | **out of scope** — see §8 |
| BIP-39 passphrase | **not offered.** See §8 |
| where key material may live | unchanged: the shell. All three shares together are equivalent to the wallet, so they never cross the bridge into the chrome |

## 1. `packages/wallet-core/src/utils/entropy.ts` — the new root

One new module, dependency-free apart from `@bsv/sdk`. It is the only place that
knows what entropy *is*, and everything else asks it.

```ts
/** BRC-157's canonical serialisation: 32 bytes, big-endian, zero-padded left. */
export const ENTROPY_BYTES = 32

/** Word counts BIP-39 allows, and therefore BRC-157 allows. */
export type WordCount = 12 | 15 | 18 | 21 | 24

/** A uniformly random scalar in [1, n−1], serialised to 32 bytes. */
export function generateEntropy(): number[]

/** In [1, n−1] when read big-endian. Zero and ≥ n are rejected, with a reason. */
export function validateEntropy(bytes: number[]): { valid: boolean; reason?: string }

/** Left-pad to 32 bytes. Throws if longer, or if the value is out of range. */
export function padEntropy(bytes: number[]): number[]

/**
 * BRC-157's recovery trim. With `wordCount` known it is exact; without it, the
 * documented heuristic: max(16, roundUpToMultipleOf4(32 − leadingZeroBytes)).
 */
export function trimEntropy(bytes32: number[], wordCount?: WordCount): number[]

/** Natural entropy length ⇄ word count. 16→12, 20→15, 24→18, 28→21, 32→24. */
export function wordCountForEntropy(byteLength: number): WordCount
export function entropyBytesForWordCount(words: WordCount): 16 | 20 | 24 | 28 | 32

/** BIP-39, both directions. `toEntropy` is ours: @bsv/sdk has no decoder. */
export function entropyToMnemonic(bytes: number[]): string
export function mnemonicToEntropy(phrase: string): number[]

/** BRC-157 §"Root Key Derivation". Identical bytes to Nexus's `primaryKey`. */
export function rootKeyFromEntropy(entropy: number[]): PrivateKey

/** BRC-157 §"Profiles". profile 0 is the root key. */
export function profileKeyFromEntropy(entropy: number[], index: number): PrivateKey
```

### `mnemonicToEntropy` has to be written, not imported

`@bsv/sdk@2.1.9`'s `Mnemonic` encodes entropy (`fromEntropy`, `entropy2Mnemonic`)
and produces seeds (`toSeed`), but has **no** mnemonic → entropy method. Recovering
entropy from a phrase is exactly what BRC-157 needs — to split an imported phrase
into shares, and to know how many bytes a short phrase carried.

So: 11 bits per word against the BIP-39 English wordlist, `checksumBits = totalBits / 33`,
entropy is the rest, and the checksum is verified against `sha256(entropy)`.
`Mnemonic.fromString` runs first and does the wordlist/length/checksum validation
(it throws on a bad phrase); the bit maths then only has to be correct, not defensive.
The wordlist is reached as `new Mnemonic().Wordlist` — an instance property — so no
subpath import into the SDK's internals is needed.

Verified round-trip at all five lengths against `Mnemonic.fromRandom(bits)`:
128→16 bytes, 160→20, 192→24, 224→28, 256→32, each re-encoding to the identical
phrase.

### The zero-entropy case is real and must be refused honestly

`abandon abandon … about` is a **valid** 12-word BIP-39 phrase whose entropy is
sixteen zero bytes. It builds a perfectly good wallet — BIP-39's seed is a PBKDF2 of
the *words*, not of the scalar — but padded to 32 bytes it is the scalar zero, which
is not a valid secp256k1 private key and cannot be Shamir-split.

So `validateEntropy` rejects it, and the share-generation path reports *"this
recovery phrase cannot be split into backup shares"* with the reason. It does not
crash, and it does not refuse to build the wallet. Same for the astronomically
unlikely `≥ n` case.

## 2. `mnemonicWallet.ts` — routed through entropy

Keeps its exported names, because 6 call sites across both shells import them. What
changes:

- `generateMnemonicWallet()` with no phrase now calls `generateEntropy()` and
  `entropyToMnemonic()` — **24 words**, replacing `Mnemonic.fromRandom()`'s 12.
- the result gains `entropy: number[]` and `wordCount: WordCount`.
- `primaryKey` is documented as BRC-157's root key, with the equality stated.
- `parseMnemonic` accepts 12/15/18/21/24 (it already listed all five; the shells
  are what narrowed it).

Three functions are deleted rather than carried:

- `encodeMnemonicForStorage` / `decodeMnemonicFromStorage` — base64 with a comment
  saying "in production, this should encrypt". Unused, and a function named
  *forStorage* that does not encrypt is a trap for the next reader. Both shells
  already use real OS keychains.
- `generateRandomMnemonic(strength)` — takes a `strength` argument and ignores it,
  always returning 12 words. Unused. A function that silently disregards the one
  parameter that matters is worse than no function.

## 3. `backupShares.ts` — splits entropy

```ts
/** BRC-140 shares of the ENTROPY, not of m/0'/0'. */
export function generateEntropyShares(
  entropy: number[], threshold?: number, totalShares?: number
): string[]

/** 32 bytes as recovered, plus the trim BRC-157 specifies. */
export function recoverEntropyFromShares(
  shares: string[], wordCount?: WordCount
): { entropy: number[]; entropy32: number[]; wordCount: WordCount }
```

`parseShare` and `validateShareCompatibility` are unchanged — they are format and
consistency checks and know nothing about what was split.

`recoverKeyFromShares` stays, renamed in its comment to what it now is: the
**legacy** reader, for shares printed by BSV Browser / metanet-mobile against
`m/0'/0'`. BRC-140's format carries no version marker and its integrity tag is a
hash of the split scalar, so legacy and BRC-157 shares are indistinguishable by
inspection. Guessing between them would either produce a wallet with the wrong
identity key or silently drop into a keyless state. The user is asked instead, once,
with the two options named after the app that printed the page.

### The printed page

Same layout as the reference implementation, three additions, all of them because a
sheet of paper found in five years has to be self-describing:

- `BRC-157` and the share index in the header, so the recovery flow can be told
  which scheme this is without a guess
- **the word count** (`Recovers a 24-word phrase`), which is the one fact shares
  alone cannot carry and BRC-157 explicitly says to record
- recovery instructions naming Nexus, not BSV Browser

The identity-key QR stays: it is the wallet's receiving identity, it is public, and
having it on the page is what makes an orphaned share sheet identifiable.

## 4. Bridge protocol

```
WALLET_RESTORE_SHARES: 'wallet.restoreShares'   // new
BACKUP_SHARES:         'backup.shares'          // declared since day one; implemented here
```

`wallet.restoreShares({ shares: string[], wordCount?: 12|15|18|21|24, legacy?: boolean })`

- default path: recover entropy → trim → mnemonic → build → store the **mnemonic**.
  The wallet that comes out is indistinguishable from a phrase-restored one, which
  is the point of BRC-157.
- `legacy: true`: recover the scalar, treat it as `primaryKey`, store it the way the
  existing `recoveredKey` path does. No mnemonic exists for such a wallet and the UI
  says so.

`backup.shares({ threshold?, totalShares? })` reads the stored phrase behind whatever
gate the platform has, derives entropy, splits it, renders the print document, and
**hands the document to the OS, not to the chrome**. It returns
`{ ok, threshold, totalShares, wordCount }` — counts and never a share. Three shares
in the renderer would be the wallet in the renderer, and
`apps/desktop/src/wallet/buildWallet.ts` exists precisely because that process also
hosts arbitrary third-party pages.

`backup.exportDb` / `backup.importDb` keep their protocol entries and stay
unimplemented. See §8.

## 5. Desktop shell

- `wallet.restore` accepts 12/15/18/21/24 words (currently 12 and 24).
- `wallet.backup` additionally returns `wordCount`, so the reveal screen can lay out
  24 words without counting them itself.
- `wallet.restoreShares` — parse, validate compatibility, recover, build, store.
  Same ordering rule the existing `wallet.restore` follows and for the same reason:
  **never store a secret the build has not proven usable**, or the next launch fails
  silently instead of asking again.
- `backup.shares` — a hidden `BrowserWindow` loaded from a `data:` URL and printed
  through `webContents.print()`. Deliberately a data URL and not a temp file: the
  document contains every share, and a file is a copy of the wallet sitting in a
  predictable path waiting for a crash to orphan it. The window is destroyed in a
  `finally`, print dialog cancelled or not.

## 6. Mobile shell

- same word-count relaxation, same `wordCount` on `wallet.backup`.
- `wallet.restoreShares` → `buildWalletFromMnemonic(recoveredPhrase)`, which already
  persists the phrase behind the biometric gate. The legacy branch calls the existing
  `buildWalletFromRecoveredKey`, untouched.
- `backup.shares` → the print document goes to the OS share sheet. The temp-file
  write and its unconditional cleanup already exist in
  `apps/mobile/src/native/useShareBridge.ts`; that logic moves to
  `apps/mobile/src/native/shareFile.ts` so the wallet bridge can call it without
  duplicating the path-traversal guard or the `finally` that deletes the directory.
- the share-sheet copy says, out loud, that the file holds **all** shares and is to
  be printed and then deleted. Handing three shares to iCloud Drive in one file is
  the failure mode here, and it is a copy problem, not a code problem.

`buildWalletFromRecoveredKey` and the `getRecoveredKey()` resume path stay. A device
that already holds a `recoveredKey` must keep resuming; nothing new writes one except
the explicit legacy import.

## 7. Chrome (`apps/ui`)

- `wallet-gate.tsx`: `wellFormed` accepts 12/15/18/21/24. The create screen says
  *"These 24 words"* — currently hardcoded to 12, which would have been wrong the
  moment §2 landed. A third route, **Restore from backup shares**, collects share
  strings (paste, one per line — the camera path is a separate pass), reports which
  shares are compatible as they arrive, and asks the legacy question when the user
  says the page did not come from Nexus.
- `settings-wallet.tsx`: the Backup group gains **Create printed backup shares**,
  with the threshold stated (any 2 of 3), the "store them apart" instruction, and the
  honest failure for a phrase whose entropy cannot be split (§1).
- `wallet-data.ts`: `restoreFromShares()`, `createBackupShares()`, and `wordCount`
  on the `revealBackup()` result. No share ever enters component state beyond the
  textarea the user pasted it into, and that clears on submit — the same rule the
  phrase textarea already follows.

## 8. Deliberately out of scope

- **`backup.exportDb` / `backup.importDb`.** The ledger is the only copy of
  transaction history a local-only wallet has (`docs/DECISIONS.md` §3), so it does
  need a backup story — but it is a native file-dialog feature on two shells plus a
  destructive replace-and-rebuild, and it shares nothing with BRC-157 except the word
  "backup". Its own pass.
- **BIP-39 passphrase.** BRC-157 defaults to the empty passphrase and Nexus has never
  offered one. Adding it would mean a phrase that recovers nothing without a second
  secret nobody wrote down, and shares that silently recover a *different* wallet
  than the same words plus a passphrase. If it is ever added, the passphrase becomes
  part of the backup artifact and the print page has to say so.
- **Profiles UI.** `profileKeyFromEntropy` ships and is tested so the derivation is
  settled and additive; nothing renders it.
- **Camera capture of share QR codes.** `scan.qr` exists on mobile and the printed
  page carries QR codes, so this is a small follow-on. Paste is what makes recovery
  possible on both shells at once, so paste is what this pass delivers.
- **BRC-154 backup vault services.** Remote custody of a share is exactly what
  `docs/DECISIONS.md` §3 rules out for v1.

## 9. Tests

`packages/wallet-core/test/` — Node's built-in runner, already wired by the root
`test` script.

`entropy.test.mjs`
- 32-byte entropy → 24 words → entropy, byte-identical; all five lengths
- `generateEntropy` is 32 bytes and passes `validateEntropy` (over many draws)
- zero and `≥ n` rejected, with a reason
- `abandon…about` decodes to sixteen zero bytes and is rejected for splitting
- `rootKeyFromEntropy(entropy)` **equals** `recoverMnemonicWallet(phrase).primaryKey`
  — the compatibility claim in "The load-bearing finding", asserted rather than
  asserted-in-prose
- `primaryKey` is 32 bytes over 400 random draws — the minimal-length trap above
- `trimEntropy` with the word count, and without it via the heuristic, at every
  length; including entropy whose own first byte is zero
- `profileKeyFromEntropy(e, 0)` equals the root key; profiles 1..3 differ from it and
  from each other

`backupShares.test.mjs`
- entropy → shares → entropy, for 2-of-3 and 3-of-5, at 16 and 32 bytes
- any `threshold` subset recovers; `threshold − 1` does not
- shares from different entropy fail `validateShareCompatibility` on the integrity tag
- the full BRC-157 loop: **phrase → entropy → shares → entropy → phrase**, and the
  identity key derived at each end is the same
- legacy shares recover the scalar they were made from and produce a *different*
  identity key than the BRC-157 reading of the same shares — the reason §3 asks the
  user instead of guessing
- the print document contains the word count, the threshold, `BRC-157`, and every
  share exactly once
