"""Regenerates every Supabase auth email template in this folder: python3 generate.py
Paste each output file into Supabase → Authentication → Email Templates (see docs/email-setup.md)."""
FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"
LINK = "{{ .ConfirmationURL }}"

def action_block(cta, code):
    if code:  # reauthentication: a one-time code instead of a button
        return (f'<div style="display:inline-block;background:#f0ecdf;border:1px solid #dcd7c8;border-radius:2px;padding:16px 22px;'
                f'font-family:{FONT};font-size:30px;line-height:32px;letter-spacing:8px;font-weight:800;color:#161310;">{{{{ .Token }}}}</div>')
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#4a1206;border-radius:2px;">'
            f'<a href="{LINK}" style="display:inline-block;padding:16px 28px;font-family:{FONT};font-size:12px;line-height:14px;letter-spacing:1.4px;'
            f'text-transform:uppercase;font-weight:800;color:#e9e4d0;text-decoration:none;">{cta}</a></td></tr></table>')

def fallback(code):
    if code:
        return ""
    return (f'<p style="margin:28px 0 0 0;font-family:{FONT};font-size:12.5px;line-height:19px;color:#8c8175;">Button not working? Paste this link into your browser:'
            f'<br><a href="{LINK}" style="color:#05616d;word-break:break-all;">{LINK}</a></p>')

def render(title, preheader, eyebrow, headline, body, cta, footer, code=False):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f0ecdf;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ecdf;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td style="padding:0 0 20px 4px;">
      <a href="https://app.coffeesnobproject.com" style="text-decoration:none;"><img src="https://app.coffeesnobproject.com/email/snob-logo.png" width="132" alt="Snob" style="display:block;border:0;height:auto;width:132px;"></a>
    </td></tr>
    <tr><td style="background:#faf8ef;border:1px solid #dcd7c8;border-radius:2px;padding:36px 32px 32px 32px;">
      <div style="font-family:{FONT};font-size:10.5px;line-height:14px;letter-spacing:1.4px;text-transform:uppercase;color:#c46a17;font-weight:700;">{eyebrow}</div>
      <h1 style="margin:14px 0 14px 0;font-family:{FONT};font-size:32px;line-height:36px;letter-spacing:-0.9px;font-weight:800;color:#161310;">{headline}</h1>
      <p style="margin:0 0 28px 0;font-family:{FONT};font-size:15px;line-height:23px;color:#4b423a;">{body}</p>
      {action_block(cta, code)}
      {fallback(code)}
    </td></tr>
    <tr><td style="padding:20px 4px 0 4px;font-family:{FONT};font-size:11px;line-height:17px;color:#8c8175;">
      <span style="letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:#4b423a;">Find coffee worth the detour</span><br>
      {footer}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""

TEMPLATES = {
    # Supabase name → (file, subject, kwargs)
    "confirm-signup.html": dict(title="Confirm your email", preheader="One tap and you're in. Then go find somewhere worth the trip.",
        eyebrow="Welcome to Snob", headline="Confirm your email.",
        body="You're one tap from logging your first cup. Confirm this address and start rating the shops that are worth the detour.",
        cta="Confirm email",
        footer="You're getting this because someone signed up for Coffee Snob with this address. If that wasn't you, ignore this email and nothing happens."),
    "invite-user.html": dict(title="You're invited to Coffee Snob", preheader="Someone saved you a seat. Accept to join Coffee Snob.",
        eyebrow="You're invited", headline="Come rate coffee with us.",
        body="You've been invited to Coffee Snob, where people log the shops that are actually worth the detour. Accept the invite to set up your account.",
        cta="Accept invite",
        footer="If you weren't expecting this invite, ignore this email."),
    "magic-link.html": dict(title="Your Coffee Snob sign-in link", preheader="Tap to sign in. No password needed.",
        eyebrow="Sign in", headline="Your sign-in link.",
        body="Tap below to sign in to Coffee Snob. The link works once and expires soon.",
        cta="Sign in",
        footer="If you didn't ask to sign in, ignore this email. Nobody gets in without this link."),
    "change-email.html": dict(title="Confirm your new email", preheader="Confirm the new address for your Coffee Snob account.",
        eyebrow="Email change", headline="Confirm your new email.",
        body="You asked to change the email on your Coffee Snob account from {{ .Email }} to {{ .NewEmail }}. Confirm to make the switch.",
        cta="Confirm new email",
        footer="If you didn't ask for this, ignore this email and your address stays as it is."),
    "reset-password.html": dict(title="Reset your password", preheader="Use this link to choose a new Coffee Snob password.",
        eyebrow="Password reset", headline="Reset your password.",
        body="Someone asked to reset the password for this Coffee Snob account. Tap below to choose a new one. The link works once and expires soon.",
        cta="Choose a new password",
        footer="If you didn't ask for this, ignore this email. Your password stays as it is."),
    "reauthentication.html": dict(title="Your Coffee Snob code", preheader="Your one-time code to confirm it's you.",
        eyebrow="Confirm it's you", headline="Your one-time code.",
        body="Enter this code in Coffee Snob to confirm the change you're making. It expires soon.",
        cta="", code=True,
        footer="If you didn't ask for this, ignore this email and consider changing your password."),
}

if __name__ == "__main__":
    for name, kw in TEMPLATES.items():
        open(name, "w").write(render(**kw))
        print("wrote", name)
