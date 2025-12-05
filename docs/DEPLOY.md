# Deploy (Vercel + Supabase) — Zero custo

1) Suba o repositório no GitHub.
2) No Vercel, importe o repositório e selecione framework Next.js.
3) Em Settings > Environment Variables, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE` (apenas Server, marque como Encrypted)
4) Build & Deploy.
5) No Supabase, confira se o Realtime está habilitado (vide `supabase/README.md`).


