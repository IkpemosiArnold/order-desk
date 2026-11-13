import { test } from "node:test";
import assert from "node:assert/strict";
import { readMorning, readMessage, toCsv, norm, datesIn } from "./read.js";
import { morning } from "./samples.js";
import { items } from "./catalogue.js";

const r = readMorning(morning);
const line = (msgId, words) => r.lines.find((l) => l.msgId === msgId && l.words.includes(words));
const msgText = (id) => morning.find((m) => m.id === id).text;
const at = (l, f) => msgText(l.msgId).slice(f.start, f.end);

test("the sample morning: 23 lines, 16 ready, 7 held for a rep", () => {
  assert.equal(r.total, 23);
  assert.equal(r.ready, 16);
  assert.equal(r.held, 7);
});

test("every field on a ready line points at the words it came from", () => {
  for (const l of r.lines.filter((x) => x.status === "ready")) {
    const t = msgText(l.msgId);
    for (const f of [l.item, l.qty]) assert.ok(f.start >= l.start && f.end <= l.end && f.end > f.start, `${l.id} inside its line`);
    assert.ok(l.date.start >= 0 && l.date.end <= t.length && l.date.end > l.date.start, `${l.id} date words`);
    assert.ok(l.unit.fromCatalogue || l.unit.end > l.unit.start, `${l.id} unit has words or the catalogue`);
    assert.ok(l.customer.via === "phone" || l.customer.end > l.customer.start, `${l.id} customer`);
    // Quantity words really are the number on the line.
    assert.ok(/\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|\ba\b|an|una?|dos|tres/i.test(at(l, l.qty)), `${l.id} qty words`);
  }
});

test("shorthand and other languages map to one catalogue item, with the words shown", () => {
  const kumos = line("marlowe", "kumos");
  assert.equal(kumos.item.sku, "OYS-KUM");
  assert.equal(at(kumos, kumos.item), "kumos");
  const clams = line("marlowe", "manila");
  assert.deepEqual([clams.qty.value, clams.unit.code, at(clams, clams.unit)], [10, "lb", "#"]);
  const shrimp = line("olas", "camarón");
  assert.equal(shrimp.item.sku, "SHR-W-1620");
  assert.equal(at(shrimp, shrimp.item), "camarón 16/20");
  const squid = line("olas", "cajas");
  assert.deepEqual([squid.qty.value, squid.unit.code, at(squid, squid.unit)], [2, "cs", "cajas"]);
  const salmon = line("fenwick", "skin-on salmon");
  assert.deepEqual([salmon.item.sku, salmon.qty.value, at(salmon, salmon.qty), salmon.unit.code], ["SAL-ATL-SK", 1, "a", "cs"]);
  const halibut = line("fenwick", "twelve");
  assert.deepEqual([halibut.qty.value, halibut.unit.code], [12, "lb"]);
});

test("delivery days come from the words, against the day the message arrived", () => {
  assert.equal(line("nori", "hamachi").date.iso, "2026-11-18");
  assert.equal(at(line("nori", "hamachi"), line("nori", "hamachi").date), "tomorrow");
  assert.equal(line("olas", "cajas").date.iso, "2026-11-18");
  assert.equal(line("marlowe", "kumos").date.iso, "2026-11-18");
  assert.equal(line("marlowe", "the usual").date.iso, "2026-11-21");
  assert.equal(line("fenwick", "branzino").date.iso, "2026-11-19");
  assert.equal(line("pearl", "Squid").date.iso, "2026-11-19");
});

test("a generic word is held with every candidate, not guessed", () => {
  const s = line("pearl", "Salmon x 3");
  assert.equal(s.status, "held");
  assert.equal(s.item, null);
  assert.equal(s.candidates.length, 5);
  assert.match(s.reasons[0], /"Salmon" could be 5 items/);
  assert.equal(line("nori", "maguro").candidates.length, 3);
  assert.match(line("olas", "pescado blanco").reasons[0], /"pescado blanco" could be 3 items/);
});

