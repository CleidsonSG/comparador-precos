# Próximos passos

1. **Verificação do RJ com cupom real** (feita parcialmente em 2026-11-20: a consulta por chave abriu sem captcha no navegador do usuário; a página mostra o CÓDIGO INTERNO do mercado, não o GTIN. O acesso a partir do Supabase foi testado e é BLOQUEADO (ver `docs/RJ-ACESSO.md`), e descobrir o que significa o dígito colado à unidade, ex.: UND9, UND7, PCT8)
   - Entrada: texto do link do QR (`...consultaNFCe/QRCode?p=...`) ou a chave de 44 dígitos. Cubra CPF e nome.
   - Perguntas: abre sem captcha? A página de resultado traz itens, GTIN, valores, CNPJ e data? Há botão de XML?
   - Resultado define o cenário: A (leitura direta grátis), B (captcha só na chave) ou C (alternativas e consulta paga opcional).
2. (Feito para texto/PDF: `src/modules/nfce/uf/rj/parseConsultaText.ts`, 6 testes. Falta o leitor por HTML/consulta direta.) Módulo `src/modules/nfce/uf/rj` com leitura por âncoras, validação (soma = total, chave, CNPJ, data) e fixtures sem dados pessoais.
3. Autenticação, perfil e importação de notas (QR, chave, XML/PDF, texto colado, manual).
4. Leitura ao vivo do produto (GTIN) com cartão de comparação e veredito.
5. KPIs e gráficos, alertas e carrinho inteligente.
6. OCR: A no aparelho; B opcional com consentimento e créditos (funções no servidor).
7. Preços colaborativos com moderação.
8. Monitor diário do leitor e reprocessador de notas pendentes.
9. Auditoria de acessibilidade, desempenho e segurança antes do grupo de teste.

## Decisões em aberto
- Valor por foto (OCR avançado) e por nota (consulta paga, se necessária)
- Provedor de pagamento para recarga de créditos (no teste: créditos manuais)
- Provedor da consulta paga de NFC-e do RJ (só se a verificação indicar necessidade)
