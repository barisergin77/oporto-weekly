/**
 * latinEventName (lib/event-identity.ts), backlog #48: mixed-script names keep the Latin title.
 *   npm run test:latin-name
 */
import assert from 'node:assert/strict';
import { latinEventName } from '../lib/event-identity';

const cases: Array<[string, string]> = [
  ['السّيرة الهلاليّة [A Epopeia de Banī Hilāl]', 'A Epopeia de Banī Hilāl'],
  ['A Epopeia de Banī Hilāl (السّيرة الهلاليّة)', 'A Epopeia de Banī Hilāl'],
  ['Bashar Murkus – السّيرة الهلاليّة', 'Bashar Murkus'],
  ['שלום Shalom Quartet', 'Shalom Quartet'],
  ['السّيرة الهلاليّة', 'السّيرة الهلاليّة'], // no Latin part: unchanged
  ['Coldplay: Music of the Spheres', 'Coldplay: Music of the Spheres'],
  ['Presépio Arautos do Evangelho', 'Presépio Arautos do Evangelho'],
  ['  Fado [ao vivo]  ', 'Fado [ao vivo]'], // Latin-only names untouched, brackets kept
  ['東京 Tokyo Jazz', '東京 Tokyo Jazz'], // CJK renders fine: untouched
];
for (const [input, want] of cases) assert.equal(latinEventName(input), want, input);
console.log(`latin-name: ${cases.length} passed`);
