/**
 * Adaptador para busca na Shopee Brasil.
 * Usa a API interna de busca da Shopee (não oficial).
 */

const SHOPEE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer': 'https://shopee.com.br/',
  'x-api-source': 'pc',
  'x-requested-with': 'XMLHttpRequest',
};

/**
 * Busca produtos na Shopee e retorna no formato normalizado.
 */
export async function buscarShopee(query, limit = 50) {
  const params = new URLSearchParams({
    by: 'relevancy',
    keyword: query,
    limit: String(limit),
    newest: '0',
    order: 'desc',
    page_type: 'search',
    scenario: 'PAGE_GLOBAL_SEARCH',
    version: '2',
  });

  const url = `https://shopee.com.br/api/v4/search/search_items?${params}`;
  console.log(`[${new Date().toISOString()}] [Shopee] Buscando: ${query}`);

  try {
    const response = await fetch(url, { headers: SHOPEE_HEADERS });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] [Shopee] Erro ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items = data?.items || [];

    return items.map(item => normalizarItemShopee(item)).filter(Boolean);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Shopee] Falha na busca:`, err.message);
    return [];
  }
}

function normalizarItemShopee(item) {
  try {
    const info = item.item_basic;
    if (!info) return null;

    const shopId = info.shopid;
    const itemId = info.itemid;
    const preco = info.price / 100000; // Shopee usa preço * 100000
    const precoOriginal = info.price_before_discount
      ? info.price_before_discount / 100000
      : null;
    const thumbnail = info.image
      ? `https://cf.shopee.com.br/file/${info.image}`
      : null;
    const link = `https://shopee.com.br/product/${shopId}/${itemId}`;

    return {
      id: `shopee_${itemId}`,
      fonte: 'shopee',
      titulo: info.name || '',
      preco,
      preco_original: precoOriginal !== preco ? precoOriginal : null,
      link,
      thumbnail,
      vendedor: info.shop_name || null,
      reputacao_vendedor: null,
      frete_gratis: info.show_free_shipping || false,
      quantidade_vendas: info.sold || 0,
      // Campos para o comparator
      attributes: [],
      descricao: info.name || '',
    };
  } catch {
    return null;
  }
}
