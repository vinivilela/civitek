# Integração do WhatsApp da Civitek

## Arquitetura do MVP

O pedreiro conversa apenas com um número do WhatsApp. A Meta entrega cada mensagem no webhook da Civitek. O backend valida a assinatura, identifica o telefone, vincula a obra, normaliza o relato como uma ocorrência e responde com o protocolo. Fotos são baixadas da Meta e armazenadas separadamente no bucket de arquivos.

Endpoint de verificação e recebimento:

`https://SEU-DOMINIO/api/whatsapp/webhook`

## Configuração na Meta

1. Crie um app do tipo Business no [Meta for Developers](https://developers.facebook.com/) e adicione o produto WhatsApp.
2. Use primeiro o número de teste oferecido pela Meta. Cadastre os celulares do grupo como destinatários permitidos.
3. Copie o ID do número de telefone, o App Secret e a versão atual da Graph API mostrada no painel.
4. Gere um token permanente para produção. O token temporário serve apenas para o primeiro teste.
5. Na configuração de Webhooks, informe a URL acima e use o mesmo valor de `WHATSAPP_VERIFY_TOKEN` configurado na Civitek.
6. Assine o evento `messages` da conta do WhatsApp Business.
7. Envie uma mensagem de texto ou uma foto com legenda para o número de teste. A ocorrência deve aparecer no topo da caixa de entrada.

## Variáveis necessárias

Copie `.env.example` para `.env` no desenvolvimento local. Nunca envie o arquivo `.env` ao repositório.

- `WHATSAPP_VERIFY_TOKEN`: segredo aleatório criado pela equipe para a verificação do webhook.
- `WHATSAPP_APP_SECRET`: segredo do app usado para validar `x-hub-signature-256`.
- `WHATSAPP_ACCESS_TOKEN`: credencial para baixar fotos e responder mensagens.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador do número remetente na Meta.
- `WHATSAPP_API_VERSION`: versão atual indicada no painel da Meta, incluindo o prefixo `v`.

## Vínculo entre telefone e obra

O MVP usa a tabela `phone_assignments`. O telefone deve ser salvo apenas com dígitos e código do país, por exemplo `5511999999999`. Um telefone ativo aponta para uma obra e para o nome do profissional. O número de demonstração já vem vinculado à Obra Aurora.

Quando um número desconhecido envia uma mensagem, a Civitek preserva o relato e marca a ocorrência como “Sem obra vinculada”. Isso evita perder informação e permite que o engenheiro faça a triagem.

## Limites conscientes do protótipo

- Cada mensagem cria uma ocorrência. Agrupar várias mensagens em uma conversa é a próxima iteração.
- A classificação atual é determinística por palavras-chave. A estrutura já separa essa etapa para substituir por um modelo de IA sem mudar o fluxo.
- Normas aparecem apenas como referência candidata. A validação continua sendo responsabilidade do engenheiro.
- Antes de usar dados reais, o painel e os endpoints de leitura devem receber autenticação e autorização por construtora.

Referências oficiais: [documentação da WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) e [exemplos da Meta](https://github.com/fbsamples/whatsapp-api-examples).
