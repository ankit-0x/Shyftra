// server/src/utils/emailTemplates.js
const APP = "Shyftra";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px;">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:28px;">
<tr><td style="font-size:20px;font-weight:700;color:#111;">${APP}</td></tr>
<tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">${esc(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#333;">${bodyHtml}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#888;">If you didn't expect this email you can safely ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (url, label) =>
  `<p style="margin:20px 0;"><a href="${esc(url)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;display:inline-block;">${esc(label)}</a></p>
<p style="font-size:12px;color:#666;">Or paste this link in your browser:<br>${esc(url)}</p>`;

export function verifyEmailTemplate({ name, url, hours }) {
  return {
    subject: `Verify your email for ${APP}`,
    text: `Hi ${name}, verify your email: ${url} (valid for ${hours} hours).`,
    html: layout("Verify your email", `Hi ${esc(name)},<br>Please confirm your email to activate your account. This link is valid for ${hours} hours.${button(url, "Verify email")}`),
  };
}

export function alreadyRegisteredTemplate({ name, loginUrl, resetUrl }) {
  return {
    subject: `You already have a ${APP} account`,
    text: `Someone tried to sign up with your email. Log in: ${loginUrl} or reset your password: ${resetUrl}`,
    html: layout("You already have an account", `Hi ${esc(name)},<br>Someone just tried to sign up with this email, but you already have an account.${button(loginUrl, "Log in")}<p>Forgot your password? <a href="${esc(resetUrl)}">Reset it here</a>.</p>`),
  };
}

export function resetPasswordTemplate({ name, url, minutes }) {
  return {
    subject: `Reset your ${APP} password`,
    text: `Hi ${name}, reset your password: ${url} (valid for ${minutes} minutes).`,
    html: layout("Reset your password", `Hi ${esc(name)},<br>We received a request to reset your password. This link is valid for ${minutes} minutes and works once.${button(url, "Reset password")}`),
  };
}

export function passwordChangedTemplate({ name, loginUrl }) {
  return {
    subject: `Your ${APP} password was changed`,
    text: `Hi ${name}, your password was just changed and all other devices were logged out. If this wasn't you, reset it now: ${loginUrl}`,
    html: layout("Password changed", `Hi ${esc(name)},<br>Your password was just changed and all other devices were signed out. <b>If this wasn't you</b>, reset your password immediately.${button(loginUrl, "Secure my account")}`),
  };
}

export function payoutOtpTemplate({ name, code, purposeText, minutes }) {
  return {
    subject: `${code} is your ${APP} verification code`,
    text: `Hi ${name}, your code for ${purposeText} is ${code}. It expires in ${minutes} minutes. Never share it.`,
    html: layout("Your verification code", `Hi ${esc(name)},<br>Use this code to confirm ${esc(purposeText)}:<p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:16px 0;">${esc(code)}</p>It expires in ${minutes} minutes. <b>Never share it with anyone</b> — ${APP} staff will never ask for it.`),
  };
}

export function payoutMethodChangedTemplate({ name, label, until, resetUrl }) {
  return {
    subject: `Payout method changed on your ${APP} account`,
    text: `Hi ${name}, your payout method was set to ${label}. Withdrawals are paused until ${until}. Not you? Reset your password now: ${resetUrl}`,
    html: layout("Payout method changed", `Hi ${esc(name)},<br>Your payout destination was set to <b>${esc(label)}</b>. For your safety, withdrawals to a new destination are paused until <b>${esc(until)}</b>.<p><b>Not you?</b> Reset your password and log out of all devices right away.</p>${button(resetUrl, "Secure my account")}`),
  };
}

export function emailChangeOtpTemplate({ name, code, minutes }) {
  return {
    subject: `${code} is your ${APP} email-change code`,
    text: `Hi ${name}, use ${code} to confirm this as the new email for your ${APP} account. It expires in ${minutes} minutes. Never share it.`,
    html: layout("Confirm your new email", `Hi ${esc(name)},<br>Use this code to confirm this address as the new email for your ${APP} account:<p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:16px 0;">${esc(code)}</p>It expires in ${minutes} minutes. <b>Never share it with anyone</b> — ${APP} staff will never ask for it.`),
  };
}

// Sent to the OLD address once the change is done, so the real owner finds out.
export function emailChangedNoticeTemplate({ name, newEmailMasked, supportEmail }) {
  const help = supportEmail ? ` Contact us right away at ${supportEmail}.` : " Contact support right away.";
  return {
    subject: `Your ${APP} email address was changed`,
    text: `Hi ${name}, the email on your ${APP} account was just changed to ${newEmailMasked}. All other devices were signed out. If this wasn't you,${help}`,
    html: layout("Your email address was changed", `Hi ${esc(name)},<br>The email on your ${APP} account was just changed to <b>${esc(newEmailMasked)}</b>, and all other devices were signed out.<p><b>If this wasn't you</b>,${esc(help)}</p>`),
  };
}

// Sent to an address someone tried to attach to a DIFFERENT account.
export function emailInUseNoticeTemplate({ name, resetUrl }) {
  return {
    subject: `Someone tried to use your email on ${APP}`,
    text: `Hi ${name}, someone tried to set your email address on another ${APP} account. Nothing changed. If you're worried, reset your password: ${resetUrl}`,
    html: layout("Someone used your email address", `Hi ${esc(name)},<br>Someone tried to set this email address on another ${APP} account. <b>Nothing was changed.</b>${button(resetUrl, "Reset my password")}`),
  };
}

export function payoutRequestedTemplate({ name, amount, label }) {
  return {
    subject: `Withdrawal of ₹${amount} requested`,
    text: `Hi ${name}, a withdrawal of ₹${amount} to ${label} was requested. Not you? Reset your password immediately.`,
    html: layout("Withdrawal requested", `Hi ${esc(name)},<br>A withdrawal of <b>₹${esc(amount)}</b> to <b>${esc(label)}</b> was requested from your account. If this wasn't you, reset your password immediately.`),
  };
}


// 🆕 Payout success — fired from webhook on payout.processed
export function payoutCompletedTemplate({ name, amount, label }) {
  return {
    subject: `Payout Successful — ₹${amount} on its way`,
    text: `Hi ${name}, your payout of ₹${amount} to ${label} has been successfully processed and is on its way to your bank account.`,
    html: layout(
      "Payout Successful",
      `Hi ${esc(name)},<br>Your payout of <b>₹${esc(amount)}</b> to <b>${esc(label)}</b> has been successfully processed and is on its way to your bank account.`,
    ),
  };
}

// 🆕 Payout failure — fired from webhook on payout.failed / payout.rejected / payout.reversed
export function payoutFailedTemplate({ name, amount, reason }) {
  const reasonLine = reason
    ? `<p><b>Reason:</b> ${esc(reason)}</p>`
    : "";
  return {
    subject: `Payout Failed — ₹${amount} refunded to wallet`,
    text: `Hi ${name}, your payout of ₹${amount} could not be completed.${reason ? ` Reason: ${reason}.` : ""} The amount has been refunded to your wallet.`,
    html: layout(
      "Payout Failed",
      `Hi ${esc(name)},<br>Your payout of <b>₹${esc(amount)}</b> could not be completed.${reasonLine}<p>The amount has been <b>refunded to your wallet</b> and is available for you to withdraw or use.</p>`,
    ),
  };
}