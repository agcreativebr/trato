## Sprint 1 — Filtros, Modal de Cartão, Checklists Avançados

Período: 1 sprint

### 1) Filtros do quadro
- Escopo: texto (título/descrição), etiquetas, membros, vencimento (atrasado/hoje/esta semana/sem data)
- UI: barra de filtros persistida em querystring; contagem de cartões filtrados
- API/DB: filtros no client (Supabase) com índices nas colunas chave; considerar materializar views se necessário
- DoD:
  - Combinação de filtros funciona sem recarregar (texto, etiquetas, membros, vencimento)
  - Estado preservado na URL
  - Desempenho aceitável com 1k+ cartões

### 2) Modal de cartão completo
- Escopo: descrição rich/markdown; comentários com menções; capa/preview; contadores consistentes
- UI: editor leve (tiptap/markdown), autocomplete para @menções; anexar por arrastar-soltar
- API/DB: index para busca de usuários; evento de notificação para menções
- DoD:
  - Menções notificam mencionados (in-app)
  - Edição inline sem perda de estado
  - Upload com feedback de progresso

### 3) Checklists avançados
- Escopo: progresso por checklist; vencimento por item; reordenação; “converter item em cartão”
- UI: componentes acessíveis e responsivos; destaque para itens vencidos
- API/DB: colunas para due por item; mutações atômicas
- DoD:
  - Progresso correto
  - Conversão cria cartão com link de retorno
  - Ordenação estável

### Riscos e Mitigações
- Performance de filtros: usar índices e paginação/virtualização
- Menções/Notificações: fila simples e debounce
- Editor rich: limitar extensões para manter leve


