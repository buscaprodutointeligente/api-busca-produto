import { normalizar, compararTextos } from '../utils/textMatch.js';
import { buscarEquivalente } from '../utils/specParser.js';

/**
 * Compara as specs da licitação com os atributos de um item do ML.
 * Retorna um objeto com o score de cada spec e o score total.
 */
export function compararSpecs(specsLicitacao, itemDetalhes) {
  if (!specsLicitacao || Object.keys(specsLicitacao).length === 0) {
    return { specScore: 1.0, detalhes: {} };
  }

  const atributos = itemDetalhes.attributes || [];
  const titulo = itemDetalhes.title || '';
  const descricao = itemDetalhes.description?.plain_text || itemDetalhes.description || '';

  // Texto combinado para fallback de busca textual
  const textoCompleto = `${titulo} ${descricao}`;

  const detalhes = {};
  let somaScores = 0;

  for (const [campo, valorSpec] of Object.entries(specsLicitacao)) {
    const resultado = compararSpecIndividual(campo, valorSpec, atributos, textoCompleto);
    detalhes[campo] = resultado;
    somaScores += resultado.score;
  }

  const totalSpecs = Object.keys(specsLicitacao).length;
  const specScore = totalSpecs > 0 ? somaScores / totalSpecs : 0;

  return { specScore, detalhes };
}

/**
 * Compara uma spec individual contra os atributos e texto do item.
 */
function compararSpecIndividual(campo, valorSpec, atributos, textoCompleto) {
  // 1. Tentar match pelos atributos estruturados do ML
  for (const attr of atributos) {
    const attrName = normalizar(attr.name || '');
    const attrValue = attr.value_name || '';
    const campoNorm = normalizar(campo);

    // Verificar se o atributo é relevante para este campo
    if (attrName.includes(campoNorm) || campoNorm.includes(attrName) || camposRelacionados(campo, attr.id, attr.name)) {
      // Verificar equivalência
      const equiv = buscarEquivalente(campo, valorSpec, attrValue);
      if (equiv.encontrado) {
        return {
          valor: attrValue,
          match: 'exato',
          score: 1.0,
          fonte: 'atributo',
        };
      }

      // Comparação textual do valor do atributo
      const resultado = compararTextos(valorSpec, attrValue);
      if (resultado.score > 0) {
        return {
          valor: attrValue,
          match: resultado.tipo,
          score: resultado.score,
          fonte: 'atributo',
        };
      }
    }
  }

  // 2. Fallback: buscar no texto completo (título + descrição) usando equivalências
  const equiv = buscarEquivalente(campo, valorSpec, textoCompleto);
  if (equiv.encontrado) {
    return {
      valor: equiv.valor,
      match: 'exato',
      score: 1.0,
      fonte: 'texto',
    };
  }

  // 3. Fallback: matching textual direto
  const resultado = compararTextos(valorSpec, textoCompleto);
  if (resultado.score > 0) {
    return {
      valor: valorSpec,
      match: resultado.tipo,
      score: resultado.score,
      fonte: 'texto',
    };
  }

  return {
    valor: null,
    match: 'nao_encontrado',
    score: 0,
    fonte: null,
  };
}

/**
 * Verifica se um atributo do ML está relacionado a um campo de spec.
 * Lida com IDs de atributos do ML e nomes alternativos.
 */
function camposRelacionados(campo, attrId, attrName) {
  const campoNorm = normalizar(campo);
  const nomeNorm = normalizar(attrName || '');
  const idNorm = (attrId || '').toLowerCase();

  const mapeamentos = {
    resolucao: ['resolution', 'resolucao', 'megapixel', 'pixels'],
    conectividade: ['connectivity', 'conectividade', 'wireless', 'wifi', 'wi-fi', 'connection'],
    protecao: ['protection', 'protecao', 'ip_rating', 'ip rating', 'ip66', 'ip67', 'ip68', 'waterproof'],
    lente: ['lens', 'lente', 'focal'],
    voltagem: ['voltage', 'voltagem', 'voltaje', 'power_supply', 'alimentacao'],
    aplicativo: ['app', 'aplicativo', 'application', 'software'],
    visao_noturna: ['night_vision', 'visao noturna', 'infrared', 'infravermelho', 'ir'],
    antenas: ['antenna', 'antena', 'antenas'],
  };

  const termos = mapeamentos[campoNorm] || [campoNorm];
  return termos.some(t => nomeNorm.includes(t) || idNorm.includes(t));
}

/**
 * Calcula o score final de um item baseado em spec_score e price_score.
 */
export function calcularScoreFinal(specScore, preco, menorPreco) {
  const priceScore = menorPreco > 0 ? menorPreco / preco : 0;
  const scoreFinal = (specScore * 0.7) + (Math.min(priceScore, 1.0) * 0.3);

  return {
    score_final: Math.round(scoreFinal * 100) / 100,
    spec_score: Math.round(specScore * 100) / 100,
    price_score: Math.round(Math.min(priceScore, 1.0) * 100) / 100,
  };
}
