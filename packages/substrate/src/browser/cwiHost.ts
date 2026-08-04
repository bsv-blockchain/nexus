/**
 * Shell-side half of the BRC-100 provider.
 *
 * `cwiProvider.ts` installs `window.CWI` in a browsed page and posts
 * `{type:'CWI', isInvocation:true, id, call, args}` envelopes at the shell. This
 * module is what answers them: it validates the method name, forwards the call to
 * the wallet's WalletPermissionsManager, and injects the reply back into the page.
 *
 * Ported from BSV Browser's `app/index.tsx` handleMessage, minus the parts that
 * were entangled with that app's screen stack. Kept transport-free so the desktop
 * shell can reuse it against a WebContentsView.
 */

/** Every call `window.CWI` offers. Anything outside this set is refused. */
export const CWI_METHODS: ReadonlySet<string> = new Set([
  'createAction',
  'signAction',
  'abortAction',
  'listActions',
  'internalizeAction',
  'listOutputs',
  'relinquishOutput',
  'getPublicKey',
  'revealCounterpartyKeyLinkage',
  'revealSpecificKeyLinkage',
  'encrypt',
  'decrypt',
  'createHmac',
  'verifyHmac',
  'createSignature',
  'verifySignature',
  'acquireCertificate',
  'listCertificates',
  'proveCertificate',
  'relinquishCertificate',
  'discoverByIdentityKey',
  'discoverByAttributes',
  'isAuthenticated',
  'waitForAuthentication',
  'getHeight',
  'getHeaderForHeight',
  'getNetwork',
  'getVersion'
])

/**
 * Calls cheap enough to answer inline. dApps fire storms of these on page load;
 * making each one wait a frame adds latency and buys nothing, since they touch no
 * storage and don't contend with chrome animation the way createAction does.
 * (BSV Browser measured this — see its `CWI_NO_YIELD`.)
 */
export const CWI_NO_YIELD: ReadonlySet<string> = new Set([
  // L0 — fixed in-memory answers
  'isAuthenticated',
  'waitForAuthentication',
  'getNetwork',
  'getVersion',
  // L1 — crypto, no storage
  'getPublicKey',
  'createHmac',
  'verifyHmac',
  'createSignature',
  'verifySignature',
  'encrypt',
  'decrypt'
])

export interface CwiInvocation {
  type?: string
  isInvocation?: boolean
  id?: string
  call?: string
  args?: unknown
}

/** The wallet as this module needs it — a WalletPermissionsManager, structurally. */
export type CwiWallet = Record<string, (args: unknown, originator: string) => Promise<unknown>>

export interface CwiHostConfig {
  /** The live wallet, or null when there is none yet. Read per call, never captured. */
  getWallet: () => CwiWallet | null
  /** True while keys are being provisioned — a distinct answer from "no wallet". */
  isBuilding?: () => boolean
  /** Called when a page asks for the wallet and there isn't one, so the shell can offer onboarding. */
  onWalletMissing?: () => void
  /** Yield to in-flight interactions before heavy calls. Omitted = no yield. */
  yieldToInteractions?: () => Promise<void>
}

export interface CwiCallCtx {
  /** BRC-100 originator: the page's bare host, no scheme, no path. */
  origin: string
  /** Inject JavaScript into the exact page that made the call. */
  inject: (js: string) => void
}

/**
 * Wrap a reply in the `MessageEvent` the injected provider is listening for.
 *
 * Double-encoded on purpose: the provider reads `e.data` as a JSON string, so the
 * payload is stringified once for the page and once more to survive being spliced
 * into this script.
 */
export function cwiReplyScript(message: unknown): string {
  return `
    (function() {
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(${JSON.stringify(message)})
      }));
    })();true;
  `
}

/** BRC-100 originator for a URL: bare host, since that is the permission's subject. */
export function originatorForUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    // A tab can hold about:blank or a data: URL before its first real navigation.
    return url.replace(/^[a-z]+:\/\//i, '').split('/')[0] ?? ''
  }
}

/**
 * Build the dispatcher.
 *
 * The returned function reports whether the message was a CWI invocation, so a
 * caller can fall through to its other message handlers when it was not.
 */
export function createCwiHost(config: CwiHostConfig) {
  return async function handleCwi(msg: CwiInvocation, ctx: CwiCallCtx): Promise<boolean> {
    if (!msg || msg.type !== 'CWI' || msg.isInvocation !== true) return false
    const id = msg.id
    const call = msg.call
    if (typeof id !== 'string' || typeof call !== 'string') return false

    const ok = (result: unknown) =>
      ctx.inject(cwiReplyScript({ type: 'CWI', id, isInvocation: false, status: 'ok', result }))
    const fail = (description: string, code = 1) =>
      ctx.inject(cwiReplyScript({ type: 'CWI', id, isInvocation: false, status: 'error', code, description }))

    if (!CWI_METHODS.has(call)) {
      fail(`Unsupported method: ${call}`)
      return true
    }

    const wallet = config.getWallet()
    if (!wallet) {
      // "Still starting up" and "you have no wallet" are different problems and the
      // page can act on the difference — the first is worth retrying, the second is not.
      if (config.isBuilding?.()) fail('Wallet is still initializing')
      else {
        fail('Wallet is not authenticated')
        config.onWalletMissing?.()
      }
      return true
    }

    const fn = wallet[call]
    if (typeof fn !== 'function') {
      fail(`Unsupported method: ${call}`)
      return true
    }

    if (!CWI_NO_YIELD.has(call) && config.yieldToInteractions) {
      await config.yieldToInteractions()
    }

    try {
      const result = await fn.call(wallet, msg.args ?? {}, ctx.origin)
      ok(result)
    } catch (err: unknown) {
      const e = err as { message?: string; code?: number }
      fail(e?.message || 'unknown error', typeof e?.code === 'number' ? e.code : 1)
    }
    return true
  }
}
