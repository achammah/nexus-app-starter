/* Mail seam — DEV transport is the store-backed OUTBOX (readable at /api/outbox so
   flows are testable with zero external services). Production: set SMTP_URL and
   replace `deliver` with a real transport (nodemailer/SES/vendor SDK) — the call
   sites and templates don't change, and /api/outbox disappears once SMTP_URL is set. */

import { env } from "./env.mjs";

export function sendMail(store, { to, subject, text, kind }) {
  if (env.SMTP_URL) {
    // swap point: real delivery goes here; until then we fail LOUD, never silent
    console.error(`[mail] SMTP_URL is set but no transport is wired — mail to ${to} (${kind}) NOT delivered. See docs/RECIPES.md.`);
    return null;
  }
  return store.outboxAdd({ to, subject, text, kind });
}

export const templates = {
  verify: (token) => ({
    subject: "Verify your email",
    text: `Confirm this address to finish setting up your account.\n\nOpen the app and follow the link, or use this token:\n${token}\n\nLink: /#/verify?token=${token}\n\nIf you didn't create an account, ignore this mail.`,
  }),
  reset: (token) => ({
    subject: "Reset your password",
    text: `Someone asked to reset the password for this address.\n\nToken:\n${token}\n\nLink: /#/reset?token=${token}\n\nThis link expires in 30 minutes. If it wasn't you, ignore this mail — your password is unchanged.`,
  }),
  resetDecoy: () => ({
    subject: "Password reset requested",
    text: `Someone asked to reset a password for this address, but no account exists for it.\n\nIf that was you, you may have signed up with a different address — or you can create an account.\n\nIf it wasn't you, ignore this mail.`,
  }),
  deleteConfirm: (token) => ({
    subject: "Confirm account deletion",
    text: `You asked to delete your account. This is NOT reversible.\n\nConfirm with this token:\n${token}\n\nLink: /#/delete?token=${token}\n\nThis link expires in 30 minutes. If it wasn't you, change your password now.`,
  }),
};
