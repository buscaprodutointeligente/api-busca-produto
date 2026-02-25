/**
 * Normaliza texto removendo acentos e convertendo para lowercase.
 */
export function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Extrai valores numéricos com unidades de um texto.
 * Ex: "3MP", "3.6mm", "IP66", "10m", "2.4GHz"
 */
export function extrairValoresNumericos(texto) {
  if (!texto) return [];
  const regex = /(\d+[.,]?\d*)\s*(mp|megapixels?|megapixel|mm|m|ghz|mhz|v|w|hz|fps|tb|gb|mb|kg|cm|pol|")/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(texto)) !== null) {
    matches.push({
      valor: parseFloat(match[1].replace(',', '.')),
      unidade: match[2].toLowerCase(),
      original: match[0],
    });
  }
  return matches;
}

/**
 * Compara dois textos e retorna um score de 0 a 1.
 * 1 = match exato, 0.5 = match parcial, 0 = não encontrado.
 */
export function compararTextos(especificacao, textoAlvo) {
  if (!especificacao || !textoAlvo) return { score: 0, tipo: 'nao_encontrado' };

  const specNorm = normalizar(especificacao);
  const alvoNorm = normalizar(textoAlvo);

  // Match exato
  if (alvoNorm.includes(specNorm)) {
    return { score: 1.0, tipo: 'exato' };
  }

  // Match de valores numéricos com unidade
  const specNumericos = extrairValoresNumericos(especificacao);
  const alvoNumericos = extrairValoresNumericos(textoAlvo);

  if (specNumericos.length > 0 && alvoNumericos.length > 0) {
    for (const sv of specNumericos) {
      for (const av of alvoNumericos) {
        if (sv.valor === av.valor && normalizarUnidade(sv.unidade) === normalizarUnidade(av.unidade)) {
          return { score: 1.0, tipo: 'exato' };
        }
      }
    }
  }

  // Match parcial — palavras da spec encontradas no alvo
  const palavrasSpec = specNorm.split(/\s+/).filter(p => p.length > 1);
  if (palavrasSpec.length === 0) return { score: 0, tipo: 'nao_encontrado' };

  let encontradas = 0;
  for (const palavra of palavrasSpec) {
    if (alvoNorm.includes(palavra)) encontradas++;
  }

  const ratio = encontradas / palavrasSpec.length;
  if (ratio >= 0.8) return { score: 0.8, tipo: 'parcial' };
  if (ratio >= 0.5) return { score: 0.5, tipo: 'parcial' };
  if (ratio > 0) return { score: 0.3, tipo: 'parcial' };

  return { score: 0, tipo: 'nao_encontrado' };
}

function normalizarUnidade(unidade) {
  const mapa = {
    megapixels: 'mp',
    megapixel: 'mp',
  };
  return mapa[unidade] || unidade;
}
