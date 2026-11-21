# Design — "Gôndola"

Conceito: o app fala a língua do mercado. O momento memorável é o **cartão de preço**, inspirado na etiqueta de gôndola: numeral grande, amarelo de etiqueta, selo de veredito. O resto fica quieto e legível.

## Cores
| Nome | Claro | Escuro | Uso |
|---|---|---|---|
| Papel | `#eef1f5` | `#0e141b` | fundo da página |
| Superfície | `#ffffff` | `#17202b` | cartões |
| Tinta | `#0f1b2d` | `#eaf0f7` | texto |
| Tinta 2 | `#51607a` | `#aab6c8` | texto secundário |
| Etiqueta | `#ffc93c` | `#ffc93c` | cartão de preço, foco principal |
| Barato | `#0b7a50` | `#2fbf86` | melhor preço (sempre com ícone e texto) |
| Caro | `#c43a31` | `#ff7b72` | preço acima do histórico (sempre com ícone e texto) |

Gráficos usam a paleta categórica validada da skill `dataviz` (azul, laranja, água), com legenda e rótulos diretos.

## Tipografia
Numerais de preço em fonte condensada (Barlow Condensed, com fallback do sistema) para lembrar etiqueta; texto em sans do sistema. Tabular nos valores que alinham.

## Layout
- Celular: barra inferior com 4 ações (Início, Escanear, Carrinho, Notas) e Configurações no topo.
- Computador: menu lateral, conteúdo em até 1100 px.
- Estados completos: carregando (skeleton), vazio, erro, sem internet.

## Regras
- Cor nunca é o único sinal: sempre ícone e texto.
- Alvos de toque de 44 px ou mais; foco visível; movimento reduzido respeitado.
- Movimento só em resposta a ação (abrir, confirmar) e no selo de "mais barato".
