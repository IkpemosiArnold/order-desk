// Order Desk core. Plain functions, no DOM, no model.
//
// A restaurant message comes in. This turns it into order lines: customer,
// item from the catalogue, quantity, unit and delivery date. Every field keeps
// the character span of the words it came from, or says where else it came
// from (the sender's number, the catalogue). A line is "ready" only when all
// five fields are found. Anything unclear is held for a person with a reason,
// and nothing is guessed: "salmon" alone is not turned into one of five salmon.

import { items, families, customers, unitNames } from "./catalogue.js";

const bySku = Object.fromEntries(items.map((i) => [i.sku, i]));
export const itemBySku = (sku) => bySku[sku] || null;

/** Lower case, accents off, same length as the input, so offsets line up. */
export function norm(s) {
  let out = "";
  for (const ch of String(s)) {
    let c = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (ch === "’" || ch === "‘") c = "'";
    if (c.length !== ch.length) c = ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
    out += c;
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (phrase) => new RegExp(`(?<![a-z0-9])${esc(norm(phrase)).replace(/(?:\\-|\s)+/g, "[\\s-]+")}(?:e?s)?(?![a-z0-9])`, "g");

const ALIASES = items.flatMap((it) => it.aliases.map((a) => ({ sku: it.sku, alias: a, re: wordRe(a) })));
const FAMILY = families.flatMap((f) => f.words.map((w) => ({ family: f, word: w, re: wordRe(w) })));

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20 };
const ARTICLES = { a: 1, an: 1, un: 1, una: 1 };
const NUM_RE = new RegExp(`(?<![a-wyz0-9/.])(\\d+(?:\\.\\d+)?)(?![a-z0-9/]|\\.\\d)|(?<![a-z])(${[...Object.keys(NUM_WORDS), ...Object.keys(ARTICLES)].join("|")})(?![a-z])`, "g");
const DOZEN = ["dozen", "dozens", "doz", "dz", "docena", "docenas"];
const UNIT_WORDS = { lb: ["lb", "lbs", "pound", "pounds", "libra", "libras"], cs: ["cs", "case", "cases", "caja", "cajas", "cx", "ctn", "ctns", "carton", "cartons"], ea: ["ea", "each", "pc", "pcs", "piece", "pieces", "pieza", "piezas"] };

const DAYS = [
  ["sunday", "sun", "domingo"],
  ["monday", "mon", "lunes"],
  ["tuesday", "tue", "tues", "martes"],
  ["wednesday", "wed", "miercoles"],
  ["thursday", "thu", "thur", "thurs", "jueves"],
  ["friday", "fri", "viernes"],
  ["saturday", "sat", "sabado"],
];
const REL = { today: 0, tonight: 0, hoy: 0, tomorrow: 1, tmrw: 1, tmr: 1, tmrow: 1, tomorow: 1, tomorro: 1, manana: 1 };
const DATE_RE = new RegExp(`(?<![a-z])(${[...Object.keys(REL), ...DAYS.flat()].join("|")})(?![a-z])`, "g");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const USUAL_RE = /(?<![a-z])(the usual|usual order|same as (?:last|usual|always)[a-z ]*|lo de siempre|lo mismo de siempre)(?![a-z])/g;
const SUB_RE = /(?<![a-z])(?:if|si)\s[^.,;\n]*?(?:don't have|dont have|do not have|no hay|no tienen|out of|run out|no)\s[^.,;\n]*?,?\s*(?:sub|substitute|swap(?: for)?|send|use|manda|mandame)\s+[^.,;\n]+|(?<![a-z])(?:sub|substitute)\s+[^.,;\n]+/g;
const SPLIT_RE = /[,;:+]|(?<![a-z])(?:and|plus|also|y)(?![a-z])/g;

// Words that carry no order detail. Anything else left over in a line holds it.
const FILLER = new Set("a an and the of de del for para por pls plz please thx thanks ty gracias hi hey hello hola morning can could we i you get do have need want like would some also just oh x on at delivery el la los las un una y favor".split(" "));

/** A date as Wed 18 Nov, from an ISO day. */
export function dayLabel(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Delivery-date words in [s, e), resolved against the day the message came in. */
export function datesIn(N, s, e, receivedDay) {
  const out = [];
  DATE_RE.lastIndex = 0;
  const part = N.slice(s, e);
  for (const m of part.matchAll(DATE_RE)) {
    const w = m[1];
    const start = s + m.index;
    // "por la mañana" is "in the morning", not tomorrow.
    if (w === "manana" && /\b(la|de la|esta)\s$/.test(N.slice(Math.max(0, start - 7), start))) continue;
    // "same as last Friday" points back at an order. It is not a delivery day.
    if (/(?:last|past|previous)\s+$/.test(N.slice(Math.max(0, start - 10), start))) continue;
    // "sun" and "sat" only count as days when they read like one.
    if ((w === "sun" || w === "sat" || w === "mon") && !/(?:for|on|by|del|delivery|para|el)\s+$/i.test(N.slice(Math.max(0, start - 10), start)) && !/^\s*(?:del|delivery)/.test(N.slice(start + w.length))) continue;
    let iso = null;
    let unclear = false;
    if (w in REL) iso = addDays(receivedDay, REL[w]);
    else {
      const target = DAYS.findIndex((d) => d.includes(w));
      const today = new Date(`${receivedDay}T00:00:00Z`).getUTCDay();
      const ahead = (target - today + 7) % 7;
      if (ahead === 0) unclear = true;
      else iso = addDays(receivedDay, ahead);
    }
    out.push({ iso, unclear, start, end: start + w.length });
  }
  return out;
}

/** Sentences: split on line breaks and on . ! ? followed by a space. */
function sentences(text) {
  const out = [];
  let at = 0;
  const re = /\n|[.!?]+(?=\s|$)/g;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ start: at, end: m.index });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ start: at, end: text.length });
  return out;
}

