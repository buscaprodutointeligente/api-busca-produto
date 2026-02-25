# Prompt para criar o Frontend

Cole o conteúdo abaixo no Claude via terminal:

---

Crie um frontend completo em Angular 19 (última versão estável) para consumir a API de busca de produtos do Mercado Livre. O objetivo é fornecer uma interface prática para um comprador de licitações públicas buscar produtos por especificações técnicas e encontrar o menor preço.

## Contexto de negócio

O usuário participa de licitações públicas. Cada licitação exige produtos com especificações técnicas precisas. Ele precisa de uma interface onde possa:
1. Digitar o título do produto da licitação
2. Adicionar as especificações técnicas (chave/valor) que o produto precisa ter
3. Definir um preço máximo (opcional)
4. Ver os resultados ordenados por relevância, com destaque visual para o score de matching
5. Consultar o histórico de buscas anteriores

## Stack

- **Framework**: Angular 19 (última versão estável, standalone components)
- **Estilização**: Tailwind CSS
- **HTTP Client**: HttpClient do Angular (@angular/common/http)
- **Roteamento**: Angular Router (@angular/router)
- **Ícones**: Lucide Angular (ou Angular Material Icons)
- **Formulários**: Reactive Forms (@angular/forms)
- **Deploy**: Vercel ou Render (build estático)

## API Backend (já existente)

A API roda em `http://localhost:3000` (dev) e terá URL de produção configurável via variável de ambiente.

### Endpoints disponíveis:

#### POST /api/search
Busca produtos com comparação de specs.

**Request:**
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

**Response:**
```json
{
  "query_usada": "Câmera Inteligente Vigilância Externa IP66 Dupla 3MP WiFi",
  "total_encontrados": 50,
  "total_relevantes": 12,
  "cache_hit": false,
  "resultados": [
    {
      "titulo": "Câmera Dupla Ip66 Externa Wifi 3mp Visão Noturna Icsee",
      "preco": 189.90,
      "preco_original": 250.00,
      "link": "https://www.mercadolivre.com.br/...",
      "thumbnail": "https://http2.mlstatic.com/...",
      "vendedor": "TECH_STORE",
      "reputacao_vendedor": "green",
      "frete_gratis": true,
      "quantidade_vendas": 1523,
      "score_final": 0.92,
      "spec_score": 0.95,
      "price_score": 0.85,
      "specs_encontradas": {
        "resolucao": { "valor": "3MP", "match": "exato", "score": 1.0 },
        "protecao": { "valor": "IP66", "match": "exato", "score": 1.0 },
        "conectividade": { "valor": "WiFi 2.4GHz", "match": "exato", "score": 1.0 },
        "lente": { "valor": "3.6mm", "match": "exato", "score": 1.0 },
        "aplicativo": { "valor": "iCSee", "match": "exato", "score": 1.0 },
        "voltagem": { "valor": "Bivolt", "match": "parcial", "score": 0.5 },
        "visao_noturna": { "valor": "Infravermelho", "match": "parcial", "score": 0.5 },
        "antenas": { "valor": null, "match": "nao_encontrado", "score": 0.0 }
      }
    }
  ]
}
```

#### GET /api/history?limit=20&offset=0
Retorna histórico de buscas.

**Response:**
```json
{
  "total": 5,
  "historico": [
    {
      "id": "uuid",
      "titulo_produto": "Câmera Vigilância Externa IP66",
      "specs_buscadas": { "resolucao": "3MP", "protecao": "IP66" },
      "melhor_resultado": { "titulo": "...", "preco": 189.90, "score_final": 0.92 },
      "menor_preco": 149.90,
      "total_resultados": 12,
      "created_at": "2026-02-24T20:00:00Z"
    }
  ]
}
```

#### GET /api/health
Status da API.

#### DELETE /api/cache
Limpa cache expirado.

## Estrutura do projeto

```
/src
  /app
    /components
      search-form/         — formulário de busca (título, specs, preço)
      spec-input/          — componente para adicionar specs (chave + valor)
      result-card/         — card de um resultado individual
      result-list/         — lista de resultados
      score-badge/         — badge visual para score (cores por faixa)
      spec-match-detail/   — detalhe do matching de cada spec
      history-table/       — tabela de histórico de buscas
      header/              — header da aplicação
      loading-state/       — estado de loading (skeleton)
    /pages
      search/              — página principal de busca
      history/             — página de histórico
    /services
      api.service.ts       — service para chamar a API backend (HttpClient)
    /models
      search.model.ts      — interfaces TypeScript (SearchRequest, SearchResponse, ResultItem, etc.)
    app.component.ts
    app.routes.ts
  /environments
    environment.ts         — variáveis de ambiente (apiUrl)
    environment.prod.ts
  main.ts
  styles.css
angular.json
```

Obs: Usar **standalone components** (padrão do Angular 19). NÃO usar NgModules. Todos os componentes devem ser standalone com imports diretos.

