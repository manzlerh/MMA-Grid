# Puzzle review checklist

Use this checklist when reviewing a generated **grid** or **connections** puzzle before publishing. Go through it for each puzzle in the admin CLI preview.

---

## Grid puzzles

- [ ] **Cell size** — No cell has fewer than **2 valid fighters**. (Too few makes the cell a guess or a single obvious answer.)
- [ ] **Attribute clarity** — No row/column label is ambiguous to a casual fan. Examples to fix:
  - "Former Champion" → specify weight class or org (e.g. "Former UFC Bantamweight Champion").
  - Vague categories (e.g. "Champion" without context, "Title fights" without clarity).
- [ ] **Fame balance** — Cells have a **balanced spread** of well-known vs. lesser-known fighters. No cell is all superstars or all obscure names; mix helps fairness and fun.
- [ ] **Overlap between adjacent cells** — No two **adjacent cells** share the same small set of "obvious" answers (e.g. the same 5 fighters fitting both). Otherwise players can spam one fighter across both cells.
- [ ] **Solvability** — A casual UFC fan who watches most PPVs can solve the puzzle with the 9 attempts. No cell relies on deep knowledge (e.g. one-off regional events only).

---

## Connections puzzles

- [ ] **Group clarity** — Each group’s label is clear and unambiguous (e.g. not "Former Champion" without saying of what).
- [ ] **No misfits** — No fighter in a group **obviously belongs in another group** (e.g. "Bantamweight Champions" containing someone who was only flyweight champion).
- [ ] **Balanced difficulty** — Mix of easier and harder groups so the puzzle isn’t four gimmes or four stumpers.
- [ ] **Solvability** — Solvable by a casual UFC fan who watches most PPVs. No group that only hardcore historians would get.

---

## Both / overall

- [ ] **Tone** — Puzzle feels fair and fun, not arbitrary or "gotcha."
- [ ] **Final pass** — Play through once yourself (or use preview) and confirm it holds up in practice.

---

## Weekly routine (≈20 min)

1. **Monday morning** — Run the seeder for the coming week.
2. **Admin CLI** — Open the admin CLI and load/preview each generated puzzle.
3. **Checklist** — For each puzzle, go through the relevant section above and tick off each item.
4. **Adjust** — Fix any puzzle that fails a check (regenerate, tweak attributes, or edit manually).
5. **Confirm** — Once all puzzles pass, confirm/schedule and you’re done for the week.
