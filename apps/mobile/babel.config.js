// Metro loads this file directly with Node's require() (it configures the
// bundler, it isn't bundled itself), so it stays CommonJS even though the app
// source above it is ESM/TSX.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo']
  }
}
