import { readMorning, toCsv, dayLabel, itemBySku } from "./read.js";
import { morning } from "./samples.js";
import { items, customers, unitNames } from "./catalogue.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const icon = (name) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
};
const wide = window.matchMedia("(min-width: 960px)");
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let messages = morning.map((m) => ({ ...m }));
let overrides = {};
let openId = null;
let open = null;
let ownCount = 0;

const channelLabel = (m) => (m.kind === "note" ? "handwritten note" : m.kind === "transcript" ? "voicemail" : m.channel === "SMS" ? "text" : m.channel);
const received = (m) => `${dayLabel(m.received.slice(0, 10))}, ${m.received.slice(11, 16)}`;
const qtyText = (v, code) => (code === "cs" ? `${v} ${v === 1 ? "case" : "cases"}` : code === "lb" ? `${v} lb` : `${v} each`);

function heldRank(l) {
  if (!l.item && l.candidates.length > 1 && l.kind === "item") return 0 - l.candidates.length / 10;
  if (l.item && !l.unit) return 1;
  if (l.kind === "unknown") return 2;
  if (l.kind === "sub") return 3;
  if (l.kind === "usual") return 4;
  return 5;
}

function shortReason(l) {
  if (l.kind === "usual") return "Points at a past order";
  if (l.kind === "sub") return "Substitution, needs a rep";
  if (l.kind === "unknown") return "Not in the catalogue";
  const parts = [];
  if (!l.item && l.candidates.length) parts.push(`Could be ${l.candidates.length} items`);
  if (l.item && !l.unit) parts.push(`Unit unclear: ${Object.keys(itemBySku(l.item.sku).units).map((c) => unitNames[c]).join(" or ")}?`);
  else if (!l.item && !l.unit && l.qty) parts.push("unit unclear");
  if (l.unread) parts.push(`not read: ${l.unread.join(" ")}`);
  if (!l.date) parts.push("no delivery day");
  if (!l.customer) parts.push("customer not found");
  if (!l.qty) parts.push("no quantity");
  const s = parts.join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : l.reasons[0] || "Held";
}

/** The source text with this line's words underlined. */
function marked(text, marks) {
  const p = el("p", "src-text");
  const sorted = marks.filter(Boolean).sort((a, b) => a.start - b.start);
  let at = 0;
  for (const m of sorted) {
    if (m.start < at) continue;
    p.append(text.slice(at, m.start), el("span", `u ${m.kind}`, text.slice(m.start, m.end)));
    at = m.end;
  }
  p.append(text.slice(at));
  return p;
}

function marksFor(l) {
  const who = l.customer && l.customer.via === "words" ? { start: l.customer.start, end: l.customer.end, kind: "pass" } : null;
  if (l.kind !== "item") return [{ start: l.start, end: l.end, kind: "none" }, l.date && { ...l.date, kind: "pass" }, who];
  const out = [];
  if (l.item) out.push({ start: l.item.start, end: l.item.end, kind: l.item.picked ? "none" : "pass" });
  else if (l.itemWords || l.family) out.push({ ...(l.itemWords || l.family), kind: "none" });
  if (l.qty) out.push({ start: l.qty.start, end: l.qty.end, kind: "pass" });
  if (l.unit && l.unit.end) out.push({ start: l.unit.start, end: l.unit.end, kind: "pass" });
  if (l.unitWords) out.push({ start: l.unitWords.start, end: l.unitWords.end, kind: "none" });
  if (l.date) out.push({ start: l.date.start, end: l.date.end, kind: "pass" });
  if (l.customer && l.customer.via === "words") out.push({ start: l.customer.start, end: l.customer.end, kind: "pass" });
  return out;
}

function field(label, value, from, found = true) {
  const row = el("div", "f");
  row.append(el("dt", null, label));
  const dd = el("dd");
  const v = el("div", found ? "v" : "v st-none");
  if (!found) v.append(icon("none"));
  if (Array.isArray(value)) v.append(...value);
  else v.append(value);
  dd.append(v);
  if (from) dd.append(from);
  row.append(dd);
  return row;
}
const fromWords = (lead, words, tail) => {
  const f = el("div", "from");
  if (lead) f.append(`${lead} `);
  f.append(el("q", null, words));
  if (tail) f.append(tail);
  return f;
};
const fromText = (t) => el("div", "from", t);

