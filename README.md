# Comparador de Preços de Supermercado

Web app (PWA) para cadastrar preços das compras de supermercado a partir da NFC-e e comparar com a próxima compra, inclusive entre mercados. Piloto: Rio de Janeiro (RJ).

## Status
Planejamento concluído; estrutura, banco e protótipo visual criados. O código do app ainda não foi iniciado.

## O que já existe
| Pasta | Conteúdo |
|---|---|
| `site/index.html` | Protótipo visual interativo (responsivo, modo escuro), com dados fictícios |
| `supabase/migrations/0001_init.sql` | Esquema do banco com RLS |
| `supabase/functions/` | Pastas das funções do servidor (leitor RJ, OCR avançado, créditos) |
| `src/modules/` | Módulos previstos: NFC-e por UF, OCR, preços |
| `docs/` | Escopo, design, skills e próximos passos |

## Ver o protótipo
Abra `site/index.html` no navegador (sem instalação).

## Continuar no computador (VS Code + Claude Code)
1. Clone o repositório e abra a pasta no VS Code.
2. Instale o Claude Code e abra a pasta: o `CLAUDE.md` carrega as regras do projeto.
3. Instale as skills de Supabase: `npx skills add supabase/agent-skills`.
4. Crie o projeto no Supabase, copie `.env.example` para `.env.local` e preencha.
5. Aplique a migração: `supabase db push` (ou cole `0001_init.sql` no SQL Editor).
6. Primeira tarefa: **verificação do RJ com cupom real** (ver `docs/PROXIMOS-PASSOS.md`).

## Stack prevista
Vite + React + TypeScript (PWA), Supabase (Postgres, Auth, Edge Functions), leitura de código de barras/QR no navegador, OCR no aparelho (A) com OCR em nuvem opcional (B).

## Fora do escopo por enquanto
Publicação na Play Store e App Store.
