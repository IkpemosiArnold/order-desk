// Sample data: one morning's orders to a made-up seafood distributor.
// Written for this demo. The voicemail is a typed transcript and the note is
// typed out from a photo; this page does not transcribe audio or read images.

export const morning = [
  {
    id: "nori",
    channel: "WhatsApp",
    from: "+1 415 555 0117",
    received: "2026-11-17T05:48",
    kind: "text",
    text: "Morning! For tomorrow pls:\n2 hamachi loins\nyf saku 6 lb\nmaguro 5 lb\nuni 3 trays\nthx",
  },
  {
    id: "olas",
    channel: "WhatsApp",
    from: "+1 510 555 0162",
    received: "2026-11-17T06:05",
    kind: "text",
    text: "Hola, para mañana por favor: 10 lb de camarón 16/20, 2 cajas de calamar y 15 lb de pescado blanco. Gracias",
  },
  {
    id: "marlowe",
    channel: "SMS",
    from: "+1 415 555 0134",
    received: "2026-11-17T06:21",
    kind: "text",
    text: "4 cs kumos, 2 cs PEI mussels, 10# manila clams for tmrw. And the usual for Sat",
  },
  {
    id: "fenwick",
    channel: "Voicemail",
    from: "+1 415 555 0199",
    received: "2026-11-16T22:10",
    kind: "transcript",
    text: "Hi, this is Dana at Bistro Fenwick. Could we get a case of the skin-on salmon, twelve pounds of halibut, and if you don't have halibut, sub cod. Oh, and six branzino. That's for Thursday. Thanks.",
  },
  {
    id: "pearl",
    channel: "WhatsApp photo",
    from: "+1 415 555 0193",
    received: "2026-11-17T06:40",
    kind: "note",
    text: "PACIFIC PEARL\nThu delivery\nSalmon x 3\nSquid 2 cs\nU10 scallops 10 lb\nDungeness 20\nSpot prawns 5 lb\n- Mr Lau",
  },
  {
    id: "harbor",
    channel: "WhatsApp",
    from: "+1 650 555 0125",
    received: "2026-11-17T07:02",
    kind: "text",
    text: "Hey! Can we do 3 cs sockeye portions, 15 lb black cod and 2 bags PEI mussels for Wed? Ty",
  },
];
