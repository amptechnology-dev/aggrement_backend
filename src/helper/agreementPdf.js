require("dotenv").config();
const fs = require("fs");
const puppeteer = require("puppeteer-core");

// .env-এর CHROME_PATH আগে, না থাকলে common জায়গাগুলো দেখবে
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const findChrome = () => {
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Chrome not found. Checked: ${CHROME_CANDIDATES.join(" | ")}. Set CHROME_PATH in .env`,
    );
  }
  return found;
};

let browserPromise = null;

const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = Promise.resolve()
      .then(() =>
        puppeteer.launch({
          executablePath: findChrome(),
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }),
      )
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
};

const esc = (v) =>
  String(v ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const date = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const buildHtml = (a) => {
  const guardianLabel =
    a.tenant.guardianRelation === "HUSBAND" ? "Husband's name" : "Father's name";

  const scheduleRows = (a.schedule || [])
    .map(
      (p) => `<tr>
        <td>${p.period}</td>
        <td>${date(p.from)} - ${date(p.to)}</td>
        <td>${money(p.monthlyRent)}</td>
        <td>${p.increasePercent ? `+${p.increasePercent}%` : "-"}</td>
      </tr>`,
    )
    .join("");

  const terms = (a.terms || [])
    .map((t, i) => `<li><b>${i + 1}.</b> ${esc(t)}</li>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.55; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 4px; }
  .sub { text-align: center; color: #64748b; margin-bottom: 18px; }
  h3 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
  .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
  .val { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f8fafc; }
  ol { padding: 0; list-style: none; }
  li { margin-bottom: 6px; white-space: pre-line; }
  .sign { display: flex; justify-content: space-between; margin-top: 60px; }
  .sign div { width: 40%; border-top: 1px solid #334155; padding-top: 4px; text-align: center; }
</style>
</head>
<body>
  <h1>Rent Agreement</h1>
  <p class="sub">${esc(a.agreementNo)} | Dated ${date(a.agreementDate)}</p>

  <h3>Parties</h3>
  <div class="grid">
    <div><div class="label">Office</div><div class="val">${esc(a.office.name)}</div></div>
    <div><div class="label">Office address</div><div class="val">${esc(a.office.address)}</div></div>
    <div><div class="label">Tenant</div><div class="val">${esc(a.tenant.name)}</div></div>
    <div><div class="label">${guardianLabel}</div><div class="val">${esc(a.tenant.guardianName)}</div></div>
    <div><div class="label">Voter card no</div><div class="val">${esc(a.tenant.voterCardNo)}</div></div>
    <div><div class="label">Contact</div><div class="val">${esc(a.tenant.phone)} | ${esc(a.tenant.email)}</div></div>
    <div style="grid-column:1/-1"><div class="label">Tenant address</div><div class="val">${esc(a.tenant.address)}</div></div>
    <div><div class="label">Stall</div><div class="val">Stall ${esc(a.stall.stallNo)}</div></div>
    <div><div class="label">Market complex</div><div class="val">${esc(a.stall.propertyName)}</div></div>
    <div style="grid-column:1/-1"><div class="label">Market address</div><div class="val">${esc(a.stall.propertyAddress)}</div></div>
  </div>

  <h3>Rent and rules</h3>
  <div class="grid">
    <div><div class="label">Monthly rent (start)</div><div class="val">${money(a.monthlyRent)}</div></div>
    <div><div class="label">Deposit</div><div class="val">${money(a.depositAmount)}</div></div>
    <div><div class="label">Effective from</div><div class="val">${date(a.effectiveFrom)}</div></div>
    <div><div class="label">Valid till</div><div class="val">${date(a.endDate)} (${a.validityYears} years)</div></div>
    <div><div class="label">Rent increase</div><div class="val">${
      a.rentIncreaseEveryYears > 0 && a.rentIncreasePercent > 0
        ? `${a.rentIncreasePercent}% every ${a.rentIncreaseEveryYears} years`
        : "None"
    }</div></div>
    <div><div class="label">Late fine</div><div class="val">${money(a.lateFineAmountPerDay)} per day after the ${a.lateFineAfterDay}th of every month</div></div>
    <div><div class="label">Stall cannot be closed for</div><div class="val">${a.stallCannotCloseForDays} days</div></div>
    <div><div class="label">Notice period</div><div class="val">${a.noticePeriodMonths} month(s)</div></div>
  </div>

  ${
    scheduleRows
      ? `<h3>Rent schedule</h3>
  <table>
    <thead><tr><th>#</th><th>Period</th><th>Monthly rent</th><th>Increase</th></tr></thead>
    <tbody>${scheduleRows}</tbody>
  </table>`
      : ""
  }

  <h3>Terms and conditions</h3>
  ${terms ? `<ol>${terms}</ol>` : "<p>No additional terms.</p>"}

  <div class="sign">
    <div>Owner / Authorised signatory</div>
    <div>Tenant</div>
  </div>
</body>
</html>`;
};

/**
 * agreement DTO (toDto-র output, schedule সহ) -> PDF Buffer
 */
const generateAgreementPdf = async (agreement) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(agreement), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
};

module.exports = { generateAgreementPdf };