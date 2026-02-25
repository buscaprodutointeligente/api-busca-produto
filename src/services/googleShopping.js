import config from '../config.js';

/**
 * Adaptador para busca via Google Custom Search API.
 * Requer GOOGLE_API_KEY e GOOGLE_CSE_ID configurados.
 *
 * Setup:
 * 1. Acessar console.cloud.google.com → criar projeto → ativar "Custom Search JSON API"
 * 2. Acessar cse.google.com → criar um Custom Search Engine
 *    - Em "Sites para pesquisar" adicionar os marketplaces:
 *      shopee.com.br, mercadolivre.com.br, americanas.com.br,
 *      magazineluiza.com.br, amazon.com.br, kabum.com.br
 *    - Ativar "Pesquisa em toda a web" para cobrir qualquer loja
 * 3. Copiar o Search Engine ID (cx) → GOOGLE_CSE_ID
 * 4. No console.cloud.google.com → Credenciais → criar API Key → GOOGLE_API_KEY
 */

// Marketplaces BR para restringir a busca quando não há CSE configurado por sites
const SITES_BR = [
  'shopee.com.br',
  'mercadolivre.com.br',
  'americanas.com.br',
  'magazineluiza.com.br',
  'amazon.com.br',
  'kabum.com.br',
  'submarino.com.br',
];

/**
 * Busca produtos via Google Custom Search e retorna no formato normalizado.
 * Faz até 2 chamadas para cobrir mais resultados (máx 10 por chamada na API do Google).
 */
export async function buscarGoogle(query, limit = 20) {
  if (!config.google?.apiKey || !config.google?.cseId) {
    console.warn(`[${new Date().toISOString()}] [Google] GOOGLE_API_KEY ou GOOGLE_CSE_ID não configurados — fonte desativada`);
    return [];
  }

  console.log(`[${new Date().toISOString()}] [Google] Buscando: "${query}"`);

  // Adiciona restrição de sites de compras à query para resultados mais precisos
  const queryComSites = `${query} comprar`;

  const resultados = [];
  const pages = Math.ceil(Math.min(limit, 20) / 10); // máx 2 páginas (20 resultados)

  for (let page = 0; page < pages; page++) {
    const start = page * 10 + 1; // Google usa índice 1-based

    const params = new URLSearchParams({
      key: config.google.apiKey,
      cx: config.google.cseId,
      q: queryComSites,
      num: '10',
      start: String(start),
      gl: 'br',
      hl: 'pt',
    });

    const url = `https://www.googleapis.com/customsearch/v1?${params}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error(`[${new Date().toISOString()}] [Google] Erro ${response.status}:`, err?.error?.message || 'desconhecido');
        break;
      }

      const data = await response.json();
      const items = data?.items || [];

      console.log(`[${new Date().toISOString()}] [Google] Página ${page + 1}: ${items.length} resultados`);

      const normalizados = items.map(normalizarItemGoogle).filter(Boolean);
      resultados.push(...normalizados);

      // Parar se não há mais resultados
      if (items.length < 10) break;

    } catch (err) {
      console.error(`[${new Date().toISOString()}] [Google] Falha na busca:`, err.message);
      break;
    }
  }

  console.log(`[${new Date().toISOString()}] [Google] Total retornado: ${resultados.length} itens`);
  return resultados;
}

function normalizarItemGoogle(item) {
  try {
    const dominio = extrairDominio(item.link);

    // Filtrar resultados que não são de lojas (ex: blogs, reviews)
    const ehLoja = SITES_BR.some(site => (dominio || '').includes(site.replace('www.', '')));
    const temPrecoNoTitulo = /R\$/.test(item.title || '') || /R\$/.test(item.snippet || '');

    // Incluir apenas se for de uma loja conhecida ou tiver preço no título/snippet
    if (!ehLoja && !temPrecoNoTitulo) return null;

    // Extrair preço do snippet, título ou metatags
    const preco = extrairPreco(item.pagemap?.offer?.[0]?.price)
      || extrairPreco(item.snippet || '')
      || extrairPreco(item.title || '');

    // Thumbnail via pagemap
    const thumbnail = item.pagemap?.cse_image?.[0]?.src
      || item.pagemap?.cse_thumbnail?.[0]?.src
      || item.pagemap?.product?.[0]?.image
      || null;

    // Limpar título (remover domínio e sufixos comuns)
    const titulo = (item.title || '')
      .replace(/\s*[-|]\s*(Shopee|Americanas|Magazine Luiza|MercadoLivre|Amazon|Kabum).*$/i, '')
      .trim();

    return {
      id: `google_${Buffer.from(item.link).toString('base64').slice(0, 24)}`,
      fonte: 'google',
      titulo,
      preco,
      preco_original: null,
      link: item.link || '',
      thumbnail,
      vendedor: dominio,
      reputacao_vendedor: null,
      frete_gratis: false,
      quantidade_vendas: null,
      attributes: [],
      descricao: `${titulo} ${item.snippet || ''}`,
    };
  } catch {
    return null;
  }
}

function extrairPreco(texto) {
  if (!texto) return null;
  // Padrões: R$ 1.234,56 | R$1234,56 | R$ 189,90
  const match = String(texto).match(/R\$\s?([\d.]+,\d{2})/);
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
