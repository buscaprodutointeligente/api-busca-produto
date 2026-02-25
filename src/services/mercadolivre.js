import pLimit from 'p-limit';
import config from '../config.js';
import { buscarCacheItem, salvarCacheItem } from './cache.js';

const limit = pLimit(config.ml.concurrency);

const ML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.mercadolivre.com.br/',
  'Origin': 'https://www.mercadolivre.com.br',
};

/**
 * Faz uma busca textual no Mercado Livre.
 */
export async function buscarProdutos(query, categoryId = null) {
  const params = new URLSearchParams({
    q: query,
    limit: String(config.ml.searchLimit),
    offset: '0',
  });

  if (categoryId) {
    params.set('category', categoryId);
  }

  const url = `${config.ml.baseUrl}/sites/${config.ml.siteId}/search?${params}`;
  console.log(`[${new Date().toISOString()}] Buscando no ML: ${url}`);

  const response = await fetch(url, { headers: ML_HEADERS });
  if (!response.ok) {
    throw new Error(`Erro na busca ML: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Busca detalhes completos de um item (com cache).
 */
export async function buscarDetalhesItem(itemId) {
  // Verificar cache primeiro
  const cached = await buscarCacheItem(itemId);
  if (cached) {
    console.log(`[${new Date().toISOString()}] Cache hit para item ${itemId}`);
    return cached;
  }

  const url = `${config.ml.baseUrl}/items/${itemId}`;
  const response = await fetch(url, { headers: ML_HEADERS });
  if (!response.ok) {
    console.error(`[${new Date().toISOString()}] Erro ao buscar item ${itemId}: ${response.status}`);
    return null;
  }

  const data = await response.json();

  // Salvar no cache
  await salvarCacheItem(itemId, data);

  return data;
}

/**
 * Busca detalhes de múltiplos itens com concorrência controlada (p-limit).
 */
export async function buscarDetalhesMultiplos(itemIds) {
  console.log(`[${new Date().toISOString()}] Buscando detalhes de ${itemIds.length} itens (concorrência: ${config.ml.concurrency})`);

  const resultados = await Promise.all(
    itemIds.map(id => limit(() => buscarDetalhesItem(id)))
  );

  return resultados.filter(Boolean);
}

/**
 * Verifica se a API do ML está acessível.
 */
export async function verificarStatusML() {
  try {
    const response = await fetch(`${config.ml.baseUrl}/sites/MLB`, { headers: ML_HEADERS });
    if (response.ok) return { status: 'online' };
    return { status: 'erro', codigo: response.status };
  } catch (err) {
    return { status: 'offline', mensagem: err.message };
  }
}
