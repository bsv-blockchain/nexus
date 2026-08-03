'use strict'

const protocol = require('./protocol')
const { createHostClient } = require('./client')
const { buildChromeBridgeScript } = require('./injected')
const { createHostRouter } = require('./hostRouter')

module.exports = {
  ...protocol,
  createHostClient,
  buildChromeBridgeScript,
  createHostRouter
}
