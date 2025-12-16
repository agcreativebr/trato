## Status do Projeto

- Data: 2025-12-11 23:45:56 -03:00
- Branch: main
- Último commit: 9321f5c — feat(ui): listas com scroll interno e altura responsiva; bloquear scroll global e manter horizontal do board; ajustes em layout e página do board

### Ambiente
- Next.js 14, App Router
- Supabase (Auth, Postgres, Realtime, Storage)
- TailwindCSS

### Execução
- Dev: `npm run dev` (porta 3002)
- Variáveis (`.env`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE`

### Funcionalidades principais (hoje)
- Autenticação com link mágico (Supabase)
- Quadro tipo Kanban com listas/cartões
- DnD para reordenar/mover listas e cartões
- Filtros de quadro (texto, etiquetas, membros, vencimento)
- Capas, etiquetas, membros, contadores de anexos/comentários (parciais)
- Automações (gatilhos básicos de eventos)
- Arquivados: modal com busca/restauração/remoção

### Trabalho recente (UI/UX de listas)
- Scroll vertical dentro das listas (tela permanece fixa).
- Altura da lista responsiva ao conteúdo até o limite do board.
- Ajustes em `app/layout.tsx` e containers para bloquear scroll global e preservar horizontal do board.

### Principais lacunas para paridade com Trello
- Ver `PARIDADE_TRELLO.md` (gap analysis).

### Próximos passos (Sprint 1)
1) Modal de cartão completo (rich text/menções/capa)
2) Checklists avançados (progresso e vencimento por item)



