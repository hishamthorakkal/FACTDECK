# Volatile Facts Deck · NEET SS Paediatrics

A simple, colourful revision site for easily forgotten, frequently tested facts (doses, cutoffs, timing windows, classifications, antidotes, distractor pairs…). The deck **shrinks** as you master facts and **grows back** when you forget them.

It works as a website on a computer and as a mobile site on a phone. You can add it to your home screen and it works offline.

## Run

```bash
python -m http.server 5173
```

Open http://localhost:5173. It needs a web server (opening `index.html` directly can't load the content files). To use it on your phone, publish the folder on a free static host (GitHub Pages, Netlify).

## Systems and content

The home page lists the 11 systems (defined in `systems.js`). Each system has three tabs:

- **🃏 Fact Deck**: flashcards from `content/<system>/fact-deck.md`
- **⚠️ Traps**: every `Trap:` / `Tempting:` line in that fact deck (with its decisive clue), collected automatically
- **⚡ Rapid Revision**: notes from `content/<system>/rapid-revision.md` (printable)

Content is plain Markdown. See [content/README.md](content/README.md) for the format. There are no upload or edit buttons on the site: update a system by replacing its file and republishing.

## Games

Each system has a **🎮 Games** tab, built automatically from its content:

- **🪤 Trap Hunter**: 10 traps from `traps.md`. Pick the correct rule over the tempting wrong choice.
- **⏱️ Number Rush**: 60 seconds of fact-deck numbers (doses, cutoffs, timings), 4 choices each, with a combo bonus.
- **🧩 Sequence Builder**: tap the steps of an algorithm in order (numbered steps in the fact deck and in Rapid Revision boxes).

Reviews and games earn XP: knew it +10, forgot +2, mastered +30, Trap Hunter +5 per trap, Number Rush score ÷ 2, Sequence Builder +5 per star. XP raises your level (Intern → Resident → Senior Resident → Fellow → Consultant → Professor). A daily 🔥 streak and 9 badges are shown from the header chip.

## Review

1. **Start Review** (one system) or **Review all due** (every system): read the question, say the answer, tap **Show answer**.
2. Tap **😊 I knew it** or **😕 I forgot** (on a phone you can swipe right or left).

| Label | Meaning |
|---|---|
| 🔴 Forgot | you missed it; it comes back first |
| 🟡 Learning | new, or not yet stable (reviewed after 1, 3, 7 days) |
| 🟢 Mastered | known 4 times in a row; leaves the review pile |

Progress is stored in the browser on each device and is kept when a deck file is updated, as long as the fact's question stays the same.
