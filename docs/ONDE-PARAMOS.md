# Onde paramos (2026-11-23)

App publicado: https://cleidsonsg.github.io/comparador-precos/ (atualiza sozinho a cada push no `main`).
Roteiro completo: `docs/PROMPT-CONTINUACAO.md`. Detalhes técnicos: `docs/PROXIMOS-PASSOS.md`.

## O que fizemos

**Item 1 do roteiro (concluído): conta e sincronização**
- Login sem senha pelo e-mail (link "Sign in" do e-mail padrão do Supabase; o código de 6 dígitos também é aceito quando o e-mail próprio for configurado).
- Notas, vínculos e carrinho guardados na conta e sincronizados entre aparelhos. O aparelho funciona sem internet e envia as mudanças depois.
- Sem login o app funciona por completo, só no aparelho; ao entrar, as notas do aparelho sobem para a conta.
- Ao sair: "manter no aparelho" ou "apagar do aparelho". Ao entrar com outra conta, o app pergunta antes de apagar ou juntar.
- Banco: migração `0003_sync.sql` aplicada; função do servidor `save-receipt` (valida chave, CNPJ, soma e ausência de CPF).
- Testado com dois navegadores, sem internet e de volta. Login real confirmado pelo usuário (Gmail).

**Publicação**
- GitHub Pages em `/comparador-precos/`, com testes e publicação automáticos a cada push. Repositório tornado público (histórico revisado: sem segredos nem CPF real).
- Supabase > URL Configuration: Site URL = endereço do Pages; Redirect URLs incluem o Pages e `http://127.0.0.1:5174/**`.

**Visual alinhado ao protótipo (`site/index.html`)**
- Menu com Configurações, engrenagem e lua no topo, contador no Carrinho, visor da câmera, estados vazios com ícone, Notas com cartão de importação, Configurações com Conta e Preferências (tema).

**Importar nota**
- Chave aceita com ou sem espaços, pontos, quebras de linha e caracteres invisíveis do WhatsApp; chave incompleta mostra quantos números foram encontrados.
- Passo 3 (colar texto / enviar PDF) liberado sem a chave: a chave vem do próprio texto ou PDF.

**Câmera (QR do cupom e código de barras)**
- Tela preta corrigida (a câmera ligava antes do vídeo estar na tela).
- Câmera traseira em até 1920x1080 com foco contínuo.
- Leitor nativo do celular (Android/Chrome) ou zxing-cpp em WebAssembly servido pelo próprio app (iPhone/computador). Lê QR pequeno e com ruído em ~1,4 s nos testes com câmera simulada.

**Chave da nota de teste (Atacadão Maricá, 13/11/2026):** `3326 1175 3153 3303 1926 6550 6000 1310 0210 4857 9170`

## O que falta

**Aguardando o usuário**
- Testar a câmera real no celular (QR do cupom e código de barras) e dizer o modelo (Android ou iPhone).
- Item 2: autorizar mudança no banco de produção (migração `0004`, funções `feature-consent` e `delete-account`) e decidir o valor por foto da leitura avançada (sugestão: "em breve" por enquanto).
- E-mail próprio (Brevo) antes do grupo de teste: libera o código de 6 dígitos e tira o limite de 2 e-mails por hora. Depois, incluir `{{ .Token }}` nos modelos "Magic Link" e "Confirm signup".
- Usuário tem duas contas (Gmail com a nota de 49 itens; Yahoo vazia): usar sempre o mesmo e-mail.

**Roteiro (`PROMPT-CONTINUACAO.md`)**
2. Configurações: compartilhar preços, créditos e leitura avançada, apagar meus dados (plano já apresentado).
3. Importar XML da nota.
4. Comparação entre mercados só com produtos vinculados pelo usuário; tela para revisar e desfazer vínculos.
5. Estados completos (carregando, erro, sem internet) em todas as telas, service worker e ícones PNG do PWA.
6. Alertas de preço.
7. Preços colaborativos com moderação.
8. OCR da etiqueta (A gratuito no aparelho; B pago com créditos).
9. Consulta paga opcional de NFC-e.

**Pequenos**
- Atualizar as ações do GitHub (aviso do Node 20 no workflow).
- Atualizar `claude/status-implementacao.md` no projeto "Criador Projetos" (fora deste repositório).

## Para testar no seu celular

1. Abra https://cleidsonsg.github.io/comparador-precos/ no celular e recarregue a página (se abrir a versão antiga, feche a aba e abra de novo).
2. Em **Configurações > Conta**, entre com o **mesmo e-mail do computador** (peça um só e-mail por vez; o limite é de 2 por hora). Toque em **Sign in** no próprio celular.
3. Para usar como aplicativo: Android (Chrome) > menu ⋮ > **Adicionar à tela inicial**; iPhone (Safari) > compartilhar > **Adicionar à Tela de Início** (no iPhone, faça o login pelo Safari antes).
4. Vá em **Notas > Ler QR Code do cupom** (ou **Importar**). Na primeira vez, toque em **Permitir** câmera. Aponte para o QR do cupom a uns 15 cm, com boa luz e sem reflexo, e espere 1 a 2 segundos para focar.
5. Se não ler, use **Enviar foto do QR** (a câmera nativa tira a foto com foco e resolução máximos).
6. Também dá para digitar ou colar a chave (com ou sem espaços) ou colar o texto / enviar o PDF da consulta direto no passo 3.
7. Em **Escanear**, teste o código de barras de um produto.
8. Se a câmera tiver sido bloqueada: cadeado ao lado do endereço > **Permissões** > **Câmera** > permitir.
