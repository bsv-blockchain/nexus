/**
 * Bundles the exported Nexus UI (assets/ui) into the native app so the shell runs with no
 * network.
 *
 * iOS: a Run Script build phase copies the folder into the built .app's resources. The
 * alternative — adding a blue folder reference to the Xcode project — means synthesising
 * pbxproj entries that Expo's prebuild would regenerate away on every `--clean`. A build
 * phase survives prebuild because the plugin re-adds it, and it copies whatever is on disk
 * at build time rather than whatever was on disk when the project was generated.
 *
 * Android: assets/ are bundled wholesale, so a plain directory copy is enough.
 *
 * Runtime path (see src/config.ts):
 *   iOS      file://<bundle>/ui/index.html   via expo-file-system's bundleDirectory
 *   Android  file:///android_asset/ui/index.html
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

const UI_DIR = 'assets/ui'
const PHASE_NAME = 'Bundle Nexus UI'

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

const withBundledUiIos = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults

    // Idempotent: prebuild may run repeatedly, and a duplicated phase would copy twice.
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {}
    const already = Object.values(phases).some((p) => p && p.name && p.name.includes(PHASE_NAME))
    if (already) return cfg

    project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, null, {
      shellPath: '/bin/sh',
      shellScript: [
        'set -e',
        'SRC="$PROJECT_DIR/../' + UI_DIR + '"',
        'DEST="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/ui"',
        // Fail loudly. A silently missing UI produces an app that launches to a blank
        // WebView, which is far more expensive to diagnose than a failed build.
        'if [ ! -d "$SRC" ]; then echo "error: no UI at $SRC — run: npm run ui:bundle" >&2; exit 1; fi',
        'rm -rf "$DEST"',
        'mkdir -p "$DEST"',
        'cp -R "$SRC/" "$DEST/"',
        'echo "bundled Nexus UI: $(find "$DEST" -type f | wc -l | tr -d \' \') files"'
      ].join('\n')
    })

    return cfg
  })

const withBundledUiAndroid = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, UI_DIR)
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets/ui')
      if (!fs.existsSync(src)) {
        throw new Error(`withBundledUi: no UI at ${src} — run: npm run ui:bundle`)
      }
      copyDir(src, dest)
      return cfg
    }
  ])

module.exports = function withBundledUi(config) {
  return withBundledUiAndroid(withBundledUiIos(config))
}
