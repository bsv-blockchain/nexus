/**
 * table: conversation_notes — the user's private notes on a conversation.
 *
 * Notes are the user's own, so these seeds are written the way a person writes
 * for themselves: what they owe someone, what they are waiting on, the thing
 * they will otherwise have to scroll back through the thread to find. Nothing
 * here is shared, and nothing here is sent.
 *
 * Stored as HTML because that is what the editor reads and writes. Only a few
 * conversations carry one, since a demo where every thread has notes says
 * nothing about what having notes is for.
 */
export const conversationNotes: Record<string, string> = {
  "group-common-source": `
<h2>Before the 28th</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><div><p>Split the Utrecht mapping four ways</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p><strong>Els's leg failed.</strong> Retry once she confirms the handle, do not resend quietly</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>Clickable draft of the shared ledger, rough is fine</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>Annex draft 5 back to Els with the incentive wording countersigned</p></div></li>
</ul>
<h2>What each of them actually needs</h2>
<ul>
  <li><p>Sanne — off the spreadsheet and off her phone. Settles the weekly runs herself now, capped, for a month.</p></li>
  <li><p>Wouter — evidence to walk into the national gathering with, not a slide.</p></li>
  <li><p>Els — Horizon money follows systems change, not another pilot. Say it in those words.</p></li>
</ul>
<blockquote><p>Value flows to the growers and connectors who create it.</p></blockquote>
<p>Els's line. It is the annex in one sentence, so lead with it.</p>
`.trim(),

  "group-mycelia-brixit": `
<h2>Field day, the 14th</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><div><p>Checked Marcel's key before the samples went out</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>Readings back Thursday — ask for the signed acknowledgment on the batch</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>Confirm the refractometers and the two crates from the Wednesday harvest</p></div></li>
</ul>
<h2>The number on the shelf</h2>
<p>Three seconds and one number. Everything else has to hang off a trace link.</p>
<ul>
  <li><p>Brix alone moves with variety and time of day, so it never ships on its own.</p></li>
  <li><p><strong>Sample count next to the score.</strong> One reading and forty readings cannot look the same.</p></li>
  <li><p>Forty farms, weekly, same protocol, same meters.</p></li>
</ul>
<p>Marcel's distinction, worth keeping: the attestation is arithmetic, the vouch is an opinion, and only one of them is checkable.</p>
`.trim(),

  "group-handcash-rails": `
<h2>Caps</h2>
<p>Say this precisely to Nadia's team, because the difference is the whole design:</p>
<ul>
  <li><p><strong>Per-action</strong> caps are enforced by the counterparty.</p></li>
  <li><p><strong>Cumulative</strong> caps generally are not, unless someone is keeping the running total.</p></li>
</ul>
<p>Ten thousand actions is ten thousand caps. Lin has read it that way and is right to.</p>
<h2>Open</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><div><p>Samir's merchants want the boring end: a receipt they can point at. Tell them plainly that receipts are voluntary and silence proves nothing.</p></div></li>
  <li data-type="taskItem" data-checked="true"><div><p>Rotated the first certificate out, second stays live</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>End Samir's handoff when I am back</p></div></li>
</ul>
`.trim(),

  "dm-tc-kuro": `
<p>Kuro's toll is set and he knows it is obnoxious. It also cut his spam to nothing, which is the argument.</p>
<p>Numbers come straight off the block explorers, no aggregator. Worth reusing.</p>
`.trim(),
};
