- UI de membros no Dashboard: listar membros do workspace, adicionar por e-mail (usuário existente), alterar papel e remover.
## Changelog

### 2025-12-11
- Commit 9321f5c: Listas com scroll interno e altura responsiva; bloquear scroll global; preservar scroll horizontal do board; ajustes em `app/layout.tsx`, `BoardPageView`, `KanbanBoard`, `KanbanList`.
- Documentação inicial adicionada em `docs/`: STATUS, PARIDADE_TRELLO, ROADMAP, SPRINT_1, README (índice).

### 2025-12-12
- Filtros do quadro (texto, etiquetas, membros, vencimento) adicionados em `components/KanbanBoard.tsx` com barra de filtros e popovers.
- Atualização do mapeamento de membros por cartão para incluir `id` (suporte a filtro por membro).
- Menções no modal de cartão desativadas temporariamente até existir gestão de membros/convites (flag `ENABLE_MENTIONS=false`).
- Endpoint `GET/POST/PATCH/DELETE /api/workspaces/members` criado para gerenciar membros do workspace (lista/adicionar/atualizar papel/remover).


