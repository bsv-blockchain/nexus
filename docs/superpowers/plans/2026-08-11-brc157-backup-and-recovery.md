# BRC-157 Backup and Recovery — Implementation Plan

**Goal:** Make entropy the recoverable object. A 32-byte entropy value is both the
BIP-39 sentence and the secp256k1 scalar BRC-140 splits, so a phrase and a set of
backup shares recover the same wallet — which today they do not.

**Architecture:** One new pure module, `packages/wallet-core/src/utils/entropy.ts`,
owns every fact about entropy: generation, range validation, BIP-39 in both
directions (the SDK has no decoder), BRC-157 root and profile derivation, and the
recovery trim. `mnemonicWallet.ts` and `backupShares.ts` are rebased on it.
`packages/bridge` gains one method. Both shells implement `backup.shares` (declared
since day one, never answered) and the new `wallet.restoreShares`, and relax the
word-count gate from 12-or-24 to BIP-39's five lengths. The chrome grows a
share-recovery route and a share-creation row.

**Spec:** `docs/superpowers/specs/2026-08-11-brc157-backup-and-recovery-design.md`

## Global constraints

- **No new npm dependencies.** `qrcode` is already resolvable from the root
  (`react-native-qrcode-svg` depends on it, and `apps/ui` declares it), which is how
  `backupShares.ts` imports it today. Do not add it to a `package.json`: CI runs
  `npm ci` and a declaration without a matching lock entry fails the install.
- **No key material in the chrome.** `backup.shares` returns counts. Three shares are
  the wallet, and the renderer hosts third-party pages.
- **Never persist a secret the build has not proven usable.** Existing rule in both
  shells' restore paths; the share paths follow it.
- **Existing wallets do not migrate.** `rootKeyFromEntropy(entropy)` is byte-identical
  to today's `primaryKey`. Task 1's test asserts this; if it fails, stop.
- Run `npm test` after every task that touches `packages/`, and
  `npm run typecheck` / `npm run typecheck --prefix apps/ui` before finishing.

---

### Task 1: `entropy.ts` and its tests

**Files:** create `packages/wallet-core/src/utils/entropy.ts`,
create `packages/wallet-core/test/entropy.test.mjs`,
modify `packages/wallet-core/src/index.ts` (one export line).

**Produces:** `ENTROPY_BYTES`, `WordCount`, `generateEntropy`, `validateEntropy`,
`padEntropy`, `trimEntropy`, `wordCountForEntropy`, `entropyBytesForWordCount`,
`entropyToMnemonic`, `mnemonicToEntropy`, `rootKeyFromEntropy`,
`profileKeyFromEntropy`.

- [ ] `generateEntropy` via `PrivateKey.fromRandom().toArray('be', 32)` — already a
      uniform scalar in `[1, n−1]`, which is precisely BRC-157's requirement, rather
      than 32 random bytes that could land on zero or above the group order.
- [ ] `validateEntropy` returns `{ valid, reason? }`. Zero rejected explicitly,
      `≥ n` rejected, length `> 32` rejected. A reason, not a bare false — the
      share-generation path puts it in front of the user.
- [ ] `mnemonicToEntropy`: `Mnemonic.fromString` first (wordlist, length and
      checksum), then 11-bit unpacking against `new Mnemonic().Wordlist`, then
      re-verify the checksum against `Hash.sha256(entropy)`.
- [ ] `trimEntropy(bytes32, wordCount?)`: exact when the count is known; otherwise
      `max(16, roundUpToMultipleOf4(32 − leadingZeroBytes))`.
- [ ] Test the equality claim: `rootKeyFromEntropy(mnemonicToEntropy(p)).toHex()`
      equals `recoverMnemonicWallet(p).primaryKey` for phrases at all five lengths.
- [ ] Test `abandon … about` → sixteen zero bytes → `validateEntropy` false.

**Commit:** test and implementation together — the test *is* the compatibility proof
and is meaningless without the module.

---

### Task 2: `mnemonicWallet.ts` on top of entropy

**Files:** modify `packages/wallet-core/src/utils/mnemonicWallet.ts`.

- [ ] `generateMnemonicWallet()` with no phrase: `generateEntropy()` →
      `entropyToMnemonic()`. 24 words.
- [ ] `MnemonicWalletResult` gains `entropy: number[]` and `wordCount: WordCount`.
- [ ] Comment `primaryKey` as BRC-157's root key, stating the equality.
- [ ] Delete `encodeMnemonicForStorage`, `decodeMnemonicFromStorage`,
      `generateRandomMnemonic`. Verify no importers first
      (`grep -rn` across `apps packages`).
- [ ] `npm test`.

