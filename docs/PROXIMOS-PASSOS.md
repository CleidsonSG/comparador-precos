# Próximos passos

1. **Verificação do RJ com cupom real** (feita parcialmente em 2026-11-20: a consulta por chave abriu sem captcha no navegador do usuário; a página mostra o CÓDIGO INTERNO do mercado, não o GTIN. O acesso a partir do Supabase foi testado e é BLOQUEADO (ver `docs/RJ-ACESSO.md`), e descobrir o que significa o dígito colado à unidade, ex.: UND9, UND7, PCT8)
   - Entrada: texto do link do QR (`...consultaNFCe/QRCode?p=...`) ou a chave de 44 dígitos. Cubra CPF e nome.
   - Perguntas: abre sem captcha? A página de resultado traz itens, GTIN, valores, CNPJ e data? Há botão de XML?
   - Resultado define o cenário: A (leitura direta grátis), B (captcha só na chave) ou C (alternativas e consulta paga opcional).
2. (Feito para texto/PDF: `src/modules/nfce/uf/rj/parseConsultaText.ts`, 6 testes. Falta o leitor por HTML/consulta direta.) Módulo `src/modules/nfce/uf/rj` com leitura por âncoras, validação (soma = total, chave, CNPJ, data) e fixtures sem dados pessoais.
3. Autenticação, perfil e importação de notas (QR, chave, XML/PDF, texto colado, manual).
   - **Feito em 2026-11-23 (item 1 de `PROMPT-CONTINUACAO.md`):** login por código de 6 dígitos no e-mail (Configurações > Conta); notas, vínculos e carrinho sincronizados com o Supabase; aparelho como cache com fila de alterações para uso sem internet; "Sair e manter" ou "Sair e apagar do aparelho".
   - Banco: migração `0003_sync.sql` aplicada (colunas da nota, `product_links`, `cart_items`, perfil criado no primeiro login, `save_receipt` só para o servidor).
   - Função `save-receipt` publicada: confere o usuário, valida a nota (chave, CNPJ, soma, nenhum CPF) e grava de forma atômica.
   - **Pendente (usuário):** no painel do Supabase, em Authentication > Email Templates, incluir `{{ .Token }}` nos modelos "Magic Link" e "Confirm signup" para o e-mail trazer o código de 6 dígitos. Configurar um serviço de e-mail próprio (SMTP) antes do grupo de teste: o padrão envia poucos e-mails por hora.
   - **XML feito em 2026-11-25 (item 3):** `src/modules/nfce/xml/parseNfceXml.ts` (layout nacional 4.00, qualquer UF, só modelo 65). Apaga `<dest>`, `<infAdic>`, `<autXML>` e a assinatura antes de ler: CPF e nome nunca são lidos. Confere chave (DV), CNPJ da chave e soma dos itens com `ICMSTot/vProd`. Entra por "Enviar PDF ou XML", texto colado ou Compartilhar > Gôndola.
   - Limite do XML: código de produto com letras (`cProd`) é recusado, porque a função `save-receipt` só aceita código numérico. Ampliar exige mudar e publicar a função (pedir autorização). O GTIN (`cEAN`) ainda não é guardado; poderia sugerir vínculos pelo código de barras (sempre com confirmação).
   - Falta entrada manual.
4. Leitura ao vivo do produto (GTIN) com cartão de comparação e veredito.
5. KPIs e gráficos, alertas e carrinho inteligente.
   - **Feito em 2026-11-25 (item 4 de `PROMPT-CONTINUACAO.md`):** tela "Comparar mercados" (`#comparar` e `#vinculos`, `src/pages/Compare.tsx`, lógica em `src/modules/prices/compare.ts`). Usa só produtos vinculados: cesta comum por mercado, "cada produto onde é mais barato", preço por mês com uma linha por mercado (`MonthChart`) e tabela produto a produto.
   - Sugestões de vínculo por nome parecido (Dice com abreviações, mínimo 0,6), sempre com confirmação; "Não é" fica só no aparelho (`gondola.dismissed.v1`). Vínculo à mão, tirar item, desfazer vínculo e acrescentar código de barras depois.
   - Vínculo sem código de barras recebe um número interno de 14 dígitos começando por `29` (`isManualId`), para caber na tabela `product_links` sem mudar o banco.
   - Limites: compara o preço unitário da nota; embalagens diferentes (1 kg x 5 kg) não são convertidas. Mais de 3 mercados repetem as 3 cores (há legenda, valores no texto e tabela).
