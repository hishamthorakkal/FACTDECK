# Volatile Facts Deck · NEET SS Paediatrics

A simple, colourful revision deck for easily forgotten, frequently tested facts (doses, cutoffs, timing windows, classifications, antidotes, distractor pairs…). The deck **shrinks** as you master facts and **grows back** when you forget them.

It works as a website on a computer and as a mobile site on a phone. You can add it to your home screen and it works offline.

## Run

```bash
python -m http.server 5173
```

Open http://localhost:5173. To use it on your phone, put the folder on a free static host (GitHub Pages, Netlify).

## Systems

The home page lists the 11 NEET SS systems (Neonatology, Growth/Development/Nutrition/Genetics-IEM, Cardiology, Neurology, Nephrology, GI/Hepatology, Hematology/Oncology, Endocrinology, Immunology/Rheumatology/ID/Immunization, Respiratory + mapped edge topics, PICU/Emergencies). Each system has its own fact deck. **Review all due** on the home page mixes every system; **Start Review** inside a system covers only that system.

The list of systems is in `seed.js` (`FACTDECK_SYSTEMS`).

## How it works

1. **Start Review**: read the question, say the answer, tap **Show answer**.
2. Tap **😊 I knew it** or **😕 I forgot** (on a phone you can swipe right or left).

| Label | Meaning |
|---|---|
| 🔴 Forgot | you missed it; it comes back first |
| 🟡 Learning | new, or not yet stable (reviewed after 1, 3, 7 days) |
| 🟢 Mastered | known 4 times in a row; leaves the review pile |

## Uploading a .docx

Open a system, tap **Upload fact deck**, and choose that system's Word file laid out like the sample: a section heading, then boxes (table cells) with a heading, `•` bullet lines and an optional `↩` source line. Two-column Question | Answer tables and "bold heading + bullet points" also work. How-to/guide boxes are skipped.

To update a system later, upload its new .docx and choose **Replace with this version**. Facts still in the file keep their progress, facts removed from the file are dropped, and other systems are not touched. **Add to the current deck** keeps everything and only adds new facts. The file is read on your device and nothing is uploaded anywhere.

Coloured highlights: lines starting with `Trap:` are red, `Memory cue:` yellow, `Decisive clue:` green, numbered lines become steps, `☐` lines become tick boxes, and numbers and doses are bold.

Progress is stored in this browser. Use **Save backup** at the bottom of the page to move it to another device (restore it with **Restore backup**).