---

### Task 3: `backupShares.ts` splits entropy

**Files:** modify `packages/wallet-core/src/utils/backupShares.ts`,
create `packages/wallet-core/test/backupShares.test.mjs`.

- [ ] `generateEntropyShares(entropy, threshold = 2, totalShares = 3)` — validate,
      pad to 32, split. Replaces `generateBackupShares(primaryKeyBytes, …)`, which
      had no callers.
- [ ] `recoverEntropyFromShares(shares, wordCount?)` → `{ entropy, entropy32, wordCount }`,
      using `toArray('be', 32)` so leading zero bytes survive the reconstruction.
- [ ] `recoverKeyFromShares` retained and re-commented as the legacy reader.
- [ ] `generatePrintHTML(shares, identityKey, { wordCount, threshold })` — header
      carries `BRC-157` and the share index, body carries `Recovers a N-word phrase`,
      instructions name Nexus.
- [ ] Tests per spec §9, including the full phrase → shares → phrase loop and the
      legacy-vs-BRC-157 divergence.
- [ ] `npm test`.

---

### Task 4: protocol and client

**Files:** modify `packages/bridge/src/protocol.js`, `packages/bridge/src/client.js`.

- [ ] `WALLET_RESTORE_SHARES: 'wallet.restoreShares'`, with a comment saying why it
      is a separate method rather than an overload of `wallet.restore` (different
      input, different failure modes, and a legacy flag that must not be reachable by
      accident).
- [ ] `client.wallet.restoreShares(shares, opts)` at the 300 000 ms bound restore
      uses; correct the `backup.shares` comment, which describes splitting the
      primary key.

---

### Task 5: desktop shell

**Files:** modify `apps/desktop/src/wallet/host.mjs`,
create `apps/desktop/src/wallet/printDocument.mjs`.

- [ ] Shared word-count validator: 12/15/18/21/24, one message naming all five.
- [ ] `wallet.backup` returns `{ mnemonic, wordCount }`.
- [ ] `wallet.restoreShares` — parse each share, `validateShareCompatibility`,
      recover, build, then store. Refuse when a wallet or a stored phrase already
      exists, exactly as `wallet.create` does.
- [ ] `backup.shares` — read phrase → entropy → validate (refuse with the reason) →
      split → render → print. `printDocument.mjs` owns the hidden `BrowserWindow`,
      the `data:` URL, and a `finally` that destroys the window.
- [ ] `npm run typecheck`.

---

### Task 6: mobile shell

**Files:** create `apps/mobile/src/native/shareFile.ts`,
modify `apps/mobile/src/native/useShareBridge.ts`,
modify `apps/mobile/src/wallet/useWalletBridge.ts`.

- [ ] Extract the temp-dir write / share / unconditional-cleanup path into
      `shareFile.ts`, including `safeName`. `useShareBridge` becomes a thin caller;
      behaviour unchanged.
- [ ] Same word-count validator, same `wordCount` on backup.
- [ ] `wallet.restoreShares` → `buildWalletFromMnemonic(phrase)` for the BRC-157
      path, `buildWalletFromRecoveredKey(wif)` for the legacy one, both settling
      through the existing `settleBuilt()` because those builds swallow their errors.
- [ ] `backup.shares` → render, then `shareFile` with a filename that dates the sheet
      and copy that says the file holds every share.
- [ ] `npm run typecheck`.

---

### Task 7: chrome

**Files:** modify `apps/ui/lib/wallet-data.ts`,
`apps/ui/components/hub/wallet-gate.tsx`,
`apps/ui/components/apps/settings-wallet.tsx`.

- [ ] `wallet-data.ts`: `restoreFromShares(shares, opts)`, `createBackupShares(opts)`,
      `wordCount` on `revealBackup`, and the `NexusHost` type entries for both.
- [ ] `wallet-gate.tsx`: accept the five lengths; create copy says 24; a `shares`
      mode with a textarea (one share per line), a live count of compatible shares,
      and a legacy checkbox whose label names the apps that printed such pages.
- [ ] `settings-wallet.tsx`: **Create printed backup shares** in the Backup group,
      arming once before it commits (the file convention), stating any-2-of-3, and
      rendering the shell's refusal reason verbatim when entropy cannot be split.
- [ ] `npm run typecheck --prefix apps/ui`.

---

### Task 8: verify

- [ ] `npm test` — full suite, not just the new files.
- [ ] `npm run typecheck` and `npm run typecheck --prefix apps/ui`.
- [ ] `npm run check` (injected-source and env drift).
- [ ] `grep` for the deleted exports to confirm no dangling importers.
- [ ] Report the actual command output. No completion claim without it.
