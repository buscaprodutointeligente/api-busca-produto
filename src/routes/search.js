import { construirQuery } from '../utils/specParser.js';
import { buscarProdutos, buscarDetalhesMultiplos } from '../services/mercadolivre.js';
import { compararSpecs, calcularScoreFinal } from '../services/comparator.js';
import {
  gerarHash,
  buscarCacheSearch,
  salvarCacheSearch,
  salvarHistorico,
} from '../services/cache.js';

export default async function searchRoutes(fastify) {
  fastify.post('/search', {
    schema: {
      body: {
        type: 'object',
        required: ['titulo'],
        properties: {
          titulo: { type: 'string' },
          specs: { type: 'object' },
          preco_maximo: { type: 'number' },
          ordenar_por: { type: 'string', default: 'relevancia_preco' },
          usar_cache: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { titulo, specs, preco_maximo, ordenar_por, usar_cache } = request.body;

      console.log(`[${new Date().toISOString()}] Nova busca: "${titulo}"`);

      // 1. Verificar cache
      const queryParams = { titulo, specs, preco_maximo };
      const queryHash = gerarHash(queryParams);

      if (usar_cache !== false) {
        const cacheResult = await buscarCacheSearch(queryHash);
        if (cacheResult) {
          console.log(`[${new Date().toISOString()}] Cache hit para busca`);
          return { ...cacheResult, cache_hit: true };
        }
      }

      // 2. Construir query e buscar no ML
      const query = construirQuery(titulo, specs);
      console.log(`[${new Date().toISOString()}] Query construída: "${query}"`);

      const searchResult = await buscarProdutos(query);
      const items = searchResult.results || [];

      if (items.length === 0) {
        return {
          query_usada: query,
          total_encontrados: 0,
          total_relevantes: 0,
          cache_hit: false,
          resultados: [],
        };
      }

      // 3. Buscar detalhes de cada item
      const itemIds = items.map(item => item.id);
      const detalhes = await buscarDetalhesMultiplos(itemIds);

      // Criar mapa de detalhes por ID
      const detalhesMap = new Map();
      for (const d of detalhes) {
        detalhesMap.set(d.id, d);
      }

      // 4. Comparar specs e calcular scores
      let resultados = [];

      for (const item of items) {
        const detalhe = detalhesMap.get(item.id);
        if (!detalhe) continue;

        // Filtrar por preço máximo se definido
        const preco = item.price;
        if (preco_maximo && preco > preco_maximo) continue;

        const { specScore, detalhes: specsEncontradas } = compararSpecs(specs || {}, detalhe);

        resultados.push({
          id: item.id,
          titulo: item.title,
          preco: item.price,
          preco_original: item.original_price,
          link: item.permalink,
          thumbnail: item.thumbnail,
          vendedor: item.seller?.nickname || 'N/A',
          reputacao_vendedor: item.seller?.seller_reputation?.level_id || null,
          frete_gratis: item.shipping?.free_shipping || false,
          quantidade_vendas: item.sold_quantity || 0,
          spec_score: specScore,
          specs_encontradas: specsEncontradas,
        });
      }

      // 5. Calcular score final
      const menorPreco = resultados.length > 0
        ? Math.min(...resultados.map(r => r.preco))
        : 0;

      resultados = resultados.map(item => {
        const scores = calcularScoreFinal(item.spec_score, item.preco, menorPreco);
        return {
          ...item,
          ...scores,
        };
      });

      // 6. Filtrar items com spec_score abaixo de 0.3
      resultados = resultados.filter(r => r.spec_score >= 0.3);

      // 7. Ordenar
      if (ordenar_por === 'preco') {
        resultados.sort((a, b) => a.preco - b.preco);
      } else {
        resultados.sort((a, b) => b.score_final - a.score_final);
      }

      const resposta = {
        query_usada: query,
        total_encontrados: items.length,
        total_relevantes: resultados.length,
        cache_hit: false,
        resultados,
      };

      // 8. Salvar cache e histórico
      await salvarCacheSearch(queryHash, queryParams, resposta);

      const melhorResultado = resultados[0] || null;
      await salvarHistorico(
        titulo,
        specs,
        melhorResultado,
        menorPreco > 0 ? menorPreco : null,
        resultados.length,
      );

      console.log(`[${new Date().toISOString()}] Busca concluída: ${resultados.length} resultados relevantes de ${items.length} encontrados`);

      return resposta;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Erro na busca:`, err);
      reply.status(500).send({
        erro: 'Erro interno ao processar busca',
        mensagem: err.message,
      });
    }
  });
}
