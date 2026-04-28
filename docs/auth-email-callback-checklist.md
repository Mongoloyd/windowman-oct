# Auth Email Callback Checklist

Manual Supabase dashboard settings to verify for admin reset, partner reset, and partner invite links:

1. Site URL matches the production domain.
2. Additional Redirect URLs include:
   - production `/admin/reset-password`
   - production `/partner/reset-password`
   - production `/partner/accept-invite`
   - Lovable preview origins used for testing
3. Auth email templates use Supabase's current action/confirmation URL variable, not a stale hardcoded domain.
4. Partner invite emails or operator-shared invite links preserve the application invitation token (`token` or `invite_token`) when sending users to `/partner/accept-invite`.

Do not hardcode preview URLs in application code; configure them in Supabase Auth redirect settings.
