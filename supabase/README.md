# Supabase - Configuração (MVP)

1) Crie um projeto no Supabase (free).
2) Em Authentication > Providers, habilite Email com Magic Link.
3) Em Database, execute o SQL de `schema.sql`.
4) Em Realtime, habilite as tabelas: `lists`, `cards`, `card_labels`, `checklist_items`, `card_history`.
5) Em Storage, crie um bucket `attachments` (padrão privado).
6) Obtenha as credenciais:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE (apenas no servidor)
7) No Vercel/Local, configure as variáveis de ambiente acima.


