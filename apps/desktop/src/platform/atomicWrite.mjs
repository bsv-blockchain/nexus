/**
 * Atomic file replacement — the shared durability primitive for this folder.
 *
 * Both stores under it hold data whose loss is unrecoverable by the user: the
 * key/value file carries wallet settings and the DB-filename registry (lose it
 * and the wallet cannot find its own database), and the secure file carries the
 * encrypted mnemonic. A plain `writeFile` truncates first, so a crash or a power
 * cut between truncate and the last byte leaves a zero-length or half-written
 * file where a valid one used to be. Writing a sibling temp file and renaming
 * over the target means the target is only ever the old bytes or the new ones.
 */
import { open, rename, unlink } from 'node:fs/promises'
import path from 'node:path'

// Two writes to the same path in the same tick would otherwise pick the same temp
// name and clobber each other's partial output. Callers here serialise their own
// writes, but the primitive should not depend on that.
let seq = 0

/**
 * @param {string} filePath destination
 * @param {string} contents
 * @param {{mode?: number}} [options] mode applies to the temp file, and therefore
 *   to the destination after the rename — pass 0o600 for anything secret. Windows
 *   honours only the read-only bit, so there the ACL inherited from the userData
 *   directory (per-user by default) is what actually restricts access.
 */
export async function writeFileAtomic(filePath, contents, options = {}) {
  const mode = options.mode ?? 0o600
  // Same directory, because rename is only atomic within one filesystem; a temp
  // in os.tmpdir() can land on a different volume and degrade to copy+delete.
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${++seq}.tmp`
  )

  let handle
  try {
    handle = await open(tmpPath, 'w', mode)
    await handle.writeFile(contents, 'utf8')
    // Without the fsync the rename can be durable while the data behind it is
    // still in the page cache, which is exactly the torn write we are avoiding.
    await handle.sync()
  } finally {
    if (handle) await handle.close()
  }

  try {
    // Node's rename maps to MoveFileExW(MOVEFILE_REPLACE_EXISTING) on Windows, so
    // overwriting an existing destination works on all three platforms.
    await rename(tmpPath, filePath)
  } catch (err) {
    // A leftover temp is invisible to readers (nothing ever opens `.tmp`), but it
    // would accumulate one file per failed write.
    await unlink(tmpPath).catch(() => {})
    throw err
  }

  // The directory entry itself is only guaranteed durable after an fsync on the
  // directory. Node cannot open a directory for writing on Windows, so this is
  // deliberately skipped rather than done on POSIX only — a durability guarantee
  // that holds on two platforms out of three is worse than a documented gap.
}
