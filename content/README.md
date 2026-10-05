# Content

Each system has a folder with three plain-text Markdown files:

```
content/<system>/fact-deck.md        → 🃏 Fact Deck tab   (Part 3 · Volatile Facts Deck)
content/<system>/traps.md            → ⚠️ Traps tab       (Part 2 · System Trap Note)
content/<system>/rapid-revision.md   → ⚡ Rapid Revision tab (Part 1 · Complete Rapid Revision Note)
```

Folders: `neonatology`, `growth-nutrition-genetics`, `cardiology`, `neurology`, `nephrology`, `gi-hepatology`, `hematology-oncology`, `endocrinology`, `immunology-id`, `respiratory`, `picu-emergencies`.

A file that is empty (or only has a `<!-- comment -->`) shows "coming soon". Update a system by replacing its files; review progress is kept for every fact whose question stays the same. If `traps.md` is empty, the Traps tab falls back to the `Trap:` lines in the fact deck.

## fact-deck.md

```markdown
# Section name                      ← groups facts

## Epinephrine                       ← the question / trigger shown on the card
- IV/UVC 0.01–0.03 mg/kg; ET 0.05–0.1 mg/kg; q3–5 min
- Trap: Route determines dose
- Tempting: …
- Decisive clue: …
- Memory cue: …
- Source: Day 1 > Drugs

## Resuscitation — sequence
1. Ventilation
2. Ventilation corrective steps / airway
3. Compressions if HR <60
```

| Line starts with | Shown as |
|---|---|
| `Trap:` | red box |
| `Tempting:` | orange box |
| `Decisive clue:` / `Clue:` | green box |
| `Memory cue:` / `Cue:` | yellow box |
| `1.` `2.` … | numbered steps |
| `[ ]` | tick box |
| `Source:` | 📍 trace-back line |

The card colour and label (Dose, Cutoff, Timing, Formula, Distractor, Emergency steps…) are chosen automatically.

## traps.md

```markdown
# Neonatology — System Trap Note

## Trap 1 — Jensen Grade 3 BPD
- Tempting: CPAP at 36 weeks PMA
- Why it looks right: CPAP is positive-pressure support and feels "severe."
- Decisive clue: Jensen grading is based on support type at 36 wk PMA.
- Correct rule: Grade 3 = invasive MV; CPAP/NIPPV = Grade 2.
- Latest protocol: Jensen 2019 support-based outcome definition.
- In the exam: If invasive MV is present at 36 wk PMA, choose Grade 3 immediately.
- Source: Day 5 > BPD > Error Notebook 1× AMBER
```

*Tempting* and *Why it looks right* are shown first; the other fields stay hidden until **Show the rule** is tapped.

## rapid-revision.md

```markdown
# Big heading
Line right under a big heading = subtitle

## Coloured sub-heading
- bullet (Trap: / Decisive clue: / Memory cue: / 1. / [ ] work here too)
Plain paragraph. **Bold** works.

| Feature | RDS | TTN |          ← normal table, first row = header
|---|---|---|
| CXR | Ground glass | Fissural fluid |

> **LATEST PROTOCOL UPDATE — AHA/AAP 2025**   ← coloured box; colour comes from the title
> Effective ventilation remains the central priority.
> - bullet inside the box
> 1. numbered step inside the box
```

Box colours by title: TRAP / EMERGENCY red · PERSONALIZED / AMBER amber · ALGORITHM / SEQUENCE / BUNDLE purple · LATEST PROTOCOL / UPDATE / guideline names blue · MUST-KNOW / PEARL / dose teal · REFERENCE / RULE / USE grey · anything else green.
