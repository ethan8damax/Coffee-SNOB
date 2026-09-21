# Sign-up emails via Resend (custom SMTP)

Supabase's built-in mailer is capped at a few emails/hour project-wide, so real sign-ups will hit
`429 over_email_send_rate_limit`. Route auth emails through Resend instead. The branded templates
already live in `supabase/templates/`; the logo they use is served from
`https://app.coffeesnobproject.com/email/snob-logo.png` (`apps/app/public/email/`).

## 1. Resend (about 10 min)
1. resend.com → sign up / log in → **Domains → Add domain** → `coffeesnobproject.com` (region: US East).
2. Resend shows DNS records (SPF/DKIM TXT, an MX on a `send.` subdomain). Add them at **GoDaddy**
   (the domain's nameservers are GoDaddy's, so Vercel can't add them). The root domain has no MX today,
   so nothing conflicts. Click **Verify** in Resend; it can take a few minutes.
3. **API Keys → Create API key** → permission "Sending access", domain `coffeesnobproject.com`. Copy it once.

## 2. Supabase → Authentication → SMTP Settings
Enable custom SMTP and enter (paste the API key yourself; nobody else needs to see it):

| Field | Value |
| --- | --- |
| Sender email | `hello@coffeesnobproject.com` |
| Sender name | `Coffee Snob` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

Then **Authentication → Rate Limits** → raise "emails sent per hour" (default 30 once custom SMTP is on;
the free Resend plan allows about 100/day, so ~30–60 is a sane cap until you upgrade).

## 3. Supabase → Authentication → Email Templates
Paste each HTML file as-is into the matching tab (they use Supabase's `{{ .ConfirmationURL }}` / `{{ .Token }}`
variables). Edit copy in `supabase/templates/generate.py`, run `python3 supabase/templates/generate.py`, re-paste.

| Supabase tab | Subject | File |
| --- | --- | --- |
| Confirm sign up | `Confirm your email for Coffee Snob` | `supabase/templates/confirm-signup.html` |
| Invite user | `You're invited to Coffee Snob` | `supabase/templates/invite-user.html` |
| Magic link | `Your Coffee Snob sign-in link` | `supabase/templates/magic-link.html` |
| Change email address | `Confirm your new Coffee Snob email` | `supabase/templates/change-email.html` |
| Reset password | `Reset your Coffee Snob password` | `supabase/templates/reset-password.html` |
| Reauthentication | `Your Coffee Snob code` | `supabase/templates/reauthentication.html` |

Only Confirm sign up and Reset password are used by v1; the rest are there so nothing ever goes out unbranded.

## 4. Test
Sign up with a fresh address at `https://app.coffeesnobproject.com/sign-up`. The email should arrive from
"Coffee Snob", show the SNOB wordmark, and the button should land on `/verified`. In Resend → Emails you
can see delivery status and bounces.

## Known follow-up
The reset-password flow still redirects to `coffeesnob://reset-password` (native deep link); on web that
link won't open the app. Wire a web reset screen before promoting password reset.