function source(box, l, m) {
  const text = m.text;
  box.append(el("p", "ev-h", "From the message"));
  box.append(el("p", "src-h", `${m.kind === "note" ? "WhatsApp photo" : m.kind === "transcript" ? "Voicemail" : m.channel} from ${m.from}, ${received(m)}`));
  const src = el("div", m.kind === "note" ? "note" : "bubble");
  src.append(marked(text, marksFor(l)));
  box.append(src);
  if (m.kind === "note") box.append(el("p", "src-foot", "A handwritten note, typed out from the photo for this sample. This page does not read images."));
  if (m.kind === "transcript") box.append(el("p", "src-foot", "A voicemail transcript, typed for this sample. This page does not transcribe audio."));
}

function detail(l, m) {
  const text = m.text;
  const box = el("div", "evidence");
  const ok = l.status === "ready";
  box.append(el("p", "side-h", `${l.customer ? l.customer.name : "Unknown sender"}, ${channelLabel(m)}`));
  const title = el("p", `side-title ${ok ? "st-pass" : "st-none"}`);
  title.append(icon(ok ? "check" : "none"), ok ? "Ready to enter" : "Held for a rep");
  box.append(title);

  if (!ok) {
    const ul = el("ul", "reasons");
    for (const r of l.reasons) {
      const li = el("li");
      li.append(icon("none"), el("span", null, r));
      ul.append(li);
    }
    box.append(ul);
    source(box, l, m);
    const pickBox = picks(l);
    if (pickBox) box.append(pickBox);
  }

  // The order line, field by field, each with where it came from.
  box.append(el("p", "ev-h", "Order line"));
  const dl = el("dl", "fields");
  const c = l.customer;
  dl.append(c
    ? field("Customer", [c.name, el("span", "sku", c.account)], c.via === "phone" ? fromText(`Sender's number ${c.from}, on file`) : fromWords("Named in the message:", text.slice(c.start, c.end), ". The number is not on file."))
    : field("Customer", "Not found", fromText(`${m.from} is not on file and no customer is named.`), false));

  if (l.kind === "usual" || l.kind === "sub") {
    dl.append(field("Item", "Not entered", fromWords(null, l.words), false));
    if (l.subTo) dl.append(field("Would swap in", [itemBySku(l.subTo.sku).name, el("span", "sku", l.subTo.sku)], fromText("Only after a rep confirms.")));
  } else if (l.item) {
    const words = text.slice(l.item.start, l.item.end);
    const from = l.item.picked ? fromWords("Picked by a rep for", words) : fromWords(null, words, l.item.alias && words.toLowerCase() !== l.item.alias ? `, catalogue shorthand "${l.item.alias}"` : "");
    dl.append(field("Item", [l.item.name, el("span", "sku", l.item.sku)], from));
  } else if (l.kind === "unknown") {
    dl.append(field("Item", "Not found", fromWords(null, l.unknownWords || l.words, " is not in the catalogue"), false));
  } else {
    const w = l.itemWords || l.family;
    dl.append(field("Item", "Not picked", fromWords(null, text.slice(w.start, w.end), ` matches ${l.candidates.length} items`), false));
  }

  if (l.kind === "item" || l.kind === "unknown") {
    dl.append(l.qty ? field("Quantity", String(l.qty.value), fromWords(null, text.slice(l.qty.start, l.qty.end), l.qty.dozens ? " dozen, 12 each" : "")) : field("Quantity", "Not found", null, false));
    const it = l.item ? itemBySku(l.item.sku) : null;
    if (l.unit) {
      const pack = it?.units[l.unit.code];
      const from = l.unit.picked ? fromText("Picked by a rep") : l.unit.fromCatalogue ? fromText(`The catalogue: sold only by the ${unitNames[l.unit.code] === "each" ? "piece" : unitNames[l.unit.code]}`) : fromWords(null, text.slice(l.unit.start, l.unit.end));
      dl.append(field("Unit", [unitNames[l.unit.code], el("span", "sku", pack || "")], from));
    } else {
      dl.append(field("Unit", "Not found", it ? fromText(`Sold by ${Object.entries(it.units).map(([k, v]) => `${unitNames[k]} (${v})`).join(" or ")}`) : null, false));
    }
  }
  dl.append(l.date
    ? field("Delivery", l.date.label, fromWords(null, text.slice(l.date.start, l.date.end), `, message came in ${received(m)}`))
    : field("Delivery", "Not found", fromText(l.dateReason || ""), false));
  box.append(dl);

  if (ok) {
    const line = el("p", "ok-line st-pass");
    line.append(icon("check"), el("span", null, `Goes into the import as ${qtyText(l.qty.value, l.unit.code)} of ${l.item.sku} for ${l.customer.account}, delivery ${l.date.label}.`));
    box.append(line);
  }

  if (ok) source(box, l, m);
  return box;
}