const trimSpan = (text, s, e) => {
  while (s < e && /[\s\-–!?.]/.test(text[s])) s++;
  while (e > s && /[\s\-–!?.]/.test(text[e - 1])) e--;
  return { start: s, end: e };
};
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function findCustomer(msg, N) {
  const digits = (p) => String(p).replace(/\D/g, "");
  const byPhone = customers.find((c) => c.phones.some((p) => digits(p) === digits(msg.from)));
  if (byPhone) return { account: byPhone.account, name: byPhone.name, via: "phone", from: msg.from };
  for (const c of customers) {
    const re = wordRe(c.name);
    const m = re.exec(N);
    if (m) return { account: c.account, name: c.name, via: "words", start: m.index, end: m.index + m[0].length };
  }
  return null;
}

function itemMatches(N, s, e) {
  const part = N.slice(s, e);
  const specific = [];
  for (const a of ALIASES) {
    a.re.lastIndex = 0;
    for (const m of part.matchAll(a.re)) specific.push({ sku: a.sku, alias: a.alias, start: s + m.index, end: s + m.index + m[0].length });
  }
  specific.sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.start - y.start);
  const kept = [];
  for (const m of specific) if (!kept.some((k) => overlaps(k, m))) kept.push(m);
  const fams = [];
  for (const f of FAMILY) {
    f.re.lastIndex = 0;
    for (const m of part.matchAll(f.re)) {
      const span = { family: f.family, word: f.word, start: s + m.index, end: s + m.index + m[0].length };
      if (!kept.some((k) => overlaps(k, span))) fams.push(span);
    }
  }
  fams.sort((x, y) => (y.end - y.start) - (x.end - x.start));
  return { specific: kept, family: fams[0] || null };
}

