/**
 * USD per BSV, from WhatsOnChain.
 *
 * The desktop shell answered `fiatRate: 0` for every account because main had no
 * exchange-rate service at all, and the chrome rendered that as `$0.00` — a funded
 * wallet reporting itself worthless. This is the missing service.
 *
 * Same endpoint, same cache key and same `{ usdPerBsv, timestamp }` shape as the
 * mobile side (packages/wallet-core/src/services/exchangeRate.ts and
 * apps/mobile/src/wallet/ExchangeRateContext.tsx), so the two shells cannot drift
 * into quoting different prices for the same coin.
 *
 * Deliberately absent: a hardcoded fallback. Mobile has one and it is stale by about
 * 20% — the point of `null` is that the chrome renders an em dash and says the rate is
 * unavailable, which is true, instead of a number that is false.
 */

const ENDPOINT = 'https://api.whatsonchain.com/v1/bsv/main/exchangerate'
// Shared with the mobile cache. Same key, same shape.
const CACHE_KEY = 'cached_exchange_rate'
// Bounded hard: this is awaited on the FIRST call, so it is a ceiling on how long a
// cold launch with no cache can sit before the balance renders.
const TIMEOUT_MS = 4000
const STALE_AFTER_MS = 10 * 60 * 1000

/**
 * The mainnet rate regardless of the selected network, because that is what the
 * number means. Testnet coins have no price; quoting the testnet endpoint's own
 * figure would dress up play money as real money.
 */
export function createExchangeRate({ getItem, setItem }) {
  /** @type {number | null} */
  let usdPerBsv = null
  let fetchedAt = 0
  /** @type {Promise<void> | null} */
  let inFlight = null
  let hydrated = false

  async function hydrate() {
    if (hydrated) return
    hydrated = true
    try {
      const raw = await getItem(CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw)
      const rate = Number(cached?.usdPerBsv)
      if (Number.isFinite(rate) && rate > 0) {
        usdPerBsv = rate
        // Treat the cache as its own age, not as fresh — a rate written last week
        // should be shown while a new one is fetched, not instead of one.
        const at = Date.parse(cached?.timestamp ?? '')
        fetchedAt = Number.isFinite(at) ? at : 0
      }
    } catch (err) {
      console.warn('[exchangeRate] cache read failed:', err?.message ?? err)
    }
  }

  function refresh() {
    if (inFlight) return inFlight
    inFlight = (async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const res = await fetch(ENDPOINT, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const rate = Number(data?.rate)
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('no usable rate in response')
        usdPerBsv = rate
        fetchedAt = Date.now()
        await setItem(CACHE_KEY, JSON.stringify({ usdPerBsv: rate, timestamp: new Date().toISOString() }))
      } catch (err) {
        // Keep whatever we had. A failed refresh must never erase a good rate, and
        // must never throw into a caller that was only asking for a balance.
        console.warn('[exchangeRate] refresh failed:', err?.message ?? err)
      } finally {
        clearTimeout(timer)
        inFlight = null
      }
    })()
    return inFlight
  }

  return {
    /**
     * USD per BSV, or null when no source has ever answered. Never throws.
     *
     * Awaits the network only when there is nothing at all to show; from then on it
     * returns the known rate immediately and refreshes behind the caller.
     */
    async usdPerBsv() {
      await hydrate()
      const stale = Date.now() - fetchedAt > STALE_AFTER_MS
      if (usdPerBsv === null) await refresh()
      else if (stale) void refresh()
      return usdPerBsv
    }
  }
}
