# API Busca Produto - Mercado Livre

API para busca de produtos no Mercado Livre com comparação por especificações técnicas, voltada para compradores de licitações públicas.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Banco**: Supabase (PostgreSQL)
- **Deploy**: Render (Docker)

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Variáveis necessárias:

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_KEY` | Chave anon/public do Supabase |
| `PORT` | Porta do servidor (padrão: 3000) |

### 3. Criar tabelas no Supabase

Execute o SQL abaixo no SQL Editor do Supabase:

```sql
CREATE TABLE search_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_params JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

CREATE TABLE search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo_produto TEXT NOT NULL,
  specs_buscadas JSONB,
  melhor_resultado JSONB,
  menor_preco NUMERIC(10,2),
  total_resultados INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_item_id TEXT NOT NULL UNIQUE,
  item_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_item_cache_ml_id ON item_cache(ml_item_id);
```

### 4. Rodar

```bash
npm start
```

Modo desenvolvimento (com auto-reload):

```bash
npm run dev
```

## Endpoints

### `POST /api/search`

Busca produtos no ML e compara especificações.

**Body:**
```json
{
  "titulo": "Câmera Inteligente Vigilância Externa Segurança IP66 Câmera Dupla",
  "specs": {
    "resolucao": "3MP",
    "conectividade": "WiFi 2.4GHz",
    "protecao": "IP66",
    "lente": "3.6mm",
    "voltagem": "Bivolt",
    "aplicativo": "iCSee",
    "visao_noturna": "Infravermelho 10m",
    "antenas": "2"
  },
  "preco_maximo": 350.00,
  "ordenar_por": "relevancia_preco",
  "usar_cache": true
}
```

### `GET /api/history?limit=20&offset=0`

Lista histórico de buscas realizadas.

### `GET /api/health`

Status da API, conexão com Supabase e API do ML.

### `DELETE /api/cache`

Remove cache expirado do Supabase.

## Deploy no Render

1. Crie um **Web Service** no Render
2. Conecte o repositório
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Ou use o **Dockerfile** incluído
4. Adicione as variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_KEY`)

## Como funciona o scoring

Cada produto encontrado recebe um score composto:

- **spec_score** (0-1): média do matching de cada especificação
- **price_score** (0-1): normalizado pelo menor preço (menor = 1.0)
- **score_final** = (spec_score × 0.7) + (price_score × 0.3)

Peso maior para specs porque em licitações o produto precisa atender as especificações primeiro.
