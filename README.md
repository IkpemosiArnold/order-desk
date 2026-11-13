# Order Desk

A restaurant orders from its food distributor by WhatsApp message, text, voicemail or a photo of a note. A person at the distributor then keys every order into the ERP by hand.

This page does that step for one sample morning. It turns six messages into order lines (customer, catalogue item, quantity, unit, delivery day) and links every field to the words it came from. Anything unclear waits for a rep, with the reason.

## The sample

Six made-up restaurants order from a made-up seafood distributor on Tuesday 17 Nov 2026: three WhatsApp messages (one in Spanish), a text, a voicemail transcript and a handwritten note typed out from a photo. The catalogue has 23 items sold by the case, the pound or the piece.

Result: 16 of 23 lines ready, 7 held for a rep:

- "Salmon x 3": salmon could be five items, and 3 of what?
- "maguro 5 lb": three tuna items in the catalogue.
- "15 lb de pescado blanco": "white fish" could be halibut, cod or rockfish.
- "Dungeness 20": sold by the pound and by the crab.
- "Spot prawns 5 lb": not in the catalogue.
- "if you don't have halibut, sub cod": a substitution, so a rep checks stock and price first.
- "the usual": points at a past order, and the sample has no order history.

A rep can pick the item or the unit on the page. The pick is shown as a pick, not as something the message said.

## What ready means

A line is ready only when all five fields are found:

1. **Customer:** the sender's number is on file, or the message names a customer on file.
2. **Item:** the words name exactly one catalogue item, directly or through the catalogue's shorthand ("kumos", "yf saku", "camarón 16/20"). A word that covers several items ("salmon", "maguro") is never narrowed to one.
3. **Quantity:** one number (digits, or words like "twelve" or "a case").
4. **Unit:** written in the message ("cs", "#", "cajas", "trays"), or the item is only sold one way.
5. **Delivery day:** "tomorrow", "mañana", "Thu" and so on, counted from when the message came in. Two different days, or today's weekday, is not guessed.

A line is also held when it has a word the reader could not place, such as a size, a cut or "change my order". The word is shown, so nothing is dropped silently.

Each field keeps the character span of its words, and the page underlines them in the message.

## Where a model would go

The reading here is plain code with a shorthand list, so every rule is visible and testable. A real version would put a model in front to read loose phrasing, other languages and photos, and keep this check behind it: whatever the model proposes still has to point at words in the message, a number on file or a catalogue row, or it is held for a rep.

## Run the tests

```
node --test
```

Needs Node 20 or later. No dependencies.

## Open the page locally

```
python3 -m http.server 8784
```

Then open http://localhost:8784. The page makes no network calls beyond its own files.

## Limits

- It does not read images or audio. The note and the voicemail are typed text, labelled as such on the page.
- The shorthand list is small and hand-written. Real shorthand varies by customer and would be learned from past orders.
- "The usual" is held because there is no order history in the sample.
- The ERP import is a generic CSV of the ready lines, one row per line with a `line_ref`. Every ERP has its own import format, usually one order number with line numbers.
- No prices, stock, cut-off times or credit notes.

## Design

It follows the shared direction for these demos: one result as the largest thing on the page, rows split by hairlines, and an underline that draws under the words each field came from. Inter for the tool, Newsreader for anything quoted from a message, a navy accent, and the handwritten note on a ruled card.

Fonts: Inter and Newsreader (SIL Open Font License), latin subsets in `fonts/`.

## Provenance

Built on 13 Nov 2026 with AI coding agents, directed by Arnold Ikpemosi Adeyemi. Made-up customers, catalogue and messages.

## Licence

MIT. See `LICENSE`.
