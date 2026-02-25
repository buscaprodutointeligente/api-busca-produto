import { listarHistorico, limparCacheExpirado, verificarConexao } from '../services/cache.js';
import { verificarStatusML } from '../services/mercadolivre.js';

export default async function historyRoutes(fastify) {
  // GET /api/history
  fastify.get('/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit, offset } = request.query;
    const historico = await listarHistorico(limit, offset);
    return { total: historico.length, historico };
  });

  // GET /api/health
  fastify.get('/health', async () => {
    const [supabase, ml] = await Promise.all([
      verificarConexao(),
      verificarStatusML(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      servicos: {
        supabase,
        mercadolivre: ml,
      },
    };
  });

  // DELETE /api/cache
  fastify.delete('/cache', async () => {
    const resultado = await limparCacheExpirado();
    return {
      mensagem: 'Cache expirado removido',
      removidos: resultado,
    };
  });
}
