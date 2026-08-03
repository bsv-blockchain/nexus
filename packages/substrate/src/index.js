'use strict'

const protocol = require('./protocol')
const { createProvider } = require('./provider')
const { buildSubstrateScript } = require('./injected')
const { createSubstrateHost } = require('./host')

module.exports = {
  ...protocol,
  createProvider,
  buildSubstrateScript,
  createSubstrateHost
}
