# Onde paramos (2026-11-24, pausa)

App publicado: https://cleidsonsg.github.io/comparador-precos/ (atualiza sozinho a cada push no `main`).
Roteiro completo: `docs/PROMPT-CONTINUACAO.md`. Detalhes técnicos e ideias futuras: `docs/PROXIMOS-PASSOS.md`.
Última versão no ar: commit `60dc1ce` (nº 23). Peça "tabela de commits" para ver todos, com data, hora e como voltar atrás.

## O que fizemos

**Até 23/11:** conta e sincronização (item 1), publicação no GitHub Pages, visual alinhado ao protótipo, importar por QR, chave, texto ou PDF.

**23/11 e 24/11:**
- **Leitor de QR e código de barras refeito:** zxing-cpp num worker, três tratamentos de imagem. Lê as fotos reais do cupom do RJ, abre a câmera traseira principal ("camera 0", lembrada no aparelho), tem seletor de câmera, lanterna e dica após 8 s.
- **Importar mais curto:**
  - A chave lida fica como **pendente** em Notas, para terminar depois.
  - O próximo passo fica destacado.
  - Ao voltar da Fazenda, o app oferece **Colar agora**.
  - A nota com soma conferida é **guardada sozinha**, e aparece a caixa **"✓ Nota importada"** com OK, Ver notas e Desfazer.
  - Nota repetida mostra "Esta nota já estava importada" e só é substituída se você pedir.
- **Texto copiado no Chrome do celular** passa a ser lido ("Vl. Total" no fim da linha).
- **Notas:** botão **Excluir** em cada nota, com confirmação.
- **App instalável e sem internet (item 5):**
  - Service worker: o app abre e lê QR sem internet.
  - Ícones PNG.
  - Convite "Instalar o Gôndola como app" e botão em Configurações.
  - **Compartilhar > Gôndola** no Android.
  - Faixas de sem internet e de versão nova.
  - Tela de erro.
- **Conta:** "Conta sincronizada em …" e quanto há nela (antes dizia "Tudo guardado" mesmo sem notas).
- **Testes:** 37 unitários (`npm test`) e 30 no navegador (`npm run test:e2e`, com o Chrome do computador).
- **Notas de teste para comparar mercados** (`tests/fixtures/nfce-rj/`, sem CPF e sem nome): Atacadão simulada de 20/11 (14 itens) e Supermarket de 22/11 (15 itens, CNPJ e chave fictícios), com 9 produtos em comum e preços diferentes.

## O que falta

**Aguardando o usuário**
- Testar no celular: Compartilhar > Gôndola, app instalado em modo avião, importar a nota simulada e depois excluí-la.
- E-mail próprio (Brevo) antes do grupo de teste: libera o código de 6 dígitos e tira o limite de 2 e-mails por hora.
- Item 2: autorizar a mudança no banco (migração `0004`) e decidir o valor por foto da leitura avançada (sugestão: "em breve").

**Roteiro (`PROMPT-CONTINUACAO.md`)**
2. Configurações: compartilhar preços, créditos e leitura avançada, apagar meus dados. Plano pronto, depende do banco.
3. Importar o XML da nota.
4. Comparação entre mercados só com produtos vinculados, e tela para revisar e desfazer vínculos. **Sugestão de próximo passo** (não muda o banco).
5. Falta só o esqueleto de carregamento, quando alguma tela buscar dados na rede.
6. Alertas de preço.
7. Preços colaborativos com moderação.
8. Leitura da etiqueta pela câmera (A grátis no aparelho; B paga com créditos).
9. Consulta paga da nota (deixada para depois).
10. Futuro: app Android de verdade, com leitura automática e gratuita da nota.

**Registrado para avaliar:** trazer a nota sem copiar e colar (5 caminhos em `PROXIMOS-PASSOS.md`); notas pendentes sincronizadas na conta (exige banco).

**Pequenos:** atualizar as ações do GitHub (aviso do Node 20); atualizar `claude/status-implementacao.md` no projeto "Criador Projetos" (fora deste repositório).

**Chaves das notas de teste:**
- Atacadão Maricá, 13/11/2026 (real, 49 itens): `3326 1175 3153 3303 1926 6550 6000 1310 0210 4857 9170`
- Atacadão simulada, 20/11/2026 (14 itens): `3326 1175 3153 3303 1926 6550 6000 1318 7714 0726 3154`
- Supermarket Teste, 22/11/2026 (15 itens, fictícia): `3326 1148 2736 1500 0118 6500 2000 0452 1818 3920 4714`

## Para testar no seu celular

1. Abra o app instalado (ou https://cleidsonsg.github.io/comparador-precos/ no Chrome). Se aparecer "Nova versão disponível", toque em **Atualizar**.
2. Não instalou ainda? Use o convite "Instalar o Gôndola como app" ou **Configurações > Instalar app**. No iPhone: Safari > Compartilhar > **Adicionar à Tela de Início**.
3. Em **Configurações > Conta**, entre com o **mesmo e-mail** (Gmail). Peça um e-mail por vez; o limite é de 2 por hora.
4. **Notas > Ler QR Code do cupom**: a câmera abre na traseira principal. Aponte para o QR a uns 15 cm, com boa luz. Se não ler, use **Enviar foto do QR**.
5. Toque em **Abrir consulta da Fazenda**, selecione todo o texto da página e copie. Volte ao app e toque em **Colar agora**. Deve aparecer a caixa **"✓ Nota importada"**.
   - No Android, com o app instalado, dá para usar **Compartilhar > Gôndola** em vez de voltar e colar.
6. Em **Notas**, veja itens, pendentes e **Excluir**. Em **Escanear**, teste o código de barras de um produto.
7. Modo avião: o app instalado deve abrir com a faixa "Sem internet".
8. Se a câmera foi bloqueada: cadeado ao lado do endereço > **Permissões** > **Câmera** > permitir.
