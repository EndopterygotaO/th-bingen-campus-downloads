export function normalizeRoom(value) {
  return value.trim().replace(/^(?:raum|room|salle)\s*/i, '').replace(/[–—−]/g, '-')
    .replace(/\s+/g, '').toUpperCase();
}

export function buildingId(input) {
  const match = input.trim().match(/^(?:gebäude|gebaeude|geb\.?|building|bâtiment|batiment)[\s_-]*(\d+)$/i);
  return match ? `Gebaeude_${Number(match[1])}` : null;
}

export function findRooms(input, rooms) {
  const key = normalizeRoom(input);
  if (!key) return [];
  const exact = rooms.filter(room => normalizeRoom(room.room_id) === key);
  if (exact.length) return exact;
  const aliases = rooms.filter(room => room.aliases.some(alias => normalizeRoom(alias) === key));
  return aliases.length === 1 ? aliases : [];
}

export function suggestions(input, rooms) {
  const key = normalizeRoom(input);
  if (key.length < 2) return [];
  return rooms.filter(room => [room.room_id, ...room.aliases]
    .some(value => normalizeRoom(value).startsWith(key))).slice(0, 6);
}

export function sqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function normalizePlace(value) {
  return value.trim().toLocaleLowerCase('de')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findFacilities(input, facilities) {
  const key = normalizePlace(input);
  if (!key) return [];
  const exact = facilities.filter(place => [place.name, ...place.aliases]
    .some(name => normalizePlace(name) === key));
  if (exact.length) return exact;
  // Short abbreviations such as RZ only match exactly, not arbitrary words.
  if (key.length < 3) return [];
  return facilities.filter(place => [place.name, ...place.aliases]
    .some(name => normalizePlace(name).includes(key))).slice(0, 6);
}
