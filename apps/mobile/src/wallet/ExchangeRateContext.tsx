import { ReactNode, createContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY = 'cached_exchange_rate'
const ENDPOINT = 'https://api.whatsonchain.com/v1/bsv/main/exchangerate'
/**
 * Last resort for the amount CONVERTER only, never for a displayed price.
 *
 * It is a constant in a source file, so it is wrong by however much the price has
 * moved since it was typed — at the time of writing, about 20%. Anything that quotes
 * a value to the user reads `usdPerBsv`, which is null until a real source answers.
 */
const HARDCODED_USD_PER_BSV = 16
const SATS_PER_BSV = 100_000_000
// The rate moves during a session and this provider used to fetch exactly once, at
// mount, so a wallet left open overnight quoted yesterday's price all day.
const REFRESH_MS = 5 * 60 * 1000

interface ExchangeRateState {
  /** Always positive, so the converter can always divide. May be the fallback. */
  satoshisPerUSD: number
  /**
   * USD per BSV as a real source actually answered it, or null if none has.
   *
   * The distinction is the whole point: `satoshisPerUSD` keeps an input field
   * usable, this decides whether the app is entitled to state a dollar value.
   */
  usdPerBsv: number | null
}

const defaultState: ExchangeRateState = {
  satoshisPerUSD: SATS_PER_BSV / HARDCODED_USD_PER_BSV,
  usdPerBsv: null
}

// Create the exchange rate context and provider to use in the amount component
export const ExchangeRateContext = createContext<ExchangeRateState>(defaultState)

export const ExchangeRateContextProvider: React.FC<{
  children: ReactNode
}> = ({ children }) => {
  const [state, setState] = useState<ExchangeRateState>(defaultState)

  useEffect(() => {
    let cancelled = false

    const apply = (usdPerBsv: number): void => {
      if (cancelled) return
      setState({ satoshisPerUSD: SATS_PER_BSV / usdPerBsv, usdPerBsv })
    }

    const init = async () => {
      // Tier 2: Try loading cached rate from AsyncStorage
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY)
        if (cached) {
          const { usdPerBsv } = JSON.parse(cached)
          if (typeof usdPerBsv === 'number' && usdPerBsv > 0) apply(usdPerBsv)
        }
      } catch (error) {
        console.error('Error loading cached exchange rate:', error)
      }

      await fetchRate()
    }

    const fetchRate = async () => {
      // Tier 1: Attempt live fetch from WhatsonChain
      try {
        const response = await fetch(ENDPOINT)
        const data = await response.json()
        const usdPerBsv = data?.rate
        if (typeof usdPerBsv === 'number' && usdPerBsv > 0) {
          apply(usdPerBsv)
          // Cache the successful result
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ usdPerBsv, timestamp: new Date().toISOString() }))
        }
      } catch (error) {
        console.error('Error fetching exchange rate from WhatsonChain:', error)
        // Tier 2/3 already loaded above -- state remains as cached or hardcoded default
      }
    }

    void init()
    const timer = setInterval(() => void fetchRate(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return <ExchangeRateContext.Provider value={state}>{children}</ExchangeRateContext.Provider>
}
