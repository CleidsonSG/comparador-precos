# Instruções de continuação — Gôndola (comparador de preços de supermercado)

Leia primeiro: `CLAUDE.md`, `docs/DESIGN.md`, `docs/RJ-ACESSO.md`, `docs/SKILLS.md` e o protótipo `site/index.html` (referência visual e de comportamento, com dados fictícios).

## Ponto de partida
A base é a branch `main` do GitHub (commit 5ea03f7 ou mais novo). **Não sobrescreva** o que já existe e **não reintroduza** vínculo automático de produtos por descrição. Se houver conflito, mantenha a versão do `main` e aproveite só o que for melhor da outra, sem quebrar as regras abaixo. Antes de qualquer tela, rode `git pull`.

## Regras que não podem ser quebradas
- Custo zero por padrão. Recursos pagos (OCR avançado, consulta avançada) são opcionais, com aviso de custo **uma única vez**, aceite explícito, cancelamento em Configurações e cobrança por **créditos pré-pagos**. Validar consentimento, saldo e limites **no servidor** (funções do Supabase).
- **Nunca armazenar nem exibir CPF ou nome do consumidor**, nem em banco, logs ou arquivos de teste. O leitor já os ignora.
- **Não contornar captcha, bloqueio de IP nem verificação de certificado.** A SEFAZ-RJ bloqueia o IP do Supabase, então a leitura direta pelo servidor não existe. O caminho é: QR ou chave, consulta oficial aberta no navegador do usuário (só links de `fazenda.rj.gov.br`), e o usuário traz o texto ou o PDF de volta.
- **Produto = mercado (CNPJ) + código interno da nota.** A nota do RJ não traz código de barras. O vínculo entre código de barras e itens, ou entre mercados, **é sempre confirmado pelo usuário**, nunca automático.
- Sem automações que alterem produção sozinhas: o agente propõe, o humano aprova.
- Publicação em Play Store e App Store está **fora do escopo** até o usuário pedir.
- Visual: mobile-first, 360 a 1440 px, modo escuro, acessibilidade, estados de carregando/vazio/erro/sem internet. Cor nunca é o único sinal (sempre ícone e texto). **Antes de entregar cada tela, conferir em celular (390 px) e computador (1280 px)**, nos temas claro e escuro.

## Já pronto no `main`
- Vite + React + TypeScript (PWA básico).
- Navegação: Início, Escanear, Carrinho, Notas (Importar abre dentro de Notas).
- Importar nota: QR por câmera e foto, chave, consulta oficial, colar texto, PDF; conferência; duplicidade por chave; guarda no aparelho (localStorage).
- Início com dados reais: KPIs, gráfico de preço por compra, gasto por mercado, maiores aumentos.
- Escanear produto: código de barras, vínculo confirmado, comparação com a etiqueta, adicionar ao carrinho.
- Carrinho: quantidades, total, economia possível.
- Banco: 13 tabelas com RLS no Supabase (projeto CheckMercado, id `ldixuhfogqzsfwsntbia`), migrações 0001 e 0002 aplicadas.
- 16 testes unitários (`npm test`).
- **Item 1 feito (2026-11-23):** login por código no e-mail e sincronização de notas, vínculos e carrinho (migração 0003, função `save-receipt`). Visual alinhado ao protótipo: menu com Configurações, engrenagem no topo, visor da câmera, estados vazios com ícone, Notas com cartão de importação. 26 testes.

## O que fazer, nesta ordem
Para cada item: propor o plano curto, implementar, testar (unitário e navegador), conferir o visual, commitar e dar push. Peça autorização antes de mexer em banco de produção.

1. **Guardar dados no Supabase com login.** Auth (e-mail), e notas, vínculos e carrinho sincronizados. Como `stores`, `store_products` e `products` são protegidas por RLS, gravar por Edge Function com chave de serviço, validando o usuário. Manter o aparelho como cache para funcionar sem internet.
2. **Configurações** (ícone de engrenagem no topo): tema (claro, escuro, sistema), compartilhar preços (opcional, desligado por padrão; envia só produto, preço, mercado e data), créditos e leitura avançada, apagar meus dados.
3. **Importar XML** da nota, além do PDF e do texto.
4. **Comparação entre mercados:** gráfico por mês e cesta por mercado usando **só produtos vinculados pelo usuário**. Tela para revisar e desfazer vínculos.
5. **Estados completos:** esqueletos de carregamento, erro e sem internet em todas as telas, mais service worker para uso offline e ícones PNG do PWA.
6. **Alertas:** aviso quando um produto vinculado ficar mais caro ou mais barato que o histórico.
7. **Preços colaborativos (opcional) com moderação:** descartar preços muito fora da média, exigir confirmação de outros usuários e permitir denúncia. Usar a função `get_shared_prices`, que não expõe dados pessoais.
8. **OCR da etiqueta:** opção A no aparelho (gratuita, sempre mostra o valor lido para confirmar ou corrigir com um toque). Opção B avançada e paga por foto, com aviso de custo uma única vez, aceite lembrado e cancelamento depois. Cobrança por créditos pré-pagos, validada no servidor.
9. **Consulta paga opcional:** escolher e testar um provedor de consulta por chave, avisando custo e limitações (pode sofrer o mesmo bloqueio).

## Pendências que dependem do usuário
- Testar a câmera real (QR do cupom e código de barras).
- Na gôndola: conferir se o preço por unidade ou por kg compara certo com o da nota.
- Entender o dígito colado à unidade nas notas (UND9, UND7, PCT8).

## Ao terminar cada etapa
Atualizar `claude/status-implementacao.md` no projeto "Criador Projetos" e `docs/PROXIMOS-PASSOS.md`, e confirmar que o `main` do GitHub tem o commit.
