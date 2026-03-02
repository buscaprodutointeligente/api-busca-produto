import { buscarProdutos, buscarDetalhesMultiplos } from './mercadolivre.js';
import { buscarShopee } from './shopee.js';
import { buscarGoogle } from './googleShopping.js';
import { buscarSerpApi } from './serpapi.js';

export const FONTES_DISPONIVEIS = ['mercadolivre', 'shopee', 'google', 'serpapi'];

/**
 * Busca produtos em todas as fontes solicitadas em paralelo.
 * Retorna um array unificado de itens no formato normalizado.
 */
export async function buscarEmFontes(query, fontes = FONTES_DISPONIVEIS) {
  const fontesValidas = fontes.filter(f => FONTES_DISPONIVEIS.includes(f));

  if (fontesValidas.length === 0) {
    throw new Error(`Nenhuma fonte válida. Opções: ${FONTES_DISPONIVEIS.join(', ')}`);
  }

  console.log(`[${new Date().toISOString()}] Buscando em paralelo: [${fontesValidas.join(', ')}]`);

  const promises = fontesValidas.map(fonte => buscarFonte(fonte, query));
  const resultadosPorFonte = await Promise.allSettled(promises);

  let todosItens = [];

  for (let i = 0; i < fontesValidas.length; i++) {
    const fonte = fontesValidas[i];
    const resultado = resultadosPorFonte[i];

    if (resultado.status === 'fulfilled') {
      console.log(`[${new Date().toISOString()}] [${fonte}] ${resultado.value.length} itens encontrados`);
      todosItens = todosItens.concat(resultado.value);
    } else {
      console.error(`[${new Date().toISOString()}] [${fonte}] Falhou:`, resultado.reason?.message);
    }
  }

  return todosItens;
}

async function buscarFonte(fonte, query) {
  switch (fonte) {
    case 'mercadolivre': {
      const searchResult = await buscarProdutos(query);
      const items = searchResult.results || [];
      const ids = items.map(i => i.id);
      const detalhes = await buscarDetalhesMultiplos(ids);
      const detalhesMap = new Map(detalhes.map(d => [d.id, d]));

      return items.map(item => {
        const detalhe = detalhesMap.get(item.id);
        return normalizarItemML(item, detalhe);
      }).filter(Boolean);
    }

    case 'shopee':
      // API direta da Shopee bloqueia servidores cloud (403).
      // Fallback: busca via Google CSE com site:shopee.com.br
      console.log(`[${new Date().toISOString()}] [shopee] API direta indisponível — usando Google CSE (site:shopee.com.br)`);
      return buscarGoogle(`${query} site:shopee.com.br`);

    case 'google':
      return buscarGoogle(query);

    case 'serpapi':
      return buscarSerpApi(query);

    default:
      return [];
  }
}

function normalizarItemML(item, detalhe) {
  return {
    id: item.id,
    fonte: 'mercadolivre',
    titulo: item.title || '',
    preco: item.price,
    preco_original: item.original_price || null,
    link: item.permalink || '',
    thumbnail: item.thumbnail || null,
    vendedor: item.seller?.nickname || null,
    reputacao_vendedor: item.seller?.seller_reputation?.level_id || null,
    frete_gratis: item.shipping?.free_shipping || false,
    quantidade_vendas: item.sold_quantity || 0,
    // Campos para o comparator
    attributes: detalhe?.attributes || [],
    descricao: detalhe?.description?.plain_text || detalhe?.description || '',
  };
}
