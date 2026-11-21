# Próximos passos

1. **Verificação do RJ com cupom real** (primeira tarefa de código)
   - Entrada: texto do link do QR (`...consultaNFCe/QRCode?p=...`) ou a chave de 44 dígitos. Cubra CPF e nome.
   - Perguntas: abre sem captcha? A página de resultado traz itens, GTIN, valores, CNPJ e data? Há botão de XML?
   - Resultado define o cenário: A (leitura direta grátis), B (captcha só na chave) ou C (alternativas e consulta paga opcional).
2. Módulo `src/modules/nfce/uf/rj` com leitura por âncoras, validação (soma = total, chave, CNPJ, data) e fixtures sem dados pessoais.
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
