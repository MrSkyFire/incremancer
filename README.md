# Incremancer (Unified Fork)

Idle Necromancer Game — a unified fork combining features from CirusDane's and FrAmed46's mods.

<!-- Pages deployment trigger: 2026-08-11 -->

## Fork History

**Chalice12** (original) -> **CirusDane** (community features) -> **This fork** (merged with FrAmed46's balance tweaks)

## Features

### From CirusDane's Fork
- Chaos gear tier with unique random stats
- Gear sets (save/swap equipment loadouts)
- Spell icons on items
- Item filters (by type, rarity, spell effect)
- Shift-click to destroy items
- Auto max harpies
- Prestige rank bonus (super-scaling beyond rank 60)

### From FrAmed46's Fork
- Ring and armband equipment slots
- Softer skeleton leveling curve (800 * L^1.9 instead of 1000 * L^2)
- +25% base loot drop chance with tiered level-scaling bonuses
- Improved rarity upgrade rates (rare 25%, legendary 12.5%, divine 12.5%)
- Better equipment destruction XP formula
- Reduced prestige upgrade cost scaling (1.225x instead of 1.25x)
- Lower talent point costs (base 95, 1.17x scaling)
- Master of Death max rank increased to 8
- 33% bigger fence
- Shiny talent: 4% loot improvement per level
- Higher enemy health scaling at levels 999+

## Save Compatibility

This fork can import saves from all three fork lineages:
- **CirusDane** saves: XP is recalculated to match the new formula. All features preserved.
- **FrAmed46** saves: Formulas match. Gear sets and chaos items initialized as empty.
- **Chalice12** (original) saves: XP recalculated, modern features initialized.

## Credits

- **Chalice12** — Original Incremancer
- **CirusDane** — Danemancer mod (chaos gear, gear sets, spell icons, QoL)
- **FrAmed46** — Balance tweaks fork (ring/armband, XP curve, loot rates)
