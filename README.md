# CiviTek

Registro de ocorrências de obra a partir do WhatsApp, com painel de acompanhamento para a engenharia.

O operário envia o relato por WhatsApp. O backend normaliza a mensagem como uma ocorrência, vincula à obra pelo telefone do remetente e responde com o protocolo. O painel mostra as ocorrências, as evidências e os itens de conformidade por obra.

## Stack

- [vinext](https://www.npmjs.com/package/vinext) sobre Vite 8, com React 19 e Server Components
- Cloudflare Workers como runtime, via `@cloudflare/vite-plugin`
- Cloudflare D1 (SQLite) com Drizzle ORM, e R2 para as fotos
- Tailwind CSS 4 e componentes shadcn
- Autenticação pelo login ChatGPT da plataforma OpenAI Sites

## Isolamento por construtora

Toda leitura e escrita passa por um `TenantScope`, resolvido em `lib/tenant.ts` a partir do usuário autenticado. O `company_id` nunca vem da requisição. As tabelas filhas carregam a coluna diretamente, então o isolamento não depende de o join ter sido escrito corretamente, e cada função de `db/repository.ts` recebe o escopo como primeiro argumento.

O primeiro acesso provisiona uma construtora, uma associação de usuário e uma assinatura no plano gratuito. Em desenvolvimento, esse primeiro acesso adota o tenant de demonstração para que o painel abra com as duas obras semeadas. Defina `CIVITEK_DEMO_TENANT=off` em produção para desligar essa adoção.

Uma mensagem de WhatsApp vinda de um telefone sem vínculo não entra no histórico de nenhum cliente: ela é registrada em `company-unassigned` para triagem.

## Memória da construtora

A IA é montada em camadas por `lib/ai/context.ts`, e o plano decide quais camadas entram no prompt.

| Camada | O que é                                             | Plano   |
| ------ | --------------------------------------------------- | ------- |
| L0     | Fatos determinísticos, calculados em SQL            | Todos   |
| L1     | Base normativa curada, igual para todos os clientes | Todos   |
| L2     | Agregados do histórico da própria construtora       | Premium |
| L3     | Memória semântica das ocorrências                   | Premium |
| L4     | Sinal de aceite e recusa das sugestões              | Premium |

O bloco L1 é idêntico entre clientes e vai no início do prompt, então o cache de prefixo é reaproveitado entre tenants diferentes.

Os números dos insights saem de SQL, não do modelo. Eles são calculados em todos os planos e o que o plano gratuito retém é a exibição das cifras, o que também significa que o histórico de um cliente gratuito nunca é enviado a um provedor de modelo. Na obra que atinge a cota, o cliente pode abrir o relatório completo por 72 horas antes de decidir.

Na ocorrência aberta, o card "Memória da obra" responde se aquele problema já aconteceu, mostra os casos parecidos com o prazo real de cada um e propõe o tratamento que encerrou a maioria deles, citando a norma aplicável. A proposta é a nota que a engenharia registrou ao encerrar, não uma frase gerada, então ela é rastreável até quem a escreveu.

No primeiro caso de um tipo, quando ainda não há o que comparar, o card diz que a empresa ainda não registrou um caso como aquele e responde com o tratamento recomendado pela norma, em passos numerados. As ocorrências OC-9001, OC-9002 e OC-9003 do conjunto de demonstração existem para exercitar esse estado: cada uma traz uma disciplina que não aparece em nenhuma outra, o que garante que continuem sendo as primeiras do seu tipo. Essa é a IA sugestiva do cold start, disponível em todos os planos, e ela continua aparecendo depois, ao lado da solução vinda do histórico, como a leitura normativa do caso.

A semelhança hoje é medida por categoria mais sobreposição de palavras do relato. Essa é a costura que a camada L3 substitui: trocar o comparador por uma consulta vetorial no namespace do tenant muda `lib/ai/precedent.ts` e nada acima dele.

Os painéis ficam em Memória e na própria ocorrência, e as APIs em `/api/ai/memory` e `/api/occurrences/[id]/insight`. A geração de texto do modelo está mockada em `lib/ai/client.ts`: a montagem de contexto, o gate de plano e o livro de custo por tenant em `ai_interactions` são reais, e trocar o mock pelo provedor significa substituir o corpo de `callModel`.

## Requisitos

- Node.js 22.13 ou superior (`package.json` declara essa faixa em `engines`)
- pnpm

## Como rodar

```bash
pnpm install
pnpm dev
```

Abra <http://localhost:3000>.

O ambiente de desenvolvimento sobe com um login local já resolvido pelo plugin do OpenAI Sites. O terminal imprime o usuário na inicialização:

```
Sites local sign-in: seedy@sites.test
```

A primeira requisição cria as tabelas no D1 local e insere os dados de demonstração, então o painel abre com 15 obras, 213 ocorrências e 420 mensagens. Não é preciso rodar migração nem configurar banco para o desenvolvimento local. O estado do D1 fica em `.wrangler/`, que não vai para o repositório. Apagar essa pasta recria tudo do zero na próxima requisição.

Nenhuma variável de ambiente é obrigatória para rodar. Sem as credenciais da Meta, a integração do WhatsApp aparece como não configurada no painel e o resto da aplicação funciona normalmente.

## Scripts

| Script             | O que faz                                              |
| ------------------ | ------------------------------------------------------ |
| `pnpm dev`         | Servidor de desenvolvimento em <http://localhost:3000> |
| `pnpm build`       | Build de produção em `dist/`                           |
| `pnpm start`       | Serve o build com Wrangler em <http://127.0.0.1:8787>  |
| `pnpm lint`        | oxlint                                                 |
| `pnpm format`      | oxfmt                                                  |
| `pnpm db:generate` | Gera migração Drizzle a partir de `db/schema.ts`       |

### Sobre o `pnpm start`

O `pnpm start` serve o worker já compilado, mas o login local existe apenas no `pnpm dev`. Em produção os cabeçalhos de autenticação são injetados pela hospedagem do OpenAI Sites, então `/signin-with-chatgpt` responde 404 nesse modo e a raiz redireciona para lá. Para exercitar a API compilada, envie os cabeçalhos na mão:

```bash
curl -H "oai-authenticated-user-id: u1" \
     -H "oai-authenticated-user-email: voce@exemplo.com" \
     http://127.0.0.1:8787/api/projects
```

Para o uso normal do dia a dia, prefira o `pnpm dev`.

## WhatsApp

A integração com a Meta é opcional para desenvolvimento. Para ligá-la, copie `.env.example` para `.env` e preencha as credenciais. O passo a passo do app na Meta está em [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md).

## Estrutura

```
app/                 Rotas, painel e rotas de API
  api/               Endpoints REST e o webhook do WhatsApp
  chatgpt-auth.ts    Leitura do usuário autenticado e proteção das rotas
db/                  Schema Drizzle, repositório e bootstrap do D1
drizzle/             Migrações geradas
db/seed.ts           Gerador determinístico dos dados de demonstração
lib/tenant.ts        Resolução da construtora e do plano a partir do usuário
lib/ai/              Camadas de contexto, perfil do tenant e insights
lib/whatsapp.ts      Cliente da Graph API e validação de assinatura
components/ui/       Componentes shadcn
.openai/hosting.json Bindings de D1 e R2 do projeto hospedado
```

## Banco de dados

O schema vive em `db/schema.ts` e as migrações em `drizzle/`. No desenvolvimento local as tabelas são criadas por `db/bootstrap.ts`, que roda na primeira consulta e é idempotente. Os dados de demonstração vêm de `db/seed.ts`, que gera o conjunto a partir de uma semente fixa e de uma data âncora, então os números do painel são os mesmos em qualquer máquina. O seed é pulado quando o tenant de demonstração já tem todas as obras, então uma partida a frio não repete os inserts. Ao alterar o schema, gere a migração correspondente com `pnpm db:generate` e reflita a mudança no bootstrap, já que os dois caminhos convivem hoje.
