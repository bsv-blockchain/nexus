/**
 * Transaction export.
 *
 * Ported from BSV Browser's utils/exportTransactions.ts, split at the seam that
 * repo did not need: there, building the CSV and handing it to the OS share sheet
 * were one function. Nexus's chrome is a DOM document that cannot reach
 * expo-sharing, so the pure half lives here and the shell decides what to do with
 * the string. Column order and escaping are unchanged — an exported file from
 * either app must diff clean.
 */
import type { WalletAction, WalletInterface } from '@bsv/sdk'

const PAGE = 200

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Every action, paged out in full. Export means export — there is no "recent" here. */
export async function collectAllActions(
  wallet: WalletInterface,
  adminOriginator: string
): Promise<WalletAction[]> {
  const actions: WalletAction[] = []
  let offset = 0
  let total = Infinity
  while (offset < total) {
    const r = await wallet.listActions(
      { labels: [], includeLabels: true, includeOutputs: true, limit: PAGE, offset },
      adminOriginator
    )
    total = r.totalActions
    if (r.actions.length === 0) break
    actions.push(...r.actions)
    offset += r.actions.length
  }
  return actions
}

/**
 * Columns: txid, satoshis (signed), description, status, blockHeight,
 * tags (semi-colon), labels (semi-colon), outputDescriptions (semi-colon).
 *
 * `heightMap` comes from the storage layer's proven transactions; an action with
 * no proven height exports an empty cell rather than a zero, because zero is a
 * real block height and "not yet proven" is not.
 */
export function buildTransactionsCsv(actions: WalletAction[], heightMap: Map<string, number>): string {
  const header = [
    'txid',
    'satoshis',
    'description',
    'status',
    'blockHeight',
    'tags',
    'labels',
    'outputDescriptions'
  ].join(',')

  const rows = actions.map(a => {
    const sats = a.isOutgoing ? -Math.abs(a.satoshis) : Math.abs(a.satoshis)
    const outputs = a.outputs || []
    const tagsSet = new Set<string>()
    for (const o of outputs) for (const t of (o as any).tags || []) tagsSet.add(t)
    const tags = Array.from(tagsSet).join(';')
    const labels = (a.labels || []).join(';')
    const outDescs = outputs
      .map((o: any) => o.outputDescription)
      .filter((d: string) => d && d.length > 0)
      .join(';')
    const height = heightMap.get(a.txid) ?? ''
    return [
      csvEscape(a.txid),
      csvEscape(sats),
      csvEscape(a.description),
      csvEscape(a.status),
      csvEscape(height),
      csvEscape(tags),
      csvEscape(labels),
      csvEscape(outDescs)
    ].join(',')
  })

  return [header, ...rows].join('\n') + '\n'
}

/** `bsv-transactions-<unix seconds>.csv`, same name the source app shared. */
export function exportFileName(nowSeconds: number = Math.floor(Date.now() / 1000)): string {
  return `bsv-transactions-${nowSeconds}.csv`
}
