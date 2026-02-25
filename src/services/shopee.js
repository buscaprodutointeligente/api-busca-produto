/**
 * Adaptador para busca na Shopee Brasil.
 * Usa a API interna de busca da Shopee (não oficial).
 */

const SHOPEE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://shopee.com.br/search?keyword=tenis',
  'Origin': 'https://shopee.com.br',
  'x-api-source': 'pc',
  'x-requested-with': 'XMLHttpRequest',
  'af-ac-enc-dat': '1',
};

const SHOPEE_ENDPOINTS = [
  (params) => `https://shopee.com.br/api/v4/search/search_items?${params}`,
  (params) => `https://shopee.com.br/api/v2/search_items/?${params}`,
];

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
    area: 'BR',
  });

  const url = SHOPEE_ENDPOINTS[0](params);
  console.log(`[${new Date().toISOString()}] [Shopee] Buscando: "${query}" — ${url}`);

  try {
    const response = await fetch(url, { headers: SHOPEE_HEADERS });

    console.log(`[${new Date().toISOString()}] [Shopee] Status HTTP: ${response.status}`);

    const rawText = await response.text();

    // Log parcial para diagnóstico (primeiros 500 chars)
    console.log(`[${new Date().toISOString()}] [Shopee] Resposta (preview): ${rawText.slice(0, 500)}`);

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] [Shopee] Erro ${response.status} — bloqueado ou endpoint inválido`);
      return [];
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error(`[${new Date().toISOString()}] [Shopee] Resposta não é JSON válido`);
      return [];
    }

    // Shopee pode retornar em diferentes estruturas dependendo da versão da API
    const items = data?.items
      || data?.data?.items
      || data?.result?.items
      || [];

    console.log(`[${new Date().toISOString()}] [Shopee] Total de itens no response: ${items.length}`);

    if (items.length === 0 && data?.error) {
      console.error(`[${new Date().toISOString()}] [Shopee] API retornou erro:`, JSON.stringify(data.error));
    }

    return items.map(item => normalizarItemShopee(item)).filter(Boolean);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Shopee] Falha na busca:`, err.message);
    return [];
  }
}

function normalizarItemShopee(item) {
  try {
    // A Shopee pode retornar o item direto ou dentro de item_basic
    const info = item.item_basic || item;
    if (!info || (!info.itemid && !info.item_id)) return null;

    const shopId = info.shopid || info.shop_id;
    const itemId = info.itemid || info.item_id;

    // Preço: Shopee multiplica por 100000
    const precoRaw = info.price ?? info.price_min ?? 0;
    const preco = precoRaw > 1000 ? precoRaw / 100000 : precoRaw;

    const precoOriginalRaw = info.price_before_discount ?? info.price_max ?? null;
    const precoOriginal = precoOriginalRaw && precoOriginalRaw > 1000
      ? precoOriginalRaw / 100000
      : precoOriginalRaw;

    const imagem = info.image || info.images?.[0];
    const thumbnail = imagem ? `https://cf.shopee.com.br/file/${imagem}` : null;

    // Montar slug amigável para o link
    const slug = (info.name || 'produto')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    const link = `https://shopee.com.br/${slug}-i.${shopId}.${itemId}`;

    return {
      id: `shopee_${itemId}`,
      fonte: 'shopee',
      titulo: info.name || '',
      preco: preco > 0 ? preco : null,
      preco_original: precoOriginal && precoOriginal !== preco ? precoOriginal : null,
      link,
      thumbnail,
      vendedor: info.shop_name || info.shopname || null,
      reputacao_vendedor: null,
      frete_gratis: info.show_free_shipping ?? info.free_shipping ?? false,
      quantidade_vendas: info.sold ?? info.historical_sold ?? 0,
      attributes: [],
      descricao: info.name || '',
    };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Shopee] Erro ao normalizar item:`, err.message);
    return null;
  }
}
