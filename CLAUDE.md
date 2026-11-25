# CLAUDE.md — Comparador de Preços de Supermercado

Web app (PWA) que importa NFC-e, guarda preços e compara com a próxima compra, inclusive entre mercados. Grupo de teste inicial: Rio de Janeiro (RJ).

## Regras do projeto
- **Custo zero por padrão.** Recursos pagos (OCR avançado, consulta avançada de nota) são opcionais, com aviso de custo uma única vez, aceite explícito e cancelamento em Configurações. Cobrança por **créditos pré-pagos**.
- **Nunca armazenar CPF ou nome do consumidor.** Nem em banco, logs de erro ou arquivos de teste.
- **Não contornar captcha nem bloqueio de IP** (sem proxies, sem trocar de IP, sem desligar verificação de certificado). O RJ bloqueia o IP do Supabase: ver `docs/RJ-ACESSO.md`.
- Se a leitura direta da SEFAZ não funcionar, usar as alternativas (XML/PDF, texto colado, manual, consulta paga opcional).
- **Vínculo de produto por mercado (CNPJ) + código interno da nota.** O GTIN é opcional; vínculo assistido entre código de barras e item, sempre com confirmação do usuário.
- **Validação no servidor** (funções do Supabase) para consentimento, saldo e limites antes de qualquer chamada paga.
- **Sem automações que alterem produção sozinhas.** Reparo do leitor: o agente propõe, o humano aprova.
- **Commit e push só com autorização do usuário, a cada vez.** Antes, mostrar o que mudou e a mensagem proposta e perguntar. Cada push publica o app (GitHub Pages). Vale também para revert.
- Publicação nas lojas (Play Store/App Store) está **fora do escopo** até o usuário pedir.

## Visual e frontend
Mobile-first, responsivo (360 a 1440 px), interativo, com estados de carregando/vazio/erro/sem internet, acessibilidade e modo escuro. Antes de entregar uma tela, conferir visualmente em celular e computador. Ver `docs/DESIGN.md`.

## Skills recomendadas
Ver `docs/SKILLS.md`.

## Estrutura
- `site/` protótipo visual (HTML único)
- `supabase/migrations/` esquema do banco com RLS
- `supabase/functions/` leitor NFC-e por UF, OCR avançado, créditos
- `src/modules/nfce/uf/` um módulo por estado (RJ primeiro)
- `src/modules/ocr/`, `src/modules/prices/`
- `tests/fixtures/nfce-rj/` páginas de exemplo **sem CPF e sem nome**
- `docs/` escopo, design, skills, próximos passos

## Leitura da NFC-e do RJ
A leitura direta pelo servidor foi bloqueada. Caminho gratuito: QR/chave, consulta oficial aberta no navegador do usuário, texto copiado ou PDF de volta ao app. Ver `docs/RJ-ACESSO.md`.
