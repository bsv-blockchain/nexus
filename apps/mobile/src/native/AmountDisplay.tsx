import React, { ReactNode, useState, useEffect, useContext } from 'react'

import { formatAmount } from '@nexus/wallet-core/src/utils/amountFormatHelpers'
import { ExchangeRateContext } from '../wallet/ExchangeRateContext'
import { useWallet } from '../wallet/WalletContext'

type Props = {
  abbreviate?: boolean
  showPlus?: boolean
  description?: string
  color?: string
  children: ReactNode
  showFiatAsInteger?: boolean
}

/**
 * Shows an amount in the user's preferred currency format.
 *
 * In BSV mode (default): uses smart threshold formatting
 *   - < 1 BSV: displays as satoshis (e.g., "50,000 satoshis")
 *   - >= 1 BSV: displays as BSV (e.g., "1.5 BSV")
 *
 * In USD mode: displays the USD equivalent using the current exchange rate.
 *
 * All formatting is locale-aware (respects device locale for separators).
 *
 * Renders bare text, not a <Text>. Amounts appear inline inside sentences and
 * headings that own their own typography, so wrapping one here would fight every
 * caller's style.
 *
 * @param props.children - The amount in satoshis to display
 */
const AmountDisplay: React.FC<Props> = ({ abbreviate, showPlus, children, showFiatAsInteger }) => {
  // Starts at an ellipsis rather than '0': a real zero balance and a rate that has
  // not arrived yet must not look the same.
  const [formatted, setFormatted] = useState('...')

  const { settings } = useWallet()
  const currency = settings?.currency || 'BSV'

  const { satoshisPerUSD } = useContext(ExchangeRateContext)

  useEffect(() => {
    const numValue = Number(children)
    // Satoshis are integers by definition; anything else is a caller mid-edit or a
    // value still loading, and formatting it would render a fraction of a satoshi.
    if (!Number.isInteger(numValue)) {
      setFormatted('...')
      return
    }

    setFormatted(formatAmount(numValue, currency, satoshisPerUSD, { showPlus, abbreviate, showFiatAsInteger }))
  }, [children, currency, satoshisPerUSD, showPlus, abbreviate, showFiatAsInteger])

  return <>{formatted}</>
}

export default AmountDisplay
