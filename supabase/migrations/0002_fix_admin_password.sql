update public.users
set password_hash = '$2b$10$Te.XsoCRqDvBk462gYoLC.BCBgUbifAEj4GRpyMBMnhEa8/kt9ole',
    active = true,
    role = 'admin'
where username = 'admin';

insert into public.users (username, password_hash, full_name, role, active)
select 'admin', '$2b$10$Te.XsoCRqDvBk462gYoLC.BCBgUbifAEj4GRpyMBMnhEa8/kt9ole', 'מנהלת מערכת', 'admin', true
where not exists (select 1 from public.users where username = 'admin');
