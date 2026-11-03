import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRoom, buildingId, findRooms, suggestions, sqlLiteral, findFacilities } from '../src/search.mjs';
const rooms = JSON.parse(readFileSync(new URL('../public/data/room_lookup.json', import.meta.url), 'utf8'));
const facilities = JSON.parse(readFileSync(new URL('../public/data/facilities.json', import.meta.url), 'utf8'));

test('facility names and abbreviations route to sourced buildings', () => {
  for (const [input, id] of [['Mensa', 'Gebaeude_M'], ['Rechenzentrum', 'Gebaeude_11'], ['rz', 'Gebaeude_11'], ['Bib', 'Gebaeude_5'], ['IT-Support','Gebaeude_11'],['Mensa Buedesheim','Gebaeude_M'], ['Kantine','Gebaeude_M']]) {
    const result = findFacilities(input, facilities);
    assert.equal(result.length, 1);
    assert.equal(result[0].campus_id, id);
  }
});
test('partial facility names work without routing arbitrary or numeric input', () => {
  assert.equal(findFacilities('Rechen', facilities)[0]?.id, 'rechenzentrum');
  assert.deepEqual(findFacilities('1-203', facilities), []);
  assert.deepEqual(findFacilities('xyz-unbekannt', facilities), []);
  assert.deepEqual(findFacilities('r', facilities), []);
});

test('real room labels, aliases, letters and dots map to correct buildings', () => {
  for (const [input, id] of [['Raum L1–203', 'Gebaeude_1'], ['1-203', 'Gebaeude_1'], ['8-0.02', 'Gebaeude_8'], ['2-137a', 'Gebaeude_2']]) {
    assert.equal(findRooms(input, rooms)[0]?.campus_id, id);
  }
});
test('unknown rooms, city-site rooms and nonphysical labels are not invented', () => {
  for (const input of ['1-999', 'digital', 'Exkursion', '0-107']) assert.deepEqual(findRooms(input, rooms), []);
});
test('building names normalize without mistaking room IDs for buildings', () => {
  assert.equal(buildingId('Gebäude 8'), 'Gebaeude_8');
  assert.equal(buildingId('Gebaeude_8'), 'Gebaeude_8');
  assert.equal(buildingId('1-203'), null);
});
test('building 11 remains marked for review', () => {
  assert.equal(findRooms('L11-109', rooms)[0].mapping_status, 'needs_review');
});
test('exact IDs win over aliases; ambiguous aliases do not route', () => {
  const entries = [{room_id:'A',aliases:['X']}, {room_id:'X',aliases:['A']}, {room_id:'B',aliases:['Y']}, {room_id:'C',aliases:['Y']}];
  assert.equal(findRooms('X', entries)[0].room_id, 'X');
  assert.deepEqual(findRooms('Y', entries), []);
});
test('normalization preserves meaningful suffixes and suggestions are limited', () => {
  assert.equal(normalizeRoom(' Raum 8–0.02 '), '8-0.02');
  assert.ok(suggestions('L1', rooms).length <= 6);
  assert.equal(sqlLiteral("a'b"), "'a''b'");
});

test('photographed building-5 plans preserve room aliases and the Mensa scene ID', () => {
  for (const [name, number, id] of [['Mensa','5-102','Gebaeude_M'],['Bibliothek','5-201','Gebaeude_5'],['Empfang','5-131','Gebaeude_5'],['Küche','5-106','Gebaeude_5']]) {
    const named = findRooms(name, rooms)[0];
    const numbered = findRooms(number, rooms)[0];
    assert.equal(named?.room_id, number);
    assert.equal(numbered?.campus_id, id);
    assert.equal(named, numbered);
  }
  for (const query of ['Mensa','Kantine','5-102','R5-102','L5-102']) {
    assert.equal(findFacilities(query, facilities)[0]?.campus_id, 'Gebaeude_M');
  }
});
test('plan transcription has unique room IDs and explicit floors without inventing missing numbers', () => {
  const building = rooms.filter(room => room.building_number === 5);
  assert.equal(building.length,68);
  assert.equal(new Set(rooms.map(room => room.room_id)).size, rooms.length);
  for (const [number,floor] of [['5-148',0],['5-243',1],['5-344',2],['5-533',2]]) {
    assert.equal(findRooms(number, rooms)[0]?.floor, floor);
  }
  assert.equal(findRooms('5-204',rooms).length,0);
  assert.equal(findRooms('R5-331',rooms)[0]?.room_id,'5-331');
});
