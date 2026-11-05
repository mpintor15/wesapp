const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e']);

const cleanWord = (word) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');

// Mismo formato que el usuario de un colaborador (inicial + apellido): inicial de la primera
// palabra y última palabra del nombre, sin conectores.
// "Banco Pichincha" -> "BPichincha"; "Centro Comercial El Recreo" -> "CRecreo".
export const suggestClienteUsuario = (clienteNombre) => {
  const words = String(clienteNombre || '')
    .trim()
    .split(/\s+/)
    .filter((word) => !CONNECTORS.has(word.toLowerCase()))
    .map(cleanWord)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return `${words[0][0].toUpperCase()}${words[0].slice(1).toLowerCase()}`;
  const first = words[0];
  const last = words[words.length - 1];
  return `${first[0].toUpperCase()}${last[0].toUpperCase()}${last.slice(1).toLowerCase()}`;
};
