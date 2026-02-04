create table if not exists webhook_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    payload jsonb,
    instance_id text,
    event_type text,
    status text
);

alter table webhook_logs enable row level security;
create policy "Allow public insert" on webhook_logs for insert with check (true);
create policy "Allow public select" on webhook_logs for select using (true);
