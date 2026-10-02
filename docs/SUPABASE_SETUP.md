# Supabase setup (one-time)

1. Create a project at supabase.com.
2. **Authentication → Sign In / Providers → Email:** keep Email enabled and **disable "Allow new users to sign up"** (single-admin app).
3. **Authentication → Users → Add user:** create the admin with email + password (tick "Auto confirm user").
4. **SQL editor:** run `supabase/migrations/0001_foundation.sql`, then `0002_transaction_totals.sql` (the Transactions summary needs it), then `0003_property_rental.sql` (Property rental needs it), then `0004_transport_masters.sql` and `0005_vehicle_investment.sql` (Transport needs both). Run them in order, once each.
5. Make that user the admin (replace the email):
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. **Project Settings → API:** copy the Project URL and the **anon/public** key into `.env` (copy `.env.example`). Never use the service-role key in the frontend.
7. `npm run dev`, sign in.

## Verify RLS (SQL editor, "run as" is not needed; this checks the logic)
- Signed-in admin: the app loads. Signed-in non-admin user: app shows "Not authorised".
- With the anon key and no session, `select * from customers` through the API must return nothing/permission denied.