## Páginas e Layout

### Layout geral
- Header fixo no topo com nome da aplicação "BuscaLicit" e navegação (Busca | Histórico)
- Fundo cinza claro (#f5f5f5), cards brancos
- Design limpo e funcional, sem excesso visual
- Responsivo (mobile-first)

### Página de Busca (SearchPage) — rota "/"

Dividida em duas seções:

**Seção esquerda (ou topo no mobile): Formulário**
- Input de título do produto (textarea, para colar títulos longos de licitação)
- Seção de specs dinâmica:
  - Botão "+ Adicionar especificação"
  - Cada spec é uma linha com: input "Campo" (ex: resolucao) + input "Valor" (ex: 3MP) + botão remover (X)
  - Começar com 2 linhas vazias por padrão
  - Sugestões de campos comuns em um dropdown/datalist: resolucao, conectividade, protecao, lente, voltagem, aplicativo, visao_noturna, antenas, potencia, material, cor, tamanho, peso, capacidade
- Input de preço máximo (opcional, numérico, com prefixo R$)
- Toggle "Usar cache" (default: on)
- Botão "Buscar" (destaque, azul #2563EB)

**Seção direita (ou abaixo no mobile): Resultados**
- Mostrar barra de resumo: "X resultados relevantes de Y encontrados" + se veio do cache
- Lista de cards de resultado

### Card de Resultado (ResultCard)

Cada card mostra:
- Thumbnail do produto (imagem à esquerda)
- Título do produto
- Preço atual em destaque (grande, verde se abaixo do preço máximo)
- Preço original riscado (se houver desconto)
- Badge de score final (cor por faixa):
  - >= 0.8: verde (#16a34a)
  - >= 0.6: amarelo (#ca8a04)
  - >= 0.4: laranja (#ea580c)
  - < 0.4: vermelho (#dc2626)
- Nome do vendedor
- Badge "Frete Grátis" se aplicável
- Quantidade de vendas
- Botão "Ver no ML" (abre link em nova aba)
- **Seção expandível** "Ver matching de specs" que ao clicar mostra a tabela de specs_encontradas:
  - Cada linha: nome da spec | valor encontrado | tipo de match | score
  - Cor da linha baseada no match:
    - exato (1.0): fundo verde claro
    - parcial (0.5): fundo amarelo claro
    - nao_encontrado (0): fundo vermelho claro

### Página de Histórico (HistoryPage) — rota "/historico"

- Tabela com colunas: Data | Produto | Specs | Melhor Preço | Total Resultados
- Clicar em uma linha abre um modal ou expande para mostrar detalhes
- Botão "Limpar cache" no topo que chama DELETE /api/cache
- Paginação simples (Anterior | Próximo)

## Estados da interface

1. **Inicial**: Formulário vazio, sem resultados, mensagem "Preencha os dados do produto e clique em Buscar"
2. **Loading**: Skeleton loading nos cards + mensagem "Buscando produtos no Mercado Livre... Isso pode levar alguns segundos"
3. **Com resultados**: Lista de cards + resumo
4. **Sem resultados**: Mensagem "Nenhum resultado encontrado para esta busca. Tente termos mais genéricos."
5. **Erro**: Mensagem de erro com opção de tentar novamente

## Variáveis de ambiente

Usar o sistema de environments do Angular:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
```

## Requisitos técnicos

- Angular 19 com **standalone components** (sem NgModules)
- Usar **signals** para estado reativo onde fizer sentido (Angular 19 signals API)
- **Reactive Forms** para o formulário de busca (FormGroup, FormArray para specs dinâmicas)
- **HttpClient** com tipagem forte (interfaces TypeScript para request/response)
- Criar **interfaces TypeScript** para todos os modelos de dados (SearchRequest, SearchResponse, ResultItem, SpecMatch, HistoryItem)
- Usar **Angular Router** com lazy loading nas rotas
- Tratar erros de API com catchError no service e feedback visual no componente
- Loading states para todas as chamadas de API
- Responsivo (funcionar bem em desktop e mobile)
- Sem dependências pesadas desnecessárias (manter o bundle leve)
- Acessibilidade básica (labels nos inputs, alt nas imagens, foco visível)
- Usar **inject()** ao invés de injeção por construtor (padrão moderno do Angular)
- Usar **@if, @for, @switch** (nova sintaxe de controle de fluxo do Angular 17+) ao invés de *ngIf, *ngFor

## Importante

- O frontend NÃO faz chamadas diretamente à API do Mercado Livre — toda comunicação é via backend
- Foco em praticidade: o usuário de licitações quer rapidez e clareza, não animações rebuscadas
- O formulário de specs deve ser fácil de usar porque o usuário vai preencher isso repetidamente
- A informação mais importante é: "esse produto atende as specs da licitação?" (spec_score) e depois "qual o preço?"
