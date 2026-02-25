import Fastify from 'fastify';
import cors from '@fastify/cors';
import config from './config.js';
import searchRoutes from './routes/search.js';
import historyRoutes from './routes/history.js';

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { ignore: 'pid,hostname' },
    },
  },
});

await app.register(cors);

app.register(searchRoutes, { prefix: '/api' });
app.register(historyRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Servidor rodando na porta ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