6. OCR: A no aparelho; B opcional com consentimento e créditos (funções no servidor).
7. Preços colaborativos com moderação.
8. Monitor diário do leitor e reprocessador de notas pendentes.
9. Auditoria de acessibilidade, desempenho e segurança antes do grupo de teste.

## Decisões em aberto
- Valor por foto (OCR avançado) e por nota (consulta paga, se necessária)
- Provedor de pagamento para recarga de créditos (no teste: créditos manuais)
- Provedor da consulta paga de NFC-e do RJ (só se a verificação indicar necessidade)

## App Android (futuro, decidido em 2026-11-24)

**Objetivo:** ler o QR e guardar a nota sozinho, de graça, sem copiar e colar.

**Por que o site (PWA) não consegue:** o RJ bloqueia o IP do Supabase (`docs/RJ-ACESSO.md`) e o navegador não deixa um site ler a página de outro (CORS). O site só pode *abrir* a consulta.

**Como fazer:**
- Empacotar o app atual com **Capacitor** (mesmo código React; sem reescrever telas).
- Plugin nativo pequeno: abre a consulta oficial numa **WebView visível**, no celular e na internet do próprio usuário; quando a página termina de carregar, lê `document.body.innerText` e devolve ao app, que usa o leitor que já existe (`parseConsultaText.ts`) e guarda a nota.
- Nada é contornado: é o mesmo que o usuário abrir a página. Se aparecer captcha, quem resolve é o usuário. Sem proxy, sem troca de IP, sem desligar certificado.
- CPF e nome do consumidor continuam ignorados pelo leitor e nunca guardados.
- Interface carregada do site publicado (atualiza sem reinstalar); só mudanças na parte nativa pedem APK novo.

**Distribuição:** APK instalado direto (a Play Store segue fora do escopo até o usuário pedir). O Android pede "permitir instalar desta fonte" na primeira vez.

**Pré-requisitos:** Android Studio e JDK no computador; chave de assinatura guardada com segurança (sem ela não dá para atualizar o app); teste no celular do usuário.

**iPhone:** continua no site instalado (Safari > Compartilhar > Adicionar à Tela de Início), com copiar e colar. Reavaliar depois.

## Trazer a nota da Fazenda sem copiar e colar (futuro, registrado em 2026-11-24)

**Problema:** hoje a pessoa abre a consulta, seleciona todo o texto, copia, volta e cola. São muitos toques, e o texto muda conforme o navegador. Exemplo: no Chrome do celular, "Vl. Total" vem no fim da linha da quantidade (`tests/fixtures/nfce-rj/atacadao-marica-2026-11-13.celular.txt`), e no computador vem na linha do produto. Cada formato novo quebra o leitor até ser ajustado.

**Ideias para avaliar (só registro, nada implementado):**
1. **App Android com leitura automática** (ver "App Android" acima): a página é lida pelo próprio app, sem copiar. É o caminho mais eficaz.
2. **Compartilhar > Gôndola** (já existe no Android com o app instalado): medir se é mais fácil que copiar e colar, e deixar o passo a passo mais visível na tela.
3. **PDF da página:** na Fazenda, "Compartilhar > Imprimir > Salvar como PDF" e compartilhar o PDF com o Gôndola. O leitor de PDF já existe; conferir se o texto do PDF do celular traz os totais (o `raw.txt` não traz e a soma não confere).
4. **Leitor mais tolerante:** em vez de depender de quebras de linha, achar cada item pelas âncoras (`(Código: N)`, `Qtde.:`, `UN:`, `Vl. Unit.:` e o primeiro valor `0,00` depois delas). Testar com textos copiados no Chrome e no Samsung Internet (Android), no Safari (iPhone) e no computador, sempre anonimizados (CPF e nome `[removido]`).
5. **Consulta paga** (item 9): automática, mas com custo por nota.

**Regras que continuam valendo:** sem contornar bloqueio ou captcha; CPF e nome do consumidor nunca guardados; textos de teste só anonimizados.
