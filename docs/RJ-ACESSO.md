# Acesso à consulta da NFC-e do RJ — resultado dos testes (2026-11-20)

## No navegador do usuário (IP residencial)
- A consulta por chave abre **sem captcha** e mostra a nota completa (mercado, itens com código interno, totais, dados da nota, chave).
- A página **não mostra GTIN**, só o código interno do mercado.

## A partir do Supabase (Edge Function, IP de nuvem)
- `consultadfe.fazenda.rj.gov.br`: respondeu 200 com uma página de **"acesso bloqueado"** (1565 bytes, sem formulário). O RJ bloqueia o IP do Supabase.
- `www4.fazenda.rj.gov.br`: falha de certificado (`UnknownIssuer`): o servidor não envia a cadeia completa de certificados.

## Conclusão
- **A leitura direta pelo servidor não funciona.** Não contornar o bloqueio (proxies, troca de IP) nem desligar a verificação de certificado.
- O navegador do app também não consegue ler a página da SEFAZ (política CORS).
- **Caminho gratuito da fase 1:** o app lê o QR/chave, abre a consulta oficial no navegador do usuário, e o usuário traz o resultado de volta por **texto copiado ou PDF** (botão "Colar da área de transferência"). O leitor `parseConsultaText.ts` já cobre esse caminho.
- **Plano B opcional e pago:** serviço de consulta por chave, com aviso de custo e créditos (a testar se o provedor escolhido não sofre o mesmo bloqueio).
- **Futuro (fora do escopo atual):** app nativo, onde a leitura sai do celular do próprio usuário.

## Consulta completa, com código de barras (testado em 2026-11-25, Chrome do Android)
- Na consulta, o botão **"Consulta completa"** abre a página com abas (NFe, Emitente, Destinatário, Produtos e Serviços, Totais...). Cada item traz **"Código EAN Comercial" (GTIN)**, ou "SEM GTIN" nos itens a granel. Na nota de teste: 45 de 49 itens com GTIN.
- **"Download do documento" (XML) exige certificado digital**: fechado para o consumidor. Não contornar.
- **⋮ > baixar** no Chrome do celular salva a página inteira em **.mht**, com todos os itens e totais. A página da consulta resumida, baixada antes de tocar em "Consulta completa", não traz os itens.
- O **PDF** da impressão detalhada sai **sem o EAN** (os detalhes de cada item ficam fechados). O HTML salvo no computador (Ctrl+S) traz tudo.
- A página traz o **CPF** no destinatário: o leitor `parseConsultaCompleta.ts` apaga destinatário, pagamento e informações adicionais antes de ler.
- Roteiro para o usuário: QR > Abrir consulta > **Consulta completa** > **⋮ > ⬇ baixar** > no app, **Escolher arquivo baixado**. O passo na Fazenda é manual (o app não controla outro site).
