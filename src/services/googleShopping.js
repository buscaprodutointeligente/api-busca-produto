import config from '../config.js';

/**
 * Adaptador para busca via Google Custom Search API.
 * Requer GOOGLE_API_KEY e GOOGLE_CSE_ID configurados.
 *
 * Setup:
 * 1. Criar projeto em console.cloud.google.com
 * 2. Ativar "Custom Search JSON API"
 * 3. Criar CSE em cse.google.com configurado para buscar em sites de compras BR
 * 4. Obter API Key e CSE ID
 */

/**
 * Busca produtos via Google Custom Search e retorna no formato normalizado.
 */
export async function buscarGoogle(query, limit = 10) {
  if (!config.google?.apiKey || !config.google?.cseId) {
    console.warn(`[${new Date().toISOString()}] [Google] GOOGLE_API_KEY ou GOOGLE_CSE_ID não configurados`);
    return [];
  }

  console.log(`[${new Date().toISOString()}] [Google] Buscando: ${query}`);

  // Google CSE retorna no máximo 10 por chamada
  const numResults = Math.min(limit, 10);

  const params = new URLSearchParams({
    key: config.google.apiKey,
    cx: config.google.cseId,
    q: query,
    num: String(numResults),
    gl: 'br',
    hl: 'pt',
  });

  const url = `https://www.googleapis.com/customsearch/v1?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const err = await response.json();
      console.error(`[${new Date().toISOString()}] [Google] Erro ${response.status}:`, err?.error?.message);
      return [];
    }

    const data = await response.json();
    const items = data?.items || [];

    return items.map(item => normalizarItemGoogle(item)).filter(Boolean);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Google] Falha na busca:`, err.message);
    return [];
  }
}

function normalizarItemGoogle(item) {
  try {
    // Tentar extrair preço do snippet ou metatags
    const preco = extrairPreco(item.snippet || '') || extrairPreco(item.title || '');

    // Thumbnail via pagemap
    const thumbnail = item.pagemap?.cse_image?.[0]?.src
      || item.pagemap?.cse_thumbnail?.[0]?.src
      || null;

    // Vendedor pelo domínio
    const vendedor = extrairDominio(item.link);

    return {
      id: `google_${Buffer.from(item.link).toString('base64').slice(0, 20)}`,
      fonte: 'google',
      titulo: item.title || '',
      preco,
      preco_original: null,
      link: item.link || '',
      thumbnail,
      vendedor,
      reputacao_vendedor: null,
      frete_gratis: false,
      quantidade_vendas: null,
      // Campos para o comparator (texto rico para matching)
      attributes: [],
      descricao: `${item.title} ${item.snippet}`,
    };
  } catch {
    return null;
  }
}

function extrairPreco(texto) {
  if (!texto) return null;
  // Padrões: R$ 1.234,56 | R$1234,56 | 1234.56
  const match = texto.match(/R\$\s?([\d.]+,\d{2})/);
  if (match) {
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
  return null;
}

function extrairDominio(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}