test("the usual, substitutions, unknown species and unclear units are held with a reason", () => {
  assert.match(line("marlowe", "the usual").reasons[0], /past order/);
  const sub = line("fenwick", "sub cod");
  assert.equal(sub.kind, "sub");
  assert.match(sub.reasons[0], /substitution request.*Pacific cod fillet/);
  assert.match(line("pearl", "Spot prawns").reasons[0], /"Spot prawns" is not in the catalogue/);
  const crab = line("pearl", "Dungeness");
  assert.equal(crab.item.sku, "CRB-DUN");
  assert.equal(crab.unit, null);
  assert.match(crab.reasons[0], /Unclear unit: 20 lb or 20 each/);
});

test("the halibut in the substitution is not ordered twice", () => {
  assert.equal(r.lines.filter((l) => l.msgId === "fenwick" && l.item?.sku === "HAL-PAC-FL").length, 1);
});

test("a rep's pick clears a hold, and the unit is still asked for", () => {
  const id = line("pearl", "Salmon x 3").id;
  const once = readMorning(morning, { [id]: { sku: "SAL-ATL-SK" } }).lines.find((l) => l.id === id);
  assert.equal(once.item.sku, "SAL-ATL-SK");
  assert.ok(once.item.picked);
  assert.equal(once.status, "held");
  assert.match(once.reasons.join(" "), /Unclear unit: 3 cases or 3 lb/);
  const twice = readMorning(morning, { [id]: { sku: "SAL-ATL-SK", unit: "cs" } }).lines.find((l) => l.id === id);
  assert.equal(twice.status, "ready");
  // A pick outside the candidates is ignored.
  const bad = readMorning(morning, { [id]: { sku: "UNI-SB" } }).lines.find((l) => l.id === id);
  assert.equal(bad.item, null);
});

test("customer from the sender's number, or from the words when the number is not on file", () => {
  assert.equal(line("nori", "hamachi").customer.via, "phone");
  const f = line("fenwick", "branzino").customer;
  assert.equal(f.via, "words");
  assert.equal(msgText("fenwick").slice(f.start, f.end), "Bistro Fenwick");
  const unknown = readMessage({ id: "x", from: "+1 999 555 0100", received: "2026-11-17T08:00", text: "2 cs kumos for tmrw" });
  assert.equal(unknown.lines[0].status, "held");
  assert.match(unknown.lines[0].reasons.join(" "), /Customer not found/);
});

test("no day, two days, or the same weekday as today: date not found", () => {
  const none = readMessage({ id: "a", from: "+1 415 555 0117", received: "2026-11-17T08:00", text: "2 cs kumos" });
  assert.equal(none.lines[0].date, null);
  assert.match(none.lines[0].reasons.join(" "), /No delivery day/);
  const two = readMessage({ id: "t", from: "+1 415 555 0117", received: "2026-11-17T08:00", text: "2 cs kumos for tmrw or Thu" });
  assert.match(two.lines[0].reasons.join(" "), /two delivery days/);
  const same = readMessage({ id: "b", from: "+1 415 555 0117", received: "2026-11-17T08:00", text: "2 cs kumos for Tuesday" });
  assert.match(same.lines[0].reasons.join(" "), /today or next week/);
  // "por la mañana" is the morning, not tomorrow.
  assert.equal(datesIn(norm("entrega por la mañana"), 0, 21, "2026-11-17").length, 0);
});

test("a unit the item is not sold in is held", () => {
  const x = readMessage({ id: "c", from: "+1 415 555 0117", received: "2026-11-17T08:00", text: "3 cs uni for tmrw" });
  assert.match(x.lines[0].reasons.join(" "), /"cs" means case, but this item is sold by each/);
});

