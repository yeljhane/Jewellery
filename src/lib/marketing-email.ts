import nodemailer from "nodemailer";
import path from "node:path";

type CampaignEmail = {
  subject: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
};

type EmailRecipient = {
  name: string;
  email: string;
};

type DeliveryResult = {
  sentCount: number;
  failedCount: number;
  errors: string[];
};

function requiredSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass || !from) {
    throw new Error(
      "Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM to .env, then restart the app."
    );
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
    from,
  };
}

function messageHtml(body: string) {
  const escaped = body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  return escaped
    .split(/\r?\n/)
    .map((line) => (line ? `<p style="margin:0 0 12px">${line}</p>` : "<br>"))
    .join("");
}

function attachmentFor(campaign: CampaignEmail) {
  if (!campaign.attachmentUrl) return [];

  const publicRoot = path.resolve(process.cwd(), "public");
  const relativePath = campaign.attachmentUrl.replace(/^[/\\]+/, "");
  const filePath = path.resolve(publicRoot, relativePath);

  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("The campaign attachment path is invalid.");
  }

  return [
    {
      filename: campaign.attachmentName || path.basename(filePath),
      path: filePath,
      contentType: campaign.attachmentType || undefined,
    },
  ];
}

export async function deliverCampaignEmails({
  campaign,
  recipients,
  shopName,
}: {
  campaign: CampaignEmail;
  recipients: EmailRecipient[];
  shopName: string;
}): Promise<DeliveryResult> {
  const config = requiredSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  const attachments = attachmentFor(campaign);
  const errors: string[] = [];
  let sentCount = 0;
  let failedCount = 0;
  let nextRecipient = 0;

  async function worker() {
    while (nextRecipient < recipients.length) {
      const index = nextRecipient++;
      const recipient = recipients[index];

      try {
        await transporter.sendMail({
          from: { name: shopName, address: config.from },
          to: { name: recipient.name, address: recipient.email },
          subject: campaign.subject,
          text: campaign.body,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">${messageHtml(campaign.body)}</div>`,
          attachments,
        });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Unknown SMTP error";
        if (errors.length < 5) errors.push(`${recipient.email}: ${message}`);
      }
    }
  }

  try {
    const workerCount = Math.min(3, Math.max(1, recipients.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } finally {
    transporter.close();
  }

  return { sentCount, failedCount, errors };
}
