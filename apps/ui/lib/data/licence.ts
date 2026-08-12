/**
 * table: licence — the terms this software is granted under, in full.
 *
 * Verbatim from the Open BSV License Version 6 as published with the BSV
 * Blockchain node software. Carried in the app rather than linked to because a
 * licence you have to leave for is a licence nobody reads, and because the terms
 * that apply are the ones shipped with the copy you are running — a page on a
 * server can change after you install.
 *
 * Do not edit the body to fit a layout. It is a legal instrument; the renderer
 * adapts to it. Paragraphs are split into blocks only so it can be laid out,
 * with the wording and order untouched.
 */

export interface LicenceBlock {
  /** `text` reads as prose, `clause` is numbered or lettered and indents,
   *  `notice` is the all-caps disclaimer and is set apart. */
  kind: "text" | "clause" | "notice";
  body: string;
}

export const licence = {
  name: "Open BSV License",
  version: "Version 6",
  /** the form that fits on one line of a footer */
  short: "Open BSV 6",
  /** the canonical copy, for anybody who wants to diff this against it */
  sourceUrl:
    "https://github.com/bsv-blockchain/teranode/blob/main/LICENSE",
  grantor: "BSV Association",
  address: "Alpenstrasse 15, 6300 Zug, Switzerland",
  registration: "CHE-427.008.338",
  blocks: [
    {
      kind: "text",
      body: 'Open BSV License Version 6 – granted by BSV Association, Alpenstrasse 15, 6300 Zug, Switzerland (CHE-427.008.338) ("Licensor"), to you as a user (henceforth "You", "User" or "Licensee").',
    },
    {
      kind: "text",
      body: "For the purposes of this license, the definitions below have the following meanings:",
    },
    {
      kind: "text",
      body: '"Bitcoin Protocol" means the protocol implementation, cryptographic rules, network protocols, and consensus mechanisms in the Bitcoin White Paper as described here https://protocol.bsvblockchain.org.',
    },
    {
      kind: "text",
      body: "\"Bitcoin White Paper\" means the paper entitled 'Bitcoin: A Peer-to-Peer Electronic Cash System' published by 'Satoshi Nakamoto' in October 2008.",
    },
    {
      kind: "text",
      body: '"BSV Blockchain" means:',
    },
    {
      kind: "clause",
      body: '(a) the Bitcoin blockchain containing block height #556767 with the hash "000000000000000001d956714215d96ffc00e0afda4cd0a96c96f8d802b1662b" and that contains the longest honest persistent chain of blocks which has been produced in a manner which is consistent with the rules set forth in the Network Access Rules; and',
    },
    {
      kind: "clause",
      body: "(b) the test blockchains that contain the longest honest persistent chains of blocks which has been produced in a manner which is consistent with the rules set forth in the Network Access Rules.",
    },
    {
      kind: "text",
      body: '"Network Access Rules" or "Rules" means the set of rules regulating the relationship between BSV Association and the nodes on BSV based on the Bitcoin Protocol rules and those set out in the Bitcoin White Paper, and available here https://bsvblockchain.org/network-access-rules.',
    },
    {
      kind: "text",
      body: '"Software" means the software the subject of this license, including any/all intellectual property rights therein and associated documentation files.',
    },
    {
      kind: "text",
      body: "BSV Association grants permission, free of charge and on a non-exclusive basis to any person obtaining a copy of the Software to deal in the Software, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to and conditioned upon the following conditions:",
    },
    {
      kind: "clause",
      body: '1 - The text "© BSV Association", and this license shall be included in all copies or substantial portions of the Software.',
    },
    {
      kind: "clause",
      body: "2 - The Software, and any software that is derived from the Software or parts thereof, may only be used exclusively on the BSV Blockchain.",
    },
    {
      kind: "text",
      body: "For the avoidance of doubt, this license is granted subject to and conditioned upon your compliance with these terms only and is limited to uses on the BSV Blockchain. Any exercise of rights not compliant with these terms including use not for the BSV Blockchain is deemed outside the scope of the license.",
    },
    {
      kind: "notice",
      body: 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES REGARDING ENTITLEMENT, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS THEREOF BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
    },
  ] satisfies LicenceBlock[],
} as const;