function picks(l) {
  const it = l.item ? itemBySku(l.item.sku) : null;
  let opts = null;
  let label = "";
  if (l.kind === "item" && !l.item && l.candidates.length) {
    label = "Pick the item";
    opts = l.candidates.map((sku) => {
      const c = itemBySku(sku);
      return { main: c.name, sub: `${sku}, sold by ${Object.keys(c.units).map((k) => unitNames[k]).join(" or ")}`, set: { sku } };
    });
  } else if (it && !l.unit && Object.keys(it.units).length > 1) {
    label = "Pick the unit";
    opts = Object.entries(it.units).map(([code, pack]) => ({ main: l.qty ? qtyText(l.qty.value, code) : unitNames[code], sub: pack, set: { unit: code } }));
  }
  if (!opts) return null;
  const wrap = el("div", "pick-wrap");
  wrap.append(el("p", "ev-h", label));
  const list = el("div", "picks");
  for (const o of opts) {
    const b = el("button", "pick");
    b.type = "button";
    const t = el("span");
    t.append(el("span", "pn", o.main), el("span", "ps", o.sub));
    b.append(t, el("span", "go", "Use"));
    b.addEventListener("click", () => {
      overrides = { ...overrides, [l.id]: { ...(overrides[l.id] || {}), ...o.set } };
      openId = l.id;
      render({ scroll: true });
    });
    list.append(b);
  }
  wrap.append(list, el("p", "pick-note", "A rep's pick is marked as a pick, not as something the message said."));
  return wrap;
}

function rowItem(l, m) {
  const li = el("div", "row-item");
  const btn = el("button", "row");
  btn.type = "button";
  btn.setAttribute("aria-expanded", "false");
  const ok = l.status === "ready";
  const st = el("span", `status ${ok ? "st-pass" : "st-none"}`);
  st.append(icon(ok ? "check" : "none"), ok ? "Ready" : "Held");
  const val = el("span", "val");
  const who = `${l.customer ? l.customer.name : "Unknown sender"}, ${channelLabel(m)}`;
  if (ok) {
    val.append(el("b", null, l.item.name), el("span", "meta", `${qtyText(l.qty.value, l.unit.code)}, ${l.customer.name}, ${l.date.label}`));
  } else {
    val.append(el("b", "q", `“${l.words}”`), el("span", "meta st-none", shortReason(l)), el("span", "meta", who));
  }
  const chev = icon("chev");
  chev.classList.add("chev");
  btn.append(st, val, chev);
  const entry = { id: l.id, li, btn, render: () => detail(l, m) };
  btn.addEventListener("click", () => {
    const same = open && open.id === l.id;
    closeOpen();
    if (!same) show(entry);
  });
  li.append(btn);
  li._entry = entry;
  return li;
}

function closeOpen() {
  if (!open) return;
  open.btn.setAttribute("aria-expanded", "false");
  open.li.querySelector(".evidence")?.remove();
  open = null;
  openId = null;
  $("side").replaceChildren();
}

function show(entry, animate = true) {
  const box = entry.render();
  if (animate) box.classList.add("enter");
  entry.btn.setAttribute("aria-expanded", "true");
  if (wide.matches) $("side").replaceChildren(box);
  else entry.li.append(box);
  open = entry;
  openId = entry.id;
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("drawn")));
}

wide.addEventListener("change", () => {
  if (!open) return;
  const entry = open;
  closeOpen();
  show(entry, false);
});

