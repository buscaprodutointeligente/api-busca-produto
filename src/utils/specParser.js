import { normalizar } from './textMatch.js';

const EQUIVALENCIAS = {
  conectividade: [
    ['WiFi', 'Wi-Fi', 'Wifi', 'WIFI', 'Wireless'],
    ['Bluetooth', 'BT'],
    ['Ethernet', 'RJ45', 'Cabo de rede'],
  ],
  voltagem: [
    ['Bivolt', '110v/220v', '110/220V', '110-220V', 'Automático'],
    ['110v', '110V', '127V', '127v'],
    ['220v', '220V'],
  ],
  protecao: [
    ['IP66', 'IP 66'],
    ['IP67', 'IP 67'],
    ['IP68', 'IP 68'],
  ],
  resolucao: [
    ['3MP', '3 MP', '3 Megapixels', '3 Megapixel'],
    ['2MP', '2 MP', '2 Megapixels', '1080p', 'Full HD'],
    ['5MP', '5 MP', '5 Megapixels'],
    ['4MP', '4 MP', '4 Megapixels', '2K'],
    ['8MP', '8 MP', '8 Megapixels', '4K'],
  ],
};

// Palavras genéricas a serem removidas da query de busca
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'para', 'por', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'que', 'o', 'a',
  'os', 'as', 'ao', 'aos', 'se', 'seu', 'sua', 'tipo', 'modelo',
]);

/**
 * Verifica se dois valores são equivalentes usando o dicionário de equivalências.
 * Retorna true se pertencem ao mesmo grupo de equivalência.
 */
export function saoEquivalentes(campo, valor1, valor2) {
  const norm1 = normalizar(valor1);
  const norm2 = normalizar(valor2);

  if (norm1 === norm2) return true;

  // Buscar em todas as categorias de equivalência
  const categorias = campo ? [EQUIVALENCIAS[campo]].filter(Boolean) : Object.values(EQUIVALENCIAS);

  for (const grupos of categorias) {
    for (const grupo of grupos) {
      const grupoNorm = grupo.map(normalizar);
      if (grupoNorm.includes(norm1) && grupoNorm.includes(norm2)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Encontra o valor equivalente em um texto, se houver.
 * Retorna { encontrado: true, valor, score } ou { encontrado: false }.
 */
export function buscarEquivalente(campo, valorSpec, texto) {
  const textoNorm = normalizar(texto);
  const valorNorm = normalizar(valorSpec);

  // Match direto
  if (textoNorm.includes(valorNorm)) {
    return { encontrado: true, valor: valorSpec, score: 1.0, tipo: 'exato' };
  }

  // Buscar equivalências
  const categorias = campo ? [EQUIVALENCIAS[campo]].filter(Boolean) : Object.values(EQUIVALENCIAS);

  for (const grupos of categorias) {
    for (const grupo of grupos) {
      const grupoNorm = grupo.map(normalizar);
      if (grupoNorm.includes(valorNorm)) {
        // Essa spec pertence a este grupo, verificar se algum equivalente está no texto
        for (let i = 0; i < grupo.length; i++) {
          if (textoNorm.includes(grupoNorm[i])) {
            return { encontrado: true, valor: grupo[i], score: 1.0, tipo: 'exato' };
          }
        }
      }
    }
  }

  return { encontrado: false };
}

/**
 * Constrói uma query otimizada a partir do título do produto.
 * Remove stopwords e mantém termos técnicos.
 */
export function construirQuery(titulo, specs) {
  const palavras = titulo
    .split(/\s+/)
    .filter(p => p.length > 1 && !STOPWORDS.has(p.toLowerCase()));

  // Adicionar specs importantes que não estão no título
  const tituloNorm = normalizar(titulo);
  if (specs) {
    for (const valor of Object.values(specs)) {
      const valorNorm = normalizar(valor);
      if (valorNorm.length > 1 && !tituloNorm.includes(valorNorm)) {
        palavras.push(valor);
      }
    }
  }

  return palavras.join(' ');
}

export { EQUIVALENCIAS };