test("a past order's day is not a delivery day", () => {
  const x = readMessage({ id: "d", from: "+1 415 555 0117", received: "2026-11-17T08:00", text: "The usual from last Friday, and 2 lb halibut" });
  assert.equal(x.lines.length, 2);
  for (const l of x.lines) assert.equal(l.date, null);
  assert.match(x.lines[1].reasons.join(" "), /No delivery day/);
});

test("a word the reader cannot place holds the line", () => {
  const read = (text) => readMessage({ id: "e", from: "+1 415 555 0117", received: "2026-11-17T08:00", text }).lines[0];
  for (const [text, word] of [["5 lb U12 scallops for tmrw", "U12"], ["10 lb halibut cheeks for tmrw", "cheeks"], ["6 lb yellowfin loin for thu", "loin"]]) {
    const l = read(text);
    assert.equal(l.status, "held");
    assert.match(l.reasons.join(" "), new RegExp(`Not read: "${word}"`));
  }
  // The item's own catalogue words, or two of its shorthands together, are fine.
  assert.equal(read("10 lb u10 dry scallops tmrw").status, "ready");
  assert.equal(read("30 lb live dungeness for fri").status, "ready");
});

test("oysters by the dozen become a count, with the words kept", () => {
  const l = readMessage({ id: "f", from: "+1 415 555 0134", received: "2026-11-17T08:00", text: "3 dz kumos tmrw" }).lines[0];
  assert.deepEqual([l.status, l.item.sku, l.qty.value, l.qty.dozens, l.unit.code], ["ready", "OYS-KUM", 36, 3, "ea"]);
  // A dozen of something sold only by the pound is not converted.
  const h = readMessage({ id: "g", from: "+1 415 555 0134", received: "2026-11-17T08:00", text: "2 dz halibut tmrw" }).lines[0];
  assert.equal(h.status, "held");
});

test("seafood words: ahi, oysters, otoro and change requests", () => {
  const read = (text) => readMessage({ id: "h", from: "+1 415 555 0117", received: "2026-11-17T08:00", text }).lines[0];
  const ahi = read("5 lb ahi for tmrw");
  assert.deepEqual([ahi.status, ahi.item.sku, ahi.qty.value, ahi.unit.code], ["ready", "TUN-YF-SAKU", 5, "lb"]);
  const oys = read("5 dozen oysters for tomorrow");
  assert.deepEqual([oys.status, oys.item.sku, oys.qty.value, oys.unit.code], ["ready", "OYS-KUM", 60, "ea"]);
  const otoro = read("5 lb bluefin otoro for tmrw");
  assert.equal(otoro.status, "held");
  assert.match(otoro.reasons.join(" "), /Not read: "otoro"/);
  const u12 = read("5 lb U12 scallops for tmrw");
  assert.notEqual(u12.status, "ready");
  const change = read("change my order to 5 lb halibut for tmrw");
  assert.equal(change.status, "held");
  assert.match(change.reasons.join(" "), /Not read: "change my order to"/);
});

test("the ERP import has the ready lines only, quoted where needed", () => {
  const csv = toCsv(r).trim().split("\n");
  assert.equal(csv.length, 1 + 16);
  assert.match(csv[0], /^line_ref,customer_account,customer_name,delivery_date,sku/);
  assert.ok(csv.some((row) => row.startsWith('NORI-1117-1,C-1042,Nori House,2026-11-18,HAM-LOIN,"Hamachi (yellowtail) loin, farmed",2,EA,')));
  assert.ok(!csv.some((row) => /usual|Spot prawns|Salmon x 3/.test(row)));
});

test("norm keeps offsets", () => {
  for (const s of ["camarón 16/20", "mañana", "don’t", "Taquería"]) assert.equal(norm(s).length, s.length);
});

test("catalogue: unique SKUs, every item has a unit and an alias", () => {
  assert.equal(new Set(items.map((i) => i.sku)).size, items.length);
  for (const i of items) assert.ok(Object.keys(i.units).length && i.aliases.length, i.sku);
});