let result = null;
function render({ fresh = false, scroll = false } = {}) {
  const keep = openId;
  closeOpen();
  result = readMorning(messages, overrides);
  const byMsg = Object.fromEntries(messages.map((m) => [m.id, m]));
  const sum = $("summary");
  sum.replaceChildren(el("span", "sum-main", `${result.ready} of ${result.total} lines ready`));
  if (result.held) {
    const side = el("span", "sum-side");
    side.append(icon("none"), `${result.held} held for a rep`);
    sum.append(side);
  }

  const held = result.lines.filter((l) => l.status === "held").sort((a, b) => heldRank(a) - heldRank(b));
  const ready = result.lines.filter((l) => l.status === "ready");
  const groups = [];
  const entries = {};
  for (const [title, list] of [["Held for a rep, with the reason", held], ["Ready to enter", ready]]) {
    if (!list.length) continue;
    const rows = el("div", "rows");
    for (const l of list) {
      const li = rowItem(l, byMsg[l.msgId]);
      entries[l.id] = li;
      rows.append(li);
    }
    if (fresh) rows.classList.add("fresh");
    const g = el("section", "group");
    g.append(el("h2", "group-h", title), rows);
    groups.push(g);
  }
  $("groups").replaceChildren(...groups);
  $("csv").disabled = !result.ready;

  const target = (keep && entries[keep]) || entries[held[0]?.id] || entries[ready[0]?.id];
  if (target) {
    show(target._entry, false);
    if (scroll) target.scrollIntoView({ block: "start", behavior: calm() ? "auto" : "smooth" });
  }
}

// Download the ready lines as a generic ERP import.
$("csv").addEventListener("click", () => {
  const blob = new Blob([toCsv(result)], { type: "text/csv" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = "order-import-sample.csv";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// The sample catalogue, behind a tap.
function catalogue() {
  const t = el("table");
  const cap = el("caption", null, `Sample catalogue, ${items.length} items. Shorthand is what restaurants write; generic words like "salmon" or "maguro" are never picked for them.`);
  const head = el("tr");
  for (const h of ["SKU", "Item", "Sold by", "Shorthand"]) head.append(el("th", null, h));
  const tb = el("tbody");
  for (const it of items) {
    const tr = el("tr");
    tr.append(el("td", "sku", it.sku), el("td", null, it.name), el("td", null, Object.entries(it.units).map(([k, v]) => `${unitNames[k]} (${v})`).join(", ")), el("td", "al", it.aliases.join(", ")));
    tb.append(tr);
  }
  const th = el("thead");
  th.append(head);
  t.append(cap, th, tb);
  return t;
}
$("cat-btn").addEventListener("click", () => {
  const c = $("cat");
  if (!c.firstChild) c.append(catalogue());
  c.hidden = !c.hidden;
  $("cat-btn").setAttribute("aria-expanded", String(!c.hidden));
  $("cat-btn").textContent = c.hidden ? "Show the catalogue" : "Hide the catalogue";
});
$("why-btn").addEventListener("click", () => {
  const t = $("why");
  t.hidden = !t.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!t.hidden));
});

// Your own message.
const sel = $("own-from");
for (const c of customers) {
  const o = el("option", null, `${c.name} (${c.phones[0]})`);
  o.value = c.phones[0];
  sel.append(o);
}
const unknown = el("option", null, "A number not on file (+1 415 555 0100)");
unknown.value = "+1 415 555 0100";
sel.append(unknown);
sel.value = customers[2].phones[0];

$("own-read").addEventListener("click", () => {
  const text = $("own-text").value.trim();
  const err = $("own-error");
  if (!text) {
    err.textContent = "Write an order first.";
    err.hidden = false;
    return;
  }
  ownCount += 1;
  const msg = { id: `own${ownCount}`, channel: "WhatsApp", from: sel.value, received: "2026-11-17T07:30", kind: "text", text };
  const probe = readMorning([msg]);
  if (!probe.lines.length) {
    err.textContent = "Nothing in that reads as an order line: no catalogue item and no quantity.";
    err.hidden = false;
    ownCount -= 1;
    return;
  }
  err.hidden = true;
  messages = [...messages, msg];
  openId = probe.lines[0].id;
  render({ fresh: true, scroll: true });
});
$("own-reset").addEventListener("click", () => {
  messages = morning.map((m) => ({ ...m }));
  overrides = {};
  openId = null;
  $("own-error").hidden = true;
  render({ fresh: true, scroll: true });
});

render();
