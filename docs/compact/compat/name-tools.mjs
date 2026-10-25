export const normalizeCharacterName=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
export function findCharacter(catalog,name){
  const key=normalizeCharacterName(name);if(!key)return null;
  return catalog.find(c=>normalizeCharacterName(c.name)===key)||catalog.find(c=>c.aliases?.some(alias=>normalizeCharacterName(alias)===key))||null;
}
