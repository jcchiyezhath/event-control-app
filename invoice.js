import { db } from "./firebase-config.js";
import { APP_CONFIG } from "./app-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function invoiceSettingsRef(uid) {
  return doc(db, "users", uid, "settings", "invoice");
}

const elements = {
  businessName: document.querySelector("#business-name"),
  invoiceLogo: document.querySelector("#invoice-logo"),
  invoiceNumber: document.querySelector("#invoice-number"),
  statusMessage: document.querySelector("#invoice-status-message"),
  invoiceContent: document.querySelector("#invoice-content"),
  clientName: document.querySelector("#client-name"),
  eventTitle: document.querySelector("#event-title"),
  invoiceDate: document.querySelector("#invoice-date"),
  dueDate: document.querySelector("#due-date"),
  paymentDue: document.querySelector("#payment-due"),
  invoiceStatus: document.querySelector("#invoice-status"),
  lineItemsBody: document.querySelector("#line-items-body"),
  taxableSubtotalRow: document.querySelector("#taxable-subtotal-row"),
  taxableSubtotal: document.querySelector("#taxable-subtotal"),
  subtotal: document.querySelector("#subtotal"),
  total: document.querySelector("#total"),
  taxRateRow: document.querySelector("#tax-rate-row"),
  taxRate: document.querySelector("#tax-rate"),
  taxAmountRow: document.querySelector("#tax-amount-row"),
  taxAmount: document.querySelector("#tax-amount"),
  depositPaid: document.querySelector("#deposit-paid"),
  balanceDue: document.querySelector("#balance-due"),
  zellePaymentSection: document.querySelector("#zelle-payment-section"),
  zelleEmail: document.querySelector("#zelle-email"),
  zelleMemoInstruction: document.querySelector("#zelle-memo-instruction"),
  paymentFallback: document.querySelector("#payment-fallback"),
  paymentInstructions: document.querySelector("#payment-instructions"),
  invoiceNotes: document.querySelector("#invoice-notes"),
  invoiceFooterMessage: document.querySelector("#invoice-footer-message"),
  countryStateDisplay: document.querySelector("#country-state-display"),
  printBtn: document.querySelector("#print-btn"),
  copyZelleBtn: document.querySelector("#copy-zelle-btn"),
  copyLinkBtn: document.querySelector("#copy-link-btn"),
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "Not specified";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function setText(key, value) {
  elements[key].textContent = value || "Not specified";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundCurrency(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function getInvoiceLineItems(invoice = {}) {
  if (Array.isArray(invoice.lineItems) && invoice.lineItems.length) {
    return invoice.lineItems.map((item) => ({
      description: String(item.description || "").trim(),
      details: String(item.details || item.notes || "").trim(),
      quantity: toNumber(item.quantity || 1) || 1,
      unitPrice: roundCurrency(item.unitPrice),
      amount: roundCurrency(item.amount || toNumber(item.quantity || 1) * toNumber(item.unitPrice)),
      taxable: item.taxable !== false,
    }));
  }

  const subtotal = roundCurrency(invoice.subtotal);
  return [
    {
      description: invoice.eventTitle || "Event service",
      details: invoice.notes || "",
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal,
      taxable: true,
    },
  ];
}

function renderLineItems(invoice) {
  const lineItems = getInvoiceLineItems(invoice);
  elements.lineItemsBody.innerHTML = lineItems
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.description || "Item")}</strong>
            ${item.details ? `<span>${escapeHtml(item.details)}</span>` : ""}
          </td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
        </tr>
      `
    )
    .join("");
}

async function copyText(text, button, label) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  } catch {
    button.textContent = "Copy failed";
  }
}

function renderInvoice(invoice, paymentSettings = null) {
  const zelleEmail = (paymentSettings && paymentSettings.zelleEmail) || invoice.zelleEmail || "";
  const memoInstruction = (paymentSettings && paymentSettings.paymentInstructions) || invoice.paymentInstructions || APP_CONFIG.invoicePaymentInstructions || "";
  const businessName = invoice.businessName || APP_CONFIG.invoiceBusinessName;
  const showTax = invoice.showTaxOnInvoice !== false;
  const extraPaymentInstructions = "";

  document.title = `Invoice | ${businessName}`;
  setText("businessName", businessName);
  setText("invoiceNumber", invoice.invoiceNumber);
  setText("clientName", invoice.clientName);
  setText("eventTitle", invoice.eventTitle);
  setText("invoiceDate", formatDate(invoice.invoiceDate));
  setText("dueDate", formatDate(invoice.dueDate));
  setText("paymentDue", formatMoney(invoice.balanceDue));
  setText("invoiceStatus", invoice.status);
  setText("countryStateDisplay", invoice.countryStateDisplay || "United States");
  setText("taxableSubtotal", formatMoney(invoice.taxableSubtotal));
  setText("subtotal", formatMoney(invoice.subtotal));
  setText("total", formatMoney(invoice.total));
  setText("taxRate", `${Number(invoice.taxRate || 0)}%`);
  setText("taxAmount", formatMoney(invoice.taxAmount));
  setText("depositPaid", formatMoney(invoice.depositPaid));
  setText("balanceDue", formatMoney(invoice.balanceDue));
  const hasZelle = Boolean(zelleEmail);
  elements.zellePaymentSection.classList.toggle("hidden", !hasZelle);
  elements.paymentFallback.classList.toggle("hidden", hasZelle);
  elements.copyZelleBtn.classList.toggle("hidden", !hasZelle);
  if (hasZelle) {
    setText("zelleEmail", zelleEmail);
    setText("zelleMemoInstruction", memoInstruction);
  }
  elements.paymentInstructions.textContent = extraPaymentInstructions;
  elements.paymentInstructions.classList.toggle("hidden", !extraPaymentInstructions);
  setText("invoiceNotes", invoice.notes || "No notes.");
  setText("invoiceFooterMessage", invoice.invoiceFooterMessage || APP_CONFIG.invoiceFooterMessage || "");
  renderLineItems(invoice);

  [elements.taxRateRow, elements.taxAmountRow, elements.taxableSubtotalRow].forEach((element) => {
    element.classList.toggle("hidden", !showTax);
  });

  if (invoice.invoiceLogoUrl) {
    elements.invoiceLogo.src = invoice.invoiceLogoUrl;
    elements.invoiceLogo.classList.remove("hidden");
  }

  if (hasZelle) {
    elements.copyZelleBtn.addEventListener("click", () => copyText(zelleEmail, elements.copyZelleBtn, "Zelle Email Copied"));
  }
  elements.copyLinkBtn.addEventListener("click", () => copyText(window.location.href, elements.copyLinkBtn, "Invoice Link Copied"));
  elements.printBtn.addEventListener("click", () => window.print());

  elements.statusMessage.classList.add("hidden");
  elements.invoiceContent.classList.remove("hidden");
}

async function loadInvoice() {
  const token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    elements.statusMessage.textContent = "Missing invoice token.";
    return;
  }

  try {
    const snapshot = await getDoc(doc(db, "publicInvoices", token));
    if (!snapshot.exists()) {
      elements.statusMessage.textContent = "Invoice not found or link expired.";
      return;
    }

    const invoice = snapshot.data();
    let paymentSettings = null;
    if (invoice.ownerUid) {
      try {
        const settingsSnap = await getDoc(invoiceSettingsRef(invoice.ownerUid));
        if (settingsSnap.exists()) {
          paymentSettings = settingsSnap.data();
        }
      } catch {
        // Settings unavailable — invoice-stored values used as fallback
      }
    }

    renderInvoice(invoice, paymentSettings);
  } catch (error) {
    console.error("Unable to load invoice", error);
    elements.statusMessage.textContent = "Unable to load this invoice.";
  }
}

loadInvoice();
