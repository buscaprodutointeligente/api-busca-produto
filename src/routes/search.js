import { construirQuery } from '../utils/specParser.js';
import { buscarEmFontes, FONTES_DISPONIVEIS } from '../services/sources.js';
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
          preco_maximo: { type: 'number', nullable: true },
          ordenar_por: { type: 'string', default: 'relevancia_preco' },
          usar_cache: { type: 'boolean', default: true },
          fontes: {
            type: 'array',
            items: { type: 'string', enum: FONTES_DISPONIVEIS },
            default: FONTES_DISPONIVEIS,
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        titulo,
        specs,
        preco_maximo,
        ordenar_por,
        usar_cache,
        fontes = FONTES_DISPONIVEIS,
      } = request.body;

      console.log(`[${new Date().toISOString()}] Nova busca: "${titulo}" | fontes: [${fontes.join(', ')}]`);

      // 1. Verificar cache
      const queryParams = { titulo, specs, preco_maximo, fontes: [...fontes].sort() };
      const queryHash = gerarHash(queryParams);

      if (usar_cache !== false) {
        const cacheResult = await buscarCacheSearch(queryHash);
        if (cacheResult) {
          console.log(`[${new Date().toISOString()}] Cache hit para busca`);
          return { ...cacheResult, cache_hit: true };
        }
      }

      // 2. Construir query e buscar em todas as fontes em paralelo
      const query = construirQuery(titulo, specs);
      console.log(`[${new Date().toISOString()}] Query construída: "${query}"`);

      const todosItens = await buscarEmFontes(query, fontes);

      if (todosItens.length === 0) {
        return {
          query_usada: query,
          fontes_consultadas: fontes,
          total_encontrados: 0,
          total_relevantes: 0,
          cache_hit: false,
          resultados: [],
        };
      }

      // 3. Comparar specs e calcular scores para cada item
      let resultados = [];

      for (const item of todosItens) {
        // Filtrar por preço máximo se definido
        if (preco_maximo && item.preco && item.preco > preco_maximo) continue;
        // Ignorar itens sem preço
        if (!item.preco || item.preco <= 0) continue;

        const { specScore, detalhes: specsEncontradas } = compararSpecs(specs || {}, item);

        resultados.push({
          id: item.id,
          fonte: item.fonte,
          titulo: item.titulo,
          preco: item.preco,
          preco_original: item.preco_original,
          link: item.link,
          thumbnail: item.thumbnail,
          vendedor: item.vendedor || 'N/A',
          reputacao_vendedor: item.reputacao_vendedor,
          frete_gratis: item.frete_gratis,
          quantidade_vendas: item.quantidade_vendas,
          spec_score: specScore,
          specs_encontradas: specsEncontradas,
        });
      }

      // 4. Calcular score final
      const menorPreco = resultados.length > 0
        ? Math.min(...resultados.map(r => r.preco))
        : 0;

      resultados = resultados.map(item => {
        const scores = calcularScoreFinal(item.spec_score, item.preco, menorPreco);
        return { ...item, ...scores };
      });

      // 5. Filtrar spec_score abaixo de 0.3 (apenas quando specs foram fornecidas)
      const temSpecs = specs && Object.keys(specs).length > 0;
      if (temSpecs) {
        resultados = resultados.filter(r => r.spec_score >= 0.3);
      }

      // 6. Ordenar
      if (ordenar_por === 'preco') {
        resultados.sort((a, b) => a.preco - b.preco);
      } else {
        resultados.sort((a, b) => b.score_final - a.score_final);
      }

      const resposta = {
        query_usada: query,
        fontes_consultadas: fontes,
        total_encontrados: todosItens.length,
        total_relevantes: resultados.length,
        cache_hit: false,
        resultados,
      };

      // 7. Salvar cache e histórico
      await salvarCacheSearch(queryHash, queryParams, resposta);

      const melhorResultado = resultados[0] || null;
      await salvarHistorico(
        titulo,
        specs,
        melhorResultado,
        menorPreco > 0 ? menorPreco : null,
        resultados.length,
      );

      console.log(`[${new Date().toISOString()}] Busca concluída: ${resultados.length} relevantes de ${todosItens.length} encontrados`);

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
