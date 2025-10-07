-- Create avatars storage bucket for user profile pictures
begin;

-- Create the storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own avatars
create policy if not exists "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own avatars
create policy if not exists "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own avatars
create policy if not exists "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to avatars
create policy if not exists "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

commit;
