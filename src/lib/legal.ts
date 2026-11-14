import { getSettings } from "./settings";
import type { Brand } from "./brand";

export type LegalKey = "terms" | "privacy";

/** Plain starting points. Server owners are expected to edit these in Admin > Legal pages and add their own legal details. */
export function defaultLegal(key: LegalKey, b: Brand): string {
  const contact = b.supportEmail ? `Questions go to ${b.supportEmail}.` : "Contact the administrator of this server with questions.";
  if (key === "terms")
    return `# Terms of use

These terms apply to everyone who uses ${b.name} at ${b.host}. By creating an account or using a short link or page here, you agree to them.

# Your content

You are responsible for the links, pages and files you publish. Do not use ${b.name} for spam, phishing, malware, harassment, or anything illegal. We may disable links, pages or accounts that break these rules, with or without notice.

# Availability

This service is provided as is, without a promise of uptime. Links may stop working if the service is changed, moved or shut down.

# Accounts

Keep your password private. You can delete your account at any time from the account settings; this removes your links and pages.

# Contact

${contact}`;
  return `# Privacy

This page explains what ${b.name} at ${b.host} stores about you.

# What we store

Account details you give us: email address, username and a hashed password. The content you publish: links, pages and uploaded images.

# Visitor analytics

When someone opens a short link or a page, we record the country (when the hosting network provides it), device type, browser, referring website and time. IP addresses are never stored. A one-way hash that changes every day is used to count unique visitors, so a person cannot be followed from one day to the next. Requests from known bots are ignored.

# Cookies

We set a login cookie after you sign in and a theme cookie if you choose a light or dark appearance. There are no advertising or third-party tracking cookies.

# Email

We send messages that are part of the service: verification, password reset and security notices. Marketing email is only sent if you have agreed to it.

# Your rights

You can change or delete your data from your account settings. ${contact}`;
}

export async function getLegal(key: LegalKey, b: Brand): Promise<string> {
  const s = await getSettings();
  return s[`legal_${key}`]?.trim() || defaultLegal(key, b);
}
