import json
from pathlib import Path

result = json.loads(Path('themed-special-printing-audit.json').read_text())
path = Path('src/services/printing-policy-v08.ts')
text = path.read_text()
if 'const MARVEL_SPECIALS:' in text or 'const MIDDLE_EARTH_SPECIALS:' in text:
    raise SystemExit('themed special constants already present; refusing duplicate patch')

def render(name, rows):
    lines = [f'const {name}: ExactPrintingSelectorV08[] = [']
    for row in rows:
        oracle = json.dumps(row['name'], ensure_ascii=False)
        set_code = json.dumps(str(row['set']).lower())
        collector = json.dumps(str(row['collectorNumber']))
        lines.append(f'  {{ set: {set_code}, collectorNumber: {collector}, oracleName: {oracle} }},')
    lines.append('];')
    return '\n'.join(lines)

marvel = result['marvel']['specials']
middle = result['middleEarth']['specials']
if len(marvel) < 10:
    raise SystemExit(f'expected a meaningful Marvel SLD audit, found {len(marvel)} exact printings')
if len(middle) < 10:
    raise SystemExit(f'expected a meaningful Middle-earth SLD audit, found {len(middle)} exact printings')

constants = render('MARVEL_SPECIALS', marvel) + '\n\n' + render('MIDDLE_EARTH_SPECIALS', middle) + '\n\n'
marker = 'const PRESETS: PrintingFamilyPresetV08[] = [\n'
if text.count(marker) != 1:
    raise SystemExit('PRESETS marker mismatch')
entries = '''const PRESETS: PrintingFamilyPresetV08[] = [
  {
    id: 'marvel',
    aliases: ['marvel', 'mtg marvel', 'magic marvel', 'marvel super heroes', "marvel's spider-man", 'marvel spider man'],
    setNamePatterns: ['marvel', 'spider man'],
    exactSpecialPrintings: MARVEL_SPECIALS,
  },
  {
    id: 'middle-earth',
    aliases: ['middle earth', 'middle-earth', 'lord of the rings', 'lotr', 'the hobbit', 'hobbit', 'mtg middle earth'],
    setNamePatterns: ['middle earth', 'the hobbit'],
    exactSpecialPrintings: MIDDLE_EARTH_SPECIALS,
  },
'''
text = text.replace(marker, constants + entries, 1)
path.write_text(text)
print(f'Applied test-only themed presets: Marvel specials={len(marvel)}, Middle-earth specials={len(middle)}')
