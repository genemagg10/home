-- HomeBase — private Storage bucket for forwarded-email attachments (and, later,
-- direct file uploads). Files are written/read by the server using the service
-- role, which bypasses Storage RLS, so no public policies are needed. Documents
-- reference the object via documents.source_url (the storage path).

insert into storage.buckets (id, name, public)
values ('inbox', 'inbox', false)
on conflict (id) do nothing;
