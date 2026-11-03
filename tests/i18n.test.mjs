import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messages, languages, setLanguage, getLanguage, t, localizeText } from '../src/i18n.mjs';
import { findFacilities, findRooms, buildingId } from '../src/search.mjs';
const rooms = JSON.parse(readFileSync(new URL('../public/data/room_lookup.json',import.meta.url),'utf8'));
const facilities = JSON.parse(readFileSync(new URL('../public/data/facilities.json',import.meta.url),'utf8'));

test('all supported languages contain the same messages and preserve placeholders', () => {
  const keys = Object.keys(messages.de).sort();
  for (const language of languages) {
    assert.deepEqual(Object.keys(messages[language]).sort(),keys);
    for (const key of keys) {
      const value=messages[language][key];
      assert.ok(value.trim());
      assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(key.match(/\{\w+\}/g)||[]).sort());
      assert.doesNotMatch(value,/Ã|â€/);
    }
  }
});
test('language changes format live messages while leaving building and room IDs untouched', () => {
  setLanguage('en');
  assert.equal(t('Raum {room}',{room:'5-102'}),'Room 5-102');
  assert.equal(localizeText('Gebäude 5'),'Building 5');
  assert.equal(localizeText('Gebaeude_M'),'Gebaeude_M');
  setLanguage('fr');
  assert.equal(t('Raum {room}',{room:'5-102'}),'Salle 5-102');
  assert.equal(localizeText('Gebäude 5'),'Bâtiment 5');
  assert.equal(setLanguage('unknown'),false);
  assert.equal(getLanguage(),'fr');
  setLanguage('de');
});
test('English and French searches route to the same published building IDs', () => {
  for(const input of ['Cafeteria','Cafétéria','Canteen']) assert.equal(findFacilities(input,facilities)[0]?.campus_id,'Gebaeude_M');
  for(const input of ['Library','Bibliothèque','Bibliotheque']) assert.equal(findFacilities(input,facilities)[0]?.campus_id,'Gebaeude_5');
  assert.equal(findFacilities('Centre informatique',facilities)[0]?.campus_id,'Gebaeude_11');
  for(const input of ['Room 5-102','Salle 5-102','Raum 5-102']) assert.equal(findRooms(input,rooms)[0]?.campus_id,'Gebaeude_M');
  assert.equal(buildingId('Bâtiment 5'),'Gebaeude_5');
});
