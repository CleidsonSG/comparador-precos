# Skills recomendadas para o projeto

Fontes analisadas: `Minhas-Skills-e-Squads.pdf` (instalado no seu Claude Code), skills desta sessão e GitHub.

## Do seu Claude Code (PDF)
| Uso no projeto | Skill / pacote |
|---|---|
| Visual caprichado, fugindo do "cara de IA" | `skilld26`, `frontend-design` |
| Biblioteca de estilos, paletas, fontes e boas práticas de UX | `ui-ux-pro-max` |
| Animações e movimento | `skilld24` |
| Padrão visual de apps iPhone/Mac (útil para o scanner e o cartão de comparação) | `skilld25` |
| Design system | squad `design-squad` |
| Código limpo, React, PWA | `hzblj-skills` |
| Auditoria de acessibilidade, desempenho, UX e segurança do backend | `audit-suite` |
| Auditoria de segurança (RLS, créditos, consentimento) | squad `cybersecurity` |
| Equipe de desenvolvimento (analista, arquiteto, dev, QA) | squad `AIOX` |
| Configurar o Claude Code | squad `claude-code-mastery` |

Não se aplicam: skills de marketing/copy e a trilha "Clonar um app" (o projeto é original).

## Desta sessão
- `frontend-design`: direção visual
- `dataviz`: gráficos e KPIs (paleta validada, tooltips, acessibilidade)

## GitHub (a instalar no computador)
- `supabase/agent-skills`: `npx skills add supabase/agent-skills`
  - `supabase`: tarefas gerais com Supabase, segurança inline
  - `supabase-postgres-best-practices`: esquema, índices, RLS
- Plugin do Supabase para agentes: instala MCP e skills juntos

## Ordem sugerida de uso
1. `supabase` + `supabase-postgres-best-practices` ao aplicar e revisar o esquema
2. `ui-ux-pro-max` + `frontend-design` + `skilld26` ao construir as telas
3. `dataviz` nos gráficos
4. `audit-suite` + `cybersecurity` antes de liberar ao grupo de teste