function unitWordAt(N, pos, item) {
  const rest = N.slice(pos);
  if (/^#/.test(rest)) return { code: "lb", start: pos, end: pos + 1 };
  const lists = [];
  if (item?.unitWords) for (const [code, ws] of Object.entries(item.unitWords)) lists.push([code, ws]);
  for (const [code, ws] of Object.entries(UNIT_WORDS)) lists.push([code, ws]);
  if (item?.units.ea) lists.push(["ea", DOZEN]);
  for (const [code, ws] of lists) {
    for (const w of [...ws].sort((a, b) => b.length - a.length)) {
      const m = new RegExp(`^\\s*(?:of\\s+|de\\s+)?(${esc(w)})(?![a-z])`).exec(rest);
      if (m) {
        const start = pos + m[0].length - m[1].length;
        return { code, start, end: start + m[1].length, word: m[1], times: DOZEN.includes(m[1]) ? 12 : 1 };
      }
    }
  }
  return null;
}

function unitWordsIn(N, s, e, item, masks) {
  const found = [];
  for (let i = s; i < e; i++) {
    if (i > s && /[a-z#]/.test(N[i - 1]) && N[i] !== "#") continue;
    if (masks.some((m) => i >= m.start && i < m.end)) continue;
    const u = unitWordAt(N, i, item);
    if (u && u.start === i && u.end <= e) found.push(u);
  }
  return found;
}

function quantity(N, s, e, item, masks) {
  const nums = [];
  for (const m of N.slice(s, e).matchAll(NUM_RE)) {
    const start = s + m.index;
    const tok = m[1] || m[2];
    const span = { start, end: start + tok.length };
    if (masks.some((k) => overlaps(k, span))) continue;
    const article = !m[1] && tok in ARTICLES;
    const value = m[1] ? Number(m[1]) : article ? ARTICLES[tok] : NUM_WORDS[tok];
    const unit = unitWordAt(N, span.end, item);
    const unitOk = unit && unit.end <= e && !masks.some((k) => overlaps(k, unit));
    if (article && !unitOk) continue;
    nums.push({ value, ...span, unit: unitOk ? unit : null });
  }
  return nums;
}

/**
 * Read one message into order lines.
 * @param {object} msg {id, channel, from, received "YYYY-MM-DDTHH:MM", kind, text}
 * @param {object} [overrides] {[lineId]: {sku?, unit?}} picks a rep made
 */
export function readMessage(msg, overrides = {}) {
  const text = String(msg?.text || "");
  const N = norm(text);
  const receivedDay = String(msg?.received || "").slice(0, 10);
  const customer = findCustomer(msg || {}, N);
  const sents = sentences(text);

  const sentDates = sents.map((st) => datesIn(N, st.start, st.end, receivedDay));
  const allDates = sentDates.flat().filter((d) => d.iso);
  const distinct = [...new Set(allDates.map((d) => d.iso))];

  const lines = [];
  for (let si = 0; si < sents.length; si++) {
    const st = sents[si];
    const dates = sentDates[si];
    const dateMasks = dates.map((d) => ({ start: d.start, end: d.end }));
    let date = null;
    let dateReason = null;
    const own = [...new Set(dates.filter((d) => d.iso).map((d) => d.iso))];
    if (dates.some((d) => d.unclear)) {
      const d = dates.find((x) => x.unclear);
      dateReason = `"${text.slice(d.start, d.end)}" is the day the message came in, so it could mean today or next week.`;
    } else if (own.length === 1) {
      const d = dates.find((x) => x.iso);
      date = { iso: d.iso, label: dayLabel(d.iso), start: d.start, end: d.end };
    } else if (own.length > 1) dateReason = "This sentence names two delivery days.";
    else if (distinct.length === 1) {
      const d = allDates[0];
      date = { iso: d.iso, label: dayLabel(d.iso), start: d.start, end: d.end };
    } else if (distinct.length > 1) dateReason = "No delivery day in this sentence, and the message names more than one.";
    else dateReason = "No delivery day in the message.";

    const base = (kind, span) => ({
      id: `${msg.id}:${span.start}`, msgId: msg.id, kind,
      start: span.start, end: span.end, words: text.slice(span.start, span.end),
      customer, item: null, candidates: [], family: null, qty: null, unit: null,
      date, dateReason, reasons: [], status: "held",
    });

    // Standing orders and substitutions are taken out first and always held.
    const special = [];
    const sN = N.slice(st.start, st.end);
    for (const m of sN.matchAll(USUAL_RE)) special.push({ kind: "usual", start: st.start + m.index, end: st.start + m.index + m[0].length });
    for (const m of sN.matchAll(SUB_RE)) {
      const sp = trimSpan(text, st.start + m.index, st.start + m.index + m[0].length);
      if (!special.some((x) => overlaps(x, sp))) special.push({ kind: "sub", ...sp });
    }
    for (const sp of special) {
      const l = base(sp.kind, sp);
      if (sp.kind === "usual") {
        l.reasons.push("Points at a past order. This sample has no order history, so a rep picks the lines.");
      } else {
        const { specific } = itemMatches(N, sp.start, sp.end);
        const swapTo = specific.length ? specific[specific.length - 1] : null;
        l.candidates = swapTo ? [swapTo.sku] : [];
        l.subTo = swapTo;
        l.reasons.push(`A substitution request. A rep checks stock and price before swapping${swapTo ? ` in ${itemBySku(swapTo.sku).name}` : ""}.`);
      }
      if (!date) l.reasons.push(dateReason);
      lines.push(l);
    }

    // The rest of the sentence, split into segments at commas and "and".
    const cuts = [];
    let at = st.start;
    for (const sp of [...special].sort((a, b) => a.start - b.start)) {
      if (sp.start > at) cuts.push({ start: at, end: sp.start });
      at = Math.max(at, sp.end);
    }
    if (at < st.end) cuts.push({ start: at, end: st.end });
    const segs = [];
    for (const c of cuts) {
      let p = c.start;
      for (const m of N.slice(c.start, c.end).matchAll(SPLIT_RE)) {
        segs.push({ start: p, end: c.start + m.index });
        p = c.start + m.index + m[0].length;
      }
      segs.push({ start: p, end: c.end });
    }

    for (const raw of segs) {
      const seg = trimSpan(text, raw.start, raw.end);
      if (seg.end <= seg.start) continue;
      const { specific, family } = itemMatches(N, seg.start, seg.end);
      const main = specific[0] || null;
      const itemSpan = main || family;
      const item = main ? itemBySku(main.sku) : null;
      const masks = [...dateMasks, ...(itemSpan ? [itemSpan] : []), ...specific];
      const nums = quantity(N, seg.start, seg.end, item, masks);
      if (!itemSpan && !nums.length) continue; // greetings, sign-offs, "this is Dana"

      const l = base(itemSpan ? "item" : "unknown", seg);
      const ov = overrides[l.id] || {};

      // Item
      if (main && new Set(specific.map((m) => m.sku)).size > 1 && !ov.sku) {
        l.candidates = [...new Set(specific.map((m) => m.sku))];
        l.itemWords = { start: main.start, end: specific[specific.length - 1].end };
        l.reasons.push(`Names more than one item: ${specific.map((m) => `"${text.slice(m.start, m.end)}"`).join(" and ")}.`);
      } else if (main) {
        l.item = { sku: item.sku, name: item.name, start: main.start, end: main.end, alias: main.alias };
      } else if (family) {
        l.family = family;
        l.candidates = family.family.skus;
        l.itemWords = { start: family.start, end: family.end };
        if (!ov.sku) l.reasons.push(`"${text.slice(family.start, family.end)}" could be ${family.family.skus.length} items in the catalogue. A rep picks which.`);
      }
      if (ov.sku && l.candidates.includes(ov.sku)) {
        const it = itemBySku(ov.sku);
        const w = l.itemWords || l.family;
        l.item = { sku: it.sku, name: it.name, start: w.start, end: w.end, picked: true };
      }

      // Quantity
      const paired = nums.filter((n) => n.unit);
      let q = null;
      if (paired.length === 1 || (paired.length > 1 && paired.every((n) => n.value === paired[0].value))) q = paired[0];
      else if (paired.length > 1) l.reasons.push("More than one quantity in this line.");
      else if (nums.length === 1) q = nums[0];
      else if (nums.length > 1) l.reasons.push(`More than one number in this line: ${nums.map((n) => text.slice(n.start, n.end)).join(", ")}.`);
      else l.reasons.push("No quantity found.");
      if (q) {
        const dozens = q.unit?.times === 12 ? q.value : null;
        l.qty = { value: dozens ? q.value * 12 : q.value, start: q.start, end: q.end, dozens };
        if (!(q.value > 0)) l.reasons.push("The quantity is zero.");
      }

      if (l.kind === "unknown") {
        const words = trimSpan(text, seg.start, seg.end);
        let s = words.start;
        let e = words.end;
        const used = [l.qty, q?.unit].filter(Boolean);
        // Name what was asked for: the segment without its number and unit.
        const rest = text.slice(s, e).split("").map((ch, i) => (used.some((u) => s + i >= u.start && s + i < u.end) ? " " : ch)).join("").replace(/\b(of|de|the|some|pls|please|x)\b/gi, " ").trim().replace(/\s+/g, " ");
        l.unknownWords = rest;
        l.reasons.unshift(rest ? `"${rest}" is not in the catalogue.` : "No item named.");
        l.reasons = l.reasons.filter((r) => r !== "No quantity found." || !rest);
        lines.push(finish(l));
        continue;
      }

      // Unit
      const target = l.item ? itemBySku(l.item.sku) : null;
      const unitsHere = unitWordsIn(N, seg.start, seg.end, target, masks.filter((m) => m !== main && m !== family));
      const u = q?.unit || unitsHere[0] || null;
      if (ov.unit && target && target.units[ov.unit]) {
        l.unit = { code: ov.unit, picked: true };
      } else if (u) {
        if (target && !target.units[u.code]) {
          l.unitWords = u;
          l.reasons.push(`"${text.slice(u.start, u.end)}" means ${unitNames[u.code]}, but this item is sold by ${Object.keys(target.units).map((c) => unitNames[c]).join(" or ")}.`);
        } else l.unit = { code: u.code, start: u.start, end: u.end };
      } else if (target && Object.keys(target.units).length === 1) {
        const code = Object.keys(target.units)[0];
        l.unit = { code, fromCatalogue: true };
      } else if (target) {
        const n = l.qty ? l.qty.value : null;
        const ways = Object.keys(target.units).map((c) => `${n ?? ""} ${c === "cs" && n !== 1 ? "cases" : unitNames[c]}`.trim());
        l.reasons.push(`Unclear unit: ${ways.join(" or ")}? This item is sold both ways.`);
      } else if (l.qty) {
        l.reasons.push("Unclear unit until the item is picked.");
      }

      // Every word has to be used by a field, be in the item's catalogue name, or be filler.
      const used = [itemSpan, ...specific, l.qty, l.unit?.end ? l.unit : null, l.unitWords, ...dateMasks].filter(Boolean);
      const nameWords = target ? norm(target.name).match(/[a-z0-9][a-z0-9/'-]*/g) : [];
      const unread = [];
      for (const m of N.slice(seg.start, seg.end).matchAll(/[a-z0-9][a-z0-9/'&-]*/g)) {
        const w = { start: seg.start + m.index, end: seg.start + m.index + m[0].length };
        if (used.some((u) => overlaps(u, w)) || FILLER.has(m[0]) || nameWords.includes(m[0])) continue;
        unread.push(text.slice(w.start, w.end));
      }
      if (unread.length) {
        l.unread = unread;
        l.reasons.push(`Not read: "${unread.join(" ")}". A rep checks before this goes in.`);
      }

      if (!l.customer) l.reasons.push("Customer not found: the number is not on file and no customer is named.");
      if (!date) l.reasons.push(dateReason);
      lines.push(finish(l));
    }
  }
  lines.sort((a, b) => a.start - b.start);
  return { msg, customer, lines };
}

function finish(l) {
  const ok = l.kind === "item" && l.customer && l.item && l.qty && l.qty.value > 0 && l.unit && l.date && !l.reasons.length;
  l.status = ok ? "ready" : "held";
  return l;
}

/** Read a whole morning. */
export function readMorning(messages, overrides = {}) {
  const read = messages.map((m) => readMessage(m, overrides));
  const lines = read.flatMap((r) => r.lines);
  const ready = lines.filter((l) => l.status === "ready").length;
  return { read, lines, total: lines.length, ready, held: lines.length - ready };
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A generic ERP import file of the ready lines. One row per line. */
export function toCsv(result) {
  const head = ["line_ref", "customer_account", "customer_name", "delivery_date", "sku", "description", "quantity", "unit", "source_channel", "source_words"];
  const rows = [head];
  for (const r of result.read) {
    const ready = r.lines.filter((l) => l.status === "ready");
    ready.forEach((l, i) => {
      rows.push([`${r.msg.id.toUpperCase()}-${r.msg.received.slice(5, 10).replace("-", "")}-${i + 1}`, l.customer.account, l.customer.name, l.date.iso, l.item.sku, l.item.name, l.qty.value, l.unit.code.toUpperCase(), r.msg.channel, l.words]);
    });
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
