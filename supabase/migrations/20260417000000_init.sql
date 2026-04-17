-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create chat_sessions table
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Chat',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create gns212_documents table for LangChain and vector embeddings
create table public.gns212_documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null,
  embedding vector(768) -- Google Gemini typically outputs 768 dimensions for text-embedding-004
);

-- RLS Settings
alter table public.chat_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.gns212_documents enable row level security;

-- Policies
create policy "Users can view own chat sessions"
  on public.chat_sessions for select
  using ( auth.uid() = user_id );

create policy "Users can insert own chat sessions"
  on public.chat_sessions for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own chat sessions"
  on public.chat_sessions for update
  using ( auth.uid() = user_id );

create policy "Users can delete own chat sessions"
  on public.chat_sessions for delete
  using ( auth.uid() = user_id );

create policy "Users can view messages in own sessions"
  on public.messages for select
  using (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );

create policy "Users can insert messages in own sessions"
  on public.messages for insert
  with check (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );

-- No update/delete on messages for simplicity, but could be added

-- gns212_documents is read-only for public (or authenticated users)
create policy "Anyone can read GNS212 documents"
  on public.gns212_documents for select
  to authenticated
  using ( true );

-- Function for similarity search
create or replace function match_gns212_documents(
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (gns212_documents.embedding <=> query_embedding) as similarity
  from gns212_documents
  where metadata @> filter
  order by gns212_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
