import pLimit from 'p-limit';
import config from '../config.js';
import { buscarCacheItem, salvarCacheItem } from './cache.js';
import { getAccessToken } from './mlAuth.js';

const limit = pLimit(config.ml.concurrency);

async function buildHeaders() {
  const token = await getAccessToken();
  const headers = {
    'Accept': 'application/json',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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

  const response = await fetch(url, { headers: await buildHeaders() });
  if (!response.ok) {
    const body = await response.text();
    console.error(`[${new Date().toISOString()}] ML erro ${response.status}:`, body);
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
  const response = await fetch(url, { headers: await buildHeaders() });
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
    const response = await fetch(`${config.ml.baseUrl}/sites/MLB`, { headers: await buildHeaders() });
    if (response.ok) return { status: 'online' };
    return { status: 'erro', codigo: response.status };
  } catch (err) {
    return { status: 'offline', mensagem: err.message };
  }
}
