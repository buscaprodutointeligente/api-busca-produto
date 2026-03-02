import config from '../config.js';

/**
 * Adaptador para busca via SerpAPI (Google Shopping).
 * Requer SERPAPI_KEY configurado.
 * Free tier: 100 buscas/mês.
 */
export async function buscarSerpApi(query) {
  if (!config.serpapi?.apiKey) {
    console.warn(`[${new Date().toISOString()}] [SerpAPI] SERPAPI_KEY não configurada — fonte desativada`);
    return [];
  }

  console.log(`[${new Date().toISOString()}] [SerpAPI] Buscando: "${query}"`);

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: config.serpapi.apiKey,
    gl: 'br',
    hl: 'pt',
    num: '40',
  });

  const url = `https://serpapi.com/search?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[${new Date().toISOString()}] [SerpAPI] Erro ${response.status}:`, body);
      return [];
    }

    const data = await response.json();
    const items = data?.shopping_results || [];

    console.log(`[${new Date().toISOString()}] [SerpAPI] ${items.length} resultados encontrados`);

    return items.map(normalizarItemSerpApi).filter(Boolean);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [SerpAPI] Falha na busca:`, err.message);
    return [];
  }
}

function normalizarItemSerpApi(item) {
  try {
    const preco = item.extracted_price || extrairPreco(item.price);

    if (!preco) return null;

    const fonte = detectarFonte(item.source, item.link);

    return {
      id: `serp_${item.position || Math.random().toString(36).slice(2, 10)}`,
      fonte,
      titulo: item.title || '',
      preco,
      preco_original: item.extracted_old_price || null,
      link: item.link || '',
      thumbnail: item.thumbnail || null,
      vendedor: item.source || null,
      reputacao_vendedor: item.rating ? `${item.rating}/5 (${item.reviews || 0})` : null,
      frete_gratis: /gr[aá]tis|free/i.test(item.delivery || ''),
      quantidade_vendas: null,
      attributes: [],
      descricao: `${item.title || ''} ${item.snippet || ''}`.trim(),
    };
  } catch {
    return null;
  }
}

function detectarFonte(source, link) {
  const texto = `${source || ''} ${link || ''}`.toLowerCase();
  if (texto.includes('mercadolivre') || texto.includes('mercadolibre')) return 'mercadolivre';
  if (texto.includes('shopee')) return 'shopee';
  if (texto.includes('amazon')) return 'amazon';
  if (texto.includes('magalu') || texto.includes('magazineluiza')) return 'magazineluiza';
  if (texto.includes('americanas')) return 'americanas';
  if (texto.includes('kabum')) return 'kabum';
  if (texto.includes('casasbahia')) return 'casasbahia';
  return 'google';
}

function extrairPreco(texto) {
  if (!texto) return null;
  const match = String(texto).match(/R\$\s?([\d.]+,\d{2})/);
  if (match) {
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
  const matchSimples = String(texto).match(/([\d.]+[.,]\d{2})/);
  if (matchSimples) {
    return parseFloat(matchSimples[1].replace(/\./g, '').replace(',', '.'));
  }
  return null;
}
