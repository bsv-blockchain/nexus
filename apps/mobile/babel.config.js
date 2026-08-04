// Metro loads this file directly with Node's require() (it configures the
// bundler, it isn't bundled itself), so it stays CommonJS even though the app
// source above it is ESM/TSX.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 does its work through react-native-worklets, whose Babel plugin
    // rewrites every 'worklet' function so it can run on the UI thread. It MUST be
    // last: it transforms whatever the other plugins leave behind, and running it
    // earlier silently produces animations that never start.
    plugins: ['react-native-worklets/plugin']
  }
}
