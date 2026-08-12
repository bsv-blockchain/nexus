import { app } from 'electron'
import electronUpdater from 'electron-updater'
import log from 'electron-log'

const { autoUpdater } = electronUpdater

/**
 * Keeping the desktop app on the latest release.
 *
 * One channel, no opt-in: whatever the newest published GitHub release is, that
 * is what a running Nexus converges on. Beta rings and staged rollouts are a
 * later conversation; this is the version of the feature that has to work first.
 *
 * ── WHAT A RELEASE HAS TO DO FOR THIS TO WORK ──
 *
 * electron-builder writes `latest.yml` / `latest-mac.yml` / `latest-linux.yml`
 * beside the installers, each naming an artifact and its sha512. electron-updater
 * fetches that file, downloads what it names, hashes it, and refuses the update
 * if the two disagree. Three consequences, all of them load-bearing:
 *
 *   1. Those .yml files must be attached to the release. They are artifacts of
 *      the build like any other.
 *   2. Nothing may rewrite an installer after electron-builder has hashed it.
 *      Windows signing therefore runs inside the build (build/win-sign.cjs), not
 *      as a later step. bsv-desktop shipped the other arrangement twice and had
 *      to repair published metadata to unbreak clients.
 *   3. A DRAFT release is invisible here. electron-updater reads the newest
 *      PUBLISHED release, so cutting a tag does not ship an update — publishing
 *      the draft does. That is the intended gate, not an obstacle.
 *
 * ── WHERE IT RUNS ──
 *
 * macOS and Windows always. Linux only from an AppImage: a .deb is owned by the
 * system package manager and electron-updater cannot replace it, so on deb the
 * updater never starts and the chrome offers a link to the release instead.
 * Saying "up to date" to somebody we are not checking for would be worse than
 * saying nothing.
 *
 * ── ONE COSMETIC WART ──
 *
 * The packaged app-update.yml carries `updaterCacheDirName: '@nexusdesktop-updater'`,
 * derived from the package name `@nexus/desktop` the same way userData was before
 * main.mjs started calling `app.setName('Nexus')`. Setting it in the publish block
 * does not take — electron-builder computes it — so the download cache sits under an
 * ugly directory. It is a cache path and nothing reads it by name, so this is
 * recorded rather than fought.
 */

/** How long after launch the first check runs. */
const FIRST_CHECK_MS = 10_000
/** And how often after that. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Why this install cannot auto-update, or null when it can.
 *
 * Returned to the chrome rather than kept here, because "there is no update" and
 * "nobody is looking for one" are different sentences and the About panel says
 * which.
 */
function unsupportedReason() {
  if (!app.isPackaged) return 'dev'
  // Set by the AppImage runtime itself. Its absence on Linux means a deb, an
  // unpacked directory, or a distro package — none of which we can replace.
  if (process.platform === 'linux' && !process.env.APPIMAGE) return 'linux-package'
  return null
}

export function createUpdater({ onEvent }) {
  const reason = unsupportedReason()

  /**
   * Everything the About panel draws, in one object.
   *
   * Held here rather than assembled in the chrome because a renderer that
   * reloads — which ours does on every dev save — would otherwise lose the fact
   * that an update had already downloaded, and offer to fetch it again.
   */
  let state = {
    supported: reason === null,
    reason,
    checking: false,
    /** the version on offer, once one is known */
    available: null,
    downloading: false,
    percent: 0,
    /** downloaded and waiting for a restart */
    ready: false,
    error: null,
    lastCheckedAt: null,
    currentVersion: app.getVersion()
  }

  const publish = (patch) => {
    state = { ...state, ...patch }
    onEvent?.(state)
  }

  let timer = null

  function start() {
    if (reason) {
      log.info(`[update] not starting: ${reason}`)
      return
    }

    autoUpdater.logger = log
    log.transports.file.level = 'info'

    /*
     * Download without asking, install on the user's word.
     *
     * The product decision is that people are kept current, so waiting for a
     * click before fetching would leave the slowest users the least protected.
     * Applying it is still theirs: `quitAndInstall` restarts the app, and doing
     * that under somebody mid-payment would be its own kind of wrong.
     *
     * autoInstallOnAppQuit stays ON so a normal quit also applies what has
     * already been fetched — that is what makes "kept up to date" true for
     * somebody who never reads the About panel. bsv-desktop turns this off
     * because it calls quitAndInstall manually and saw the two paths overlap;
     * ours calls it too, so if a double-invocation ever shows up on Windows this
     * flag is the first thing to try.
     */
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    if (process.platform === 'win32') {
      /*
       * Differential downloads compute a delta against the installed version and
       * are a documented source of checksum failures on Windows; the web
       * installer variant fetches a stub that then downloads again. Both trade a
       * smaller download for a class of failure that presents to the user as an
       * update that simply never applies. nsis.differentialPackage is false in
       * package.json for the same reason — this is the runtime half of it.
       */
      autoUpdater.disableDifferentialDownload = true
      autoUpdater.disableWebInstaller = true
    }

    autoUpdater.on('checking-for-update', () => publish({ checking: true, error: null }))

    autoUpdater.on('update-available', (info) => {
      log.info(`[update] available: ${info.version}`)
      publish({
        checking: false,
        available: info.version,
        lastCheckedAt: new Date().toISOString()
      })
    })

    autoUpdater.on('update-not-available', () => {
      publish({
        checking: false,
        available: null,
        lastCheckedAt: new Date().toISOString()
      })
    })

    autoUpdater.on('download-progress', (p) => {
      publish({ downloading: true, percent: Math.round(p.percent ?? 0) })
    })

    autoUpdater.on('update-downloaded', (info) => {
      log.info(`[update] downloaded: ${info.version}`)
      publish({ downloading: false, percent: 100, ready: true, available: info.version })
    })

    autoUpdater.on('error', (err) => {
      // Not fatal and not hidden. A failed check is the normal outcome of being
      // offline, and the About panel says so rather than pretending it is current.
      log.warn(`[update] ${err?.message ?? err}`)
      publish({ checking: false, downloading: false, error: err?.message ?? String(err) })
    })

    const check = () => {
      autoUpdater.checkForUpdates().catch((err) => {
        publish({ checking: false, error: err?.message ?? String(err) })
      })
    }

    // Deferred, for the reason the Monitor's start is deferred: launch is the
    // most contended moment this process has, and an update can wait ten seconds.
    setTimeout(check, FIRST_CHECK_MS)
    timer = setInterval(check, CHECK_INTERVAL_MS)
  }

  return {
    start,

    /** The About panel's whole model. */
    get: () => state,

    /** A person pressed Check now. */
    async check() {
      if (reason) return state
      publish({ checking: true, error: null })
      try {
        await autoUpdater.checkForUpdates()
      } catch (err) {
        publish({ checking: false, error: err?.message ?? String(err) })
      }
      return state
    },

    /**
     * Restart into the new version.
     *
     * The listener removal is macOS-specific folklore that is nonetheless real:
     * a 'window-all-closed' handler that calls app.quit() races the relaunch and
     * leaves the user with no app at all. Deferred by a tick so this IPC call can
     * return before the process goes away.
     */
    install() {
      if (!state.ready) return
      setImmediate(() => {
        app.removeAllListeners('window-all-closed')
        app.removeAllListeners('before-quit')
        autoUpdater.quitAndInstall(false, true)
      })
    },

    stop() {
      if (timer) clearInterval(timer)
      timer = null
    }
  }
}
