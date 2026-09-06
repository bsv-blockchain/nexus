/**
 * This wallet's addresses on chains that are not BSV.
 *
 * The Exodus model, which is the one people already know: one secret derives a
 * key on every supported chain, so the wallet genuinely holds an Ethereum
 * address and a Solana address rather than borrowing one from a provider when
 * it needs one. That is what makes "get paid in ETH" a thing you can do without
 * a swap in the middle, and it is why the swap flow can fill in its own
 * destination instead of asking you to paste one.
 *
 * These are fixtures. Derived from the wallet's identifier rather than a real
 * key, but derived — the same wallet gets the same Ethereum address every time,
 * two wallets never share one, and each is shaped the way its chain shapes
 * addresses. The shape is what makes them useful: somebody about to send ether
 * checks for `0x`, and the single most alarming thing a receive screen could do
 * is show them something that looks like a bitcoin address.
 *
 * @see lib/swap.ts, which routes on the same network codes
 */

/** Base58 — bitcoin's alphabet, with the characters that misread taken out. */
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BECH32 = "023456789acdefghjklmnpqrstuvwxyz";
const HEX = "0123456789abcdef";

/**
 * A stable stream of numbers from a string.
 *
 * xorshift over an FNV-ish seed. Not cryptography and not pretending to be —
 * what it has to be is deterministic, because an address that changed between
 * renders is an address somebody copies half of.
 */
function stream(seed: string): () => number {
  let state = 2_166_136_261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16_777_619) >>> 0;
  }
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

function draw(seed: string, alphabet: string, length: number): string {
  const next = stream(seed);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[next() % alphabet.length];
  }
  return out;
}

/** Chains whose addresses are 20 bytes of hex behind an `0x`. */
const EVM = new Set([
  "eth",
  "bsc",
  "base",
  "arbitrum",
  "matic",
  "op",
  "avaxc",
  "zksync",
  "strk",
  "lna",
  "manta",
  "ftm",
  "cro",
  "movr",
  "glmr",
]);

/**
 * An address on `network`, shaped as that network shapes them.
 *
 * Anything unrecognised falls back to base58 of a bitcoin-ish length. A wrong
 * shape on an obscure chain is a cosmetic error in a prototype; a *plausible*
 * shape on the wrong chain would be worse, so the fallback is deliberately the
 * most generic thing available rather than a guess at the real format.
 */
export function chainAddress(seed: string, network: string): string {
  const key = `${seed}:${network}`;
  if (EVM.has(network)) return `0x${draw(key, HEX, 40)}`;
  switch (network) {
    case "sol":
      return draw(key, BASE58, 44);
    case "btc":
      return `bc1q${draw(key, BECH32, 38)}`;
    case "bch":
      return `bitcoincash:q${draw(key, BECH32, 41)}`;
    case "bsv":
      return `1${draw(key, BASE58, 33)}`;
    case "doge":
      return `D${draw(key, BASE58, 33)}`;
    case "ltc":
      return `ltc1q${draw(key, BECH32, 38)}`;
    case "trx":
      return `T${draw(key, BASE58, 33)}`;
    case "xrp":
      return `r${draw(key, BASE58, 32)}`;
    case "ada":
      return `addr1${draw(key, BECH32, 53)}`;
    case "xmr":
      return `4${draw(key, BASE58, 94)}`;
    case "dot":
      return `1${draw(key, BASE58, 46)}`;
    case "atom":
      return `cosmos1${draw(key, BECH32, 38)}`;
    case "xlm":
      return `G${draw(key, BASE58, 55)}`;
    case "ton":
      return `UQ${draw(key, BASE58, 46)}`;
    case "near":
      return `${draw(key, HEX, 64)}`;
    case "apt":
    case "sui":
      return `0x${draw(key, HEX, 64)}`;
    case "algo":
      return draw(key, BASE58, 58).toUpperCase();
    default:
      return draw(key, BASE58, 34);
  }
}

/**
 * Chains where the address is not enough on its own.
 *
 * On these the whole exchange shares one address and the second value is what
 * says which account a payment belongs to. Leave it off and the money arrives
 * somewhere real and is not yours — recoverable, usually, by asking somebody
 * nicely, which is not a thing a receive screen should quietly set you up for.
 *
 * Null means the address is the whole answer, which is most chains.
 */
export function memoLabelFor(network: string): string | null {
  switch (network) {
    case "xrp":
      return "Destination tag";
    case "xlm":
    case "atom":
    case "ton":
    case "eos":
    case "bnb":
      return "Memo";
    case "algo":
      return "Note";
    default:
      return null;
  }
}

/** The tag or memo itself — digits, because that is what they are. */
export function chainMemo(seed: string, network: string): string {
  return draw(`${seed}:${network}:memo`, "0123456789", 9);
}
