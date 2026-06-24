import { auth, db, storage } from "./firebase-config.js";
import { APP_CONFIG } from "./app-config.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDownloadURL,
  ref as storageRef,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const pageCopy = {
    dashboard: "Live event control for phone and laptop.",
    program: "Running order, status, and cue tracking.",
    "program-planner": "Client-submitted activities and suggested timeline.",
    songs: "Files, approvals, and backup readiness.",
    checklist: "Fast setup checks grouped by category.",
    notes: "Urgent updates and live reminders.",
    finance: "Invoices, expenses, and year-end tax summary.",
    "audio-tools": "Convert your own audio/video files to MP3 or WAV",
  };

  const pageTitles = {
    "audio-tools": "Aviyal Audio Converter",
  };

  const checklistCategories = [
    "Sound Gear",
    "Cables",
    "Microphones",
    "Playback",
    "Power",
    "Backup",
    "Miscellaneous",
  ];

  const eventTypes = ["Program", "DJ", "Birthday", "Wedding", "Other"];
  const selectedEventStoragePrefix = "event-control-selected-event";
  const defaultInvoiceSettings = {
    invoiceBusinessName: APP_CONFIG.invoiceBusinessName || "Event Services",
    invoiceLogoUrl: "",
    defaultTaxRate: 0,
    showTaxOnInvoice: true,
    zelleEmail: APP_CONFIG.invoiceZelleEmail || "",
    paymentInstructions: APP_CONFIG.invoicePaymentInstructions || "",
    invoiceFooterMessage: APP_CONFIG.invoiceFooterMessage || "",
    defaultDueDays: 14,
    countryStateDisplay: "United States",
  };

  const state = {
    user: null,
    activeEventId: null,
    activeEvent: null,
    events: [],
    program: [],
    songs: [],
    checklist: [],
    notes: [],
    invoices: [],
    expenses: [],
    songRequests: [],
    plannerActivities: [],
    plannerUploads: [],
    invoiceSettings: { ...defaultInvoiceSettings },
    filters: {
      programSearch: "",
      programStatus: "all",
      songsSearch: "",
      songsStatus: "all",
      checklistStatus: "all",
      notesType: "all",
      financeYear: "all",
    },
    unsubscribers: {
      activeMeta: null,
      events: null,
      activeEvent: null,
      program: null,
      songs: null,
      checklist: null,
      notes: null,
      invoices: null,
      expenses: null,
      songRequests: null,
      plannerActivities: null,
      plannerUploads: null,
      invoiceSettings: null,
    },
    dragProgramId: null,
    dragPlannerActivityId: null,
    currentTab: "dashboard",
    mobileMenuOpen: false,
    detailsOpen: {
      program: {},
      songs: {},
    },
    openMenu: {
      section: null,
      id: null,
    },
    dashboardSummaryOpen: false,
    undo: {
      program: null,
      songs: null,
      checklist: null,
      notes: null,
    },
    modal: {
      entity: null,
      mode: null,
      itemId: null,
    },
  };

  const elements = {
    appName: document.querySelector("#app-name"),
    appTagline: document.querySelector("#app-tagline"),
    email: document.querySelector("#email"),
    password: document.querySelector("#password"),
    forgotPasswordBtn: document.querySelector("#forgot-password-btn"),
    createAccountBtn: document.querySelector("#create-account-btn"),
    signInBtn: document.querySelector("#sign-in-btn"),
    signOutBtn: document.querySelector("#sign-out-btn"),
    authBadge: document.querySelector("#auth-badge"),
    authMessage: document.querySelector("#auth-message"),
    userEmail: document.querySelector("#user-email"),
    statusDisplay: document.querySelector("#status-display"),
    liveSyncPill: document.querySelector("#live-sync-pill"),
    eventSyncBadge: document.querySelector("#event-sync-badge"),
    pageTitle: document.querySelector("#page-title"),
    pageSubtitle: document.querySelector("#page-subtitle"),
    activeEventTitle: document.querySelector("#active-event-title"),
    activeEventUpdated: document.querySelector("#active-event-updated"),
    activeEventTitleInput: document.querySelector("#active-event-title-input"),
    eventSelector: document.querySelector("#event-selector"),
    renameEventBtn: document.querySelector("#rename-event-btn"),
    newEventBtn: document.querySelector("#new-event-btn"),
    deleteEventBtn: document.querySelector("#delete-event-btn"),
    editEventBtn: document.querySelector("#edit-event-btn"),
    addDjTemplateBtn: document.querySelector("#add-dj-template-btn"),
    dashboardNewEventBtn: document.querySelector("#dashboard-new-event-btn"),
    dashboardEventTitle: document.querySelector("#dashboard-event-title"),
    dashboardEventDate: document.querySelector("#dashboard-event-date"),
    dashboardEventType: document.querySelector("#dashboard-event-type"),
    dashboardProgramCount: document.querySelector("#dashboard-program-count"),
    dashboardPlannerCount: document.querySelector("#dashboard-planner-count"),
    dashboardSongCount: document.querySelector("#dashboard-song-count"),
    dashboardMissingSongs: document.querySelector("#dashboard-missing-songs"),
    dashboardIncompleteChecklist: document.querySelector("#dashboard-incomplete-checklist"),
    dashboardNotesCount: document.querySelector("#dashboard-notes-count"),
    dashboardLastUpdated: document.querySelector("#dashboard-last-updated"),
    dashboardReadyProgram: document.querySelector("#dashboard-ready-program"),
    dashboardDoneProgram: document.querySelector("#dashboard-done-program"),
    dashboardApprovedSongs: document.querySelector("#dashboard-approved-songs"),
    dashboardPinnedNotes: document.querySelector("#dashboard-pinned-notes"),
    dashboardDetailsToggle: document.querySelector("#dashboard-details-toggle"),
    dashboardSummaryDetails: document.querySelector("#dashboard-summary-details"),
    quickAddProgram: document.querySelector("#quick-add-program"),
    quickAddSong: document.querySelector("#quick-add-song"),
    quickAddChecklist: document.querySelector("#quick-add-checklist"),
    quickAddNote: document.querySelector("#quick-add-note"),
    programList: document.querySelector("#program-list"),
    songsList: document.querySelector("#songs-list"),
    checklistList: document.querySelector("#checklist-list"),
    notesList: document.querySelector("#notes-list"),
    invoicesList: document.querySelector("#invoices-list"),
    expensesList: document.querySelector("#expenses-list"),
    programSearch: document.querySelector("#program-search"),
    programFilter: document.querySelector("#program-filter"),
    songsSearch: document.querySelector("#songs-search"),
    songsFilter: document.querySelector("#songs-filter"),
    checklistFilter: document.querySelector("#checklist-filter"),
    notesFilter: document.querySelector("#notes-filter"),
    financeYearFilter: document.querySelector("#finance-year-filter"),
    financePaidIncome: document.querySelector("#finance-paid-income"),
    financeUnpaidInvoices: document.querySelector("#finance-unpaid-invoices"),
    financeTotalExpenses: document.querySelector("#finance-total-expenses"),
    financeDeductibleExpenses: document.querySelector("#finance-deductible-expenses"),
    financeEstimatedProfit: document.querySelector("#finance-estimated-profit"),
    addProgramBtn: document.querySelector("#add-program-btn"),
    programUndoBtn: document.querySelector("#program-undo-btn"),
    addSongBtn: document.querySelector("#add-song-btn"),
    songsUndoBtn: document.querySelector("#songs-undo-btn"),
    addChecklistBtn: document.querySelector("#add-checklist-btn"),
    checklistUndoBtn: document.querySelector("#checklist-undo-btn"),
    addNoteBtn: document.querySelector("#add-note-btn"),
    notesUndoBtn: document.querySelector("#notes-undo-btn"),
    addInvoiceBtn: document.querySelector("#add-invoice-btn"),
    addExpenseBtn: document.querySelector("#add-expense-btn"),
    exportInvoicesCsvBtn: document.querySelector("#export-invoices-csv-btn"),
    exportExpensesCsvBtn: document.querySelector("#export-expenses-csv-btn"),
    invoiceSettingsForm: document.querySelector("#invoice-settings-form"),
    invoiceSettingsStatus: document.querySelector("#invoice-settings-status"),
    createRequestLinkBtn: document.querySelector("#create-request-link-btn"),
    copyRequestLinkBtn: document.querySelector("#copy-request-link-btn"),
    downloadRequestQrBtn: document.querySelector("#download-request-qr-btn"),
    openRequestPageBtn: document.querySelector("#open-request-page-btn"),
    requestCountBadge: document.querySelector("#request-count-badge"),
    requestLinkPanel: document.querySelector("#request-link-panel"),
    requestLinkOutput: document.querySelector("#request-link-output"),
    requestQrCode: document.querySelector("#request-qr-code"),
    songRequestsList: document.querySelector("#song-requests-list"),
    createPlannerLinkBtn: document.querySelector("#create-planner-link-btn"),
    copyPlannerLinkBtn: document.querySelector("#copy-planner-link-btn"),
    downloadPlannerQrBtn: document.querySelector("#download-planner-qr-btn"),
    openPlannerPageBtn: document.querySelector("#open-planner-page-btn"),
    plannerCountBadge: document.querySelector("#planner-count-badge"),
    plannerLinkPanel: document.querySelector("#planner-link-panel"),
    plannerLinkOutput: document.querySelector("#planner-link-output"),
    plannerQrCode: document.querySelector("#planner-qr-code"),
    plannerActivitiesList: document.querySelector("#planner-activities-list"),
    plannerTimelineList: document.querySelector("#planner-timeline-list"),
    plannerUploadsList: document.querySelector("#planner-uploads-list"),
    plannerUploadCountBadge: document.querySelector("#planner-upload-count-badge"),
    tabButtons: document.querySelectorAll("[data-tab]"),
    pages: document.querySelectorAll(".page"),
    mobileMenuButton: document.querySelector("#mobile-menu-button"),
    mobileMenuCloseBtn: document.querySelector("#mobile-menu-close-btn"),
    mobileNavOverlay: document.querySelector("#mobile-nav-overlay"),
    modalOverlay: document.querySelector("#modal-overlay"),
    modalTitle: document.querySelector("#modal-title"),
    modalCloseBtn: document.querySelector("#modal-close-btn"),
    itemForm: document.querySelector("#item-form"),
    toastContainer: document.querySelector("#toast-container"),
  };

  function applyAppBranding() {
    document.title = APP_CONFIG.appName;
    if (elements.appName) elements.appName.textContent = APP_CONFIG.appName;
    if (elements.appTagline) elements.appTagline.textContent = APP_CONFIG.tagline;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatDate(dateValue) {
    if (!dateValue?.toDate) return "Just now";
    return dateValue.toDate().toLocaleString();
  }

  function formatMoney(value) {
    const numberValue = Number(value || 0);
    return numberValue.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
  }

  function toNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  function addDaysToDateInput(dateValue, days) {
    const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + Math.max(0, Math.round(toNumber(days))));
    return date.toISOString().slice(0, 10);
  }

  function toDateInputValue(dateValue) {
    if (!dateValue) return "";

    if (typeof dateValue === "string") {
      return dateValue.slice(0, 10);
    }

    if (dateValue.toDate) {
      return dateValue.toDate().toISOString().slice(0, 10);
    }

    return "";
  }

  function normalizeInvoiceSettings(settings = {}) {
    return {
      ...defaultInvoiceSettings,
      ...settings,
      invoiceBusinessName: String(settings.invoiceBusinessName || defaultInvoiceSettings.invoiceBusinessName).trim(),
      invoiceLogoUrl: String(settings.invoiceLogoUrl || "").trim(),
      defaultTaxRate: toNumber(settings.defaultTaxRate),
      showTaxOnInvoice: settings.showTaxOnInvoice !== false,
      zelleEmail: String(settings.zelleEmail || defaultInvoiceSettings.zelleEmail).trim(),
      paymentInstructions: String(settings.paymentInstructions || defaultInvoiceSettings.paymentInstructions).trim(),
      invoiceFooterMessage: String(settings.invoiceFooterMessage || defaultInvoiceSettings.invoiceFooterMessage).trim(),
      defaultDueDays: Math.max(
        0,
        Math.round(toNumber(settings.defaultDueDays ?? defaultInvoiceSettings.defaultDueDays))
      ),
      countryStateDisplay: String(settings.countryStateDisplay || defaultInvoiceSettings.countryStateDisplay).trim(),
    };
  }

  function invoicePaymentInstructions(settings = state.invoiceSettings) {
    return normalizeInvoiceSettings(settings).paymentInstructions;
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
    if (subtotal > 0) {
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

    return [
      {
        description: "",
        details: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        taxable: true,
      },
    ];
  }

  function calculateInvoiceTotals(lineItems, taxRate, depositPaid, showTax = true) {
    const subtotal = roundCurrency(lineItems.reduce((sum, item) => sum + roundCurrency(item.amount), 0));
    const taxableSubtotal = roundCurrency(
      lineItems.filter((item) => item.taxable).reduce((sum, item) => sum + roundCurrency(item.amount), 0)
    );
    const taxAmount = showTax ? roundCurrency(taxableSubtotal * (toNumber(taxRate) / 100)) : 0;
    const total = roundCurrency(subtotal + taxAmount);
    const balanceDue = roundCurrency(Math.max(total - roundCurrency(depositPaid), 0));
    return { subtotal, taxableSubtotal, taxAmount, total, balanceDue };
  }

  function timestampMillis(dateValue) {
    if (dateValue?.toDate) return dateValue.toDate().getTime();
    if (typeof dateValue === "string") return Date.parse(dateValue) || 0;
    return 0;
  }

  function getYearFromDateValue(dateValue) {
    const inputValue = toDateInputValue(dateValue);
    return inputValue ? inputValue.slice(0, 4) : "";
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function makePublicToken() {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(18);
      window.crypto.getRandomValues(bytes);
      return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    return makeId("invoice").replaceAll("-", "");
  }

  function makeRequestToken() {
    return makePublicToken();
  }

  function makeInvoiceNumber() {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return `INV-${datePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function cloneItem(item) {
    return item ? { ...item } : null;
  }

  function getSongStatus(item) {
    if (!item?.fileReceived) return "file missing";
    if (item.finalApproved) return "good";
    return "issue";
  }

  function normalizeRequestStatus(value) {
    const status = String(value || "New").trim();
    return ["New", "Accepted", "Played", "Skipped"].includes(status) ? status : "New";
  }

  function statusClass(value) {
    return normalizeRequestStatus(value).toLowerCase();
  }

  function normalizeSongPayload(payload) {
    return {
      ...payload,
      songStatus: getSongStatus(payload),
    };
  }

  function closeOpenMenu() {
    state.openMenu = {
      section: null,
      id: null,
    };
  }

  function toggleMenu(section, id) {
    if (state.openMenu.section === section && state.openMenu.id === id) {
      closeOpenMenu();
      return;
    }

    state.openMenu = { section, id };
  }

  function isMenuOpen(section, id) {
    return state.openMenu.section === section && state.openMenu.id === id;
  }

  function toggleDetails(section, id) {
    state.detailsOpen[section][id] = !state.detailsOpen[section][id];
  }

  function isDetailsOpen(section, id) {
    return Boolean(state.detailsOpen[section]?.[id]);
  }

  function setUndoEntry(section, entry) {
    state.undo[section] = entry;
    renderUndoButtons();
  }

  function clearUndoEntry(section) {
    state.undo[section] = null;
    renderUndoButtons();
  }

  function renderUndoButtons() {
    const buttonMap = {
      program: elements.programUndoBtn,
      songs: elements.songsUndoBtn,
      checklist: elements.checklistUndoBtn,
      notes: elements.notesUndoBtn,
    };

    Object.entries(buttonMap).forEach(([section, button]) => {
      if (!button) return;
      const entry = state.undo[section];
      button.disabled = !entry;
      button.textContent = entry ? `Undo ${entry.label}` : "Undo";
    });
  }

  function renderDashboardSummary() {
    elements.dashboardSummaryDetails.classList.toggle("hidden", !state.dashboardSummaryOpen);
    elements.dashboardDetailsToggle.setAttribute("aria-expanded", String(state.dashboardSummaryOpen));
    elements.dashboardDetailsToggle.textContent = state.dashboardSummaryOpen ? "Hide Details" : "Details";
  }

  function showToast(message, kind = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2800);
  }

  function showMessage(message, isError = false) {
    elements.authMessage.textContent = message;
    elements.authMessage.classList.toggle("error-text", isError);
    elements.authMessage.classList.toggle("muted", !isError);
  }

  function setSyncState(label, badgeClass = "badge-muted") {
    elements.liveSyncPill.textContent = label;
    elements.eventSyncBadge.textContent = label;
    elements.eventSyncBadge.className = `badge ${badgeClass}`;
  }

  function mapFirebaseError(error) {
    if (!error?.code) {
      if (error?.message) return error.message;
      try {
        return JSON.stringify(error);
      } catch {
        return "Something went wrong.";
      }
    }

    const knownErrors = {
      "auth/api-key-not-valid":
        "Firebase API key is not valid for this project. Open firebase-config.js and paste the exact Web App config from Firebase Console.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "That email is already registered.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/missing-password": "Enter a password.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "permission-denied": "Firestore permission denied. Check your Firestore security rules.",
    };

    return knownErrors[error.code] || error.message;
  }

  function getCredentials() {
    return {
      email: elements.email.value.trim(),
      password: elements.password.value,
    };
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    closeOpenMenu();
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    elements.pageTitle.textContent =
      pageTitles[tabId] || activeButton?.textContent || tabId.charAt(0).toUpperCase() + tabId.slice(1);
    elements.pageSubtitle.textContent = pageCopy[tabId] || "";

    elements.tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabId);
    });

    elements.pages.forEach((page) => {
      page.classList.toggle("active", page.id === tabId);
    });

    closeMobileMenu();
  }

  function openMobileMenu() {
    if (!state.user) return;
    state.mobileMenuOpen = true;
    elements.mobileNavOverlay.classList.remove("hidden");
    elements.mobileNavOverlay.setAttribute("aria-hidden", "false");
    elements.mobileMenuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
  }

  function closeMobileMenu() {
    state.mobileMenuOpen = false;
    elements.mobileNavOverlay.classList.add("hidden");
    elements.mobileNavOverlay.setAttribute("aria-hidden", "true");
    elements.mobileMenuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  function clearCollectionsState() {
    state.program = [];
    state.songs = [];
    state.checklist = [];
    state.notes = [];
    state.invoices = [];
    state.expenses = [];
    state.songRequests = [];
    state.plannerActivities = [];
    state.plannerUploads = [];
    state.detailsOpen.program = {};
    state.detailsOpen.songs = {};
    closeOpenMenu();
  }

  function clearRenderedData() {
    clearCollectionsState();
    state.activeEvent = null;
    state.activeEventId = null;
    state.events = [];
    state.invoiceSettings = { ...defaultInvoiceSettings };
    state.undo.program = null;
    state.undo.songs = null;
    state.undo.checklist = null;
    state.undo.notes = null;
    elements.activeEventTitle.textContent = "Not loaded";
    elements.activeEventUpdated.textContent = "No event selected";
    elements.activeEventTitleInput.value = "";
    renderEventSelector();
    renderDashboard();
    renderProgram();
    renderSongs();
    renderChecklist();
    renderNotes();
    renderFinance();
    renderSongRequests();
    renderPlanner();
    renderUndoButtons();
  }

  function setSignedOutUi() {
    elements.authBadge.textContent = "Signed out";
    elements.authBadge.className = "badge badge-muted";
    elements.statusDisplay.textContent = "Signed out";
    elements.userEmail.textContent = "Not signed in";
    elements.signOutBtn.classList.add("hidden");
    elements.mobileMenuButton.classList.add("hidden");
    elements.createAccountBtn.classList.remove("hidden");
    elements.signInBtn.classList.remove("hidden");
    setSyncState("Offline", "badge-muted");
    clearRenderedData();
    closeMobileMenu();
    closeModal();
    showMessage("Enter your Firebase email and password to connect.");
  }

  function setSignedInUi(user) {
    elements.authBadge.textContent = "Signed in";
    elements.authBadge.className = "badge badge-success";
    elements.statusDisplay.textContent = "Signed in";
    elements.userEmail.textContent = user.email || "Signed in";
    elements.signOutBtn.classList.remove("hidden");
    elements.mobileMenuButton.classList.remove("hidden");
    elements.createAccountBtn.classList.add("hidden");
    elements.signInBtn.classList.add("hidden");
    setSyncState("Connecting", "badge-live");
    showMessage("Firestore connected.");
  }

  function unsubscribeAll() {
    Object.keys(state.unsubscribers).forEach((key) => {
      if (state.unsubscribers[key]) {
        state.unsubscribers[key]();
        state.unsubscribers[key] = null;
      }
    });
  }

  function userMetaRef(uid) {
    return doc(db, "users", uid, "meta", "activeEvent");
  }

  function invoiceSettingsRef(uid) {
    return doc(db, "users", uid, "settings", "invoice");
  }

  function eventsCollectionRef(uid) {
    return collection(db, "users", uid, "events");
  }

  function eventRef(uid, eventId) {
    return doc(db, "users", uid, "events", eventId);
  }

  function collectionRef(uid, eventId, name) {
    return collection(db, "users", uid, "events", eventId, name);
  }

  function publicEventRef(eventId) {
    return doc(db, "events", eventId);
  }

  function publicSongRequestsRef(eventId) {
    return collection(db, "events", eventId, "songRequests");
  }

  function publicPlannerActivitiesRef(eventId) {
    return collection(db, "events", eventId, "plannerActivities");
  }

  function publicUploadsRef(eventId) {
    return collection(db, "events", eventId, "uploads");
  }

  function publicInvoiceRef(token) {
    return doc(db, "publicInvoices", token);
  }

  function requestPageUrl(eventId, token) {
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}request.html?event=${encodeURIComponent(eventId)}&token=${encodeURIComponent(token)}`;
  }

  function plannerPageUrl(eventId, token) {
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}planner.html?event=${encodeURIComponent(eventId)}&token=${encodeURIComponent(token)}`;
  }

  function qrCodeUrl(value, size = 240) {
    const encodedData = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&margin=12&data=${encodedData}`;
  }

  async function touchActiveEvent() {
    if (!state.user || !state.activeEventId) return;

    await updateDoc(eventRef(state.user.uid, state.activeEventId), {
      updatedAt: serverTimestamp(),
    });
  }

  function selectedEventStorageKey(uid) {
    return `${selectedEventStoragePrefix}:${uid}`;
  }

  function getStoredActiveEventId(uid) {
    try {
      return window.localStorage.getItem(selectedEventStorageKey(uid));
    } catch {
      return null;
    }
  }

  function rememberActiveEventId(uid, eventId) {
    try {
      window.localStorage.setItem(selectedEventStorageKey(uid), eventId);
    } catch {
      // The app can still run if localStorage is unavailable.
    }
  }

  function renderEventSelector() {
    if (!elements.eventSelector) return;

    const options = state.events.length
      ? state.events
          .map((eventItem) => {
            const dateText = toDateInputValue(eventItem.eventDate);
            const label = dateText ? `${eventItem.title || "Untitled Event"} · ${dateText}` : eventItem.title || "Untitled Event";
            return `<option value="${escapeHtml(eventItem.id)}" ${eventItem.id === state.activeEventId ? "selected" : ""}>${escapeHtml(label)}</option>`;
          })
          .join("")
      : '<option value="">No events yet</option>';

    elements.eventSelector.innerHTML = options;
    elements.eventSelector.value = state.activeEventId || "";
    elements.eventSelector.disabled = !state.user || !state.events.length;
  }

  function renderDashboard() {
    const activeTitle = state.activeEvent?.title || "None";
    const lastUpdated = state.activeEvent?.updatedAt ? formatDate(state.activeEvent.updatedAt) : "Not available";
    const missingSongs = state.songs.filter((item) => !item.fileReceived).length;
    const incompleteChecklist = state.checklist.filter((item) => !item.checked).length;
    const readyProgram = state.program.filter((item) => item.status === "ready").length;
    const doneProgram = state.program.filter((item) => item.status === "done").length;
    const approvedSongs = state.songs.filter((item) => item.finalApproved).length;
    const pinnedNotes = state.notes.filter((item) => item.pinned).length;

    elements.activeEventTitle.textContent = activeTitle;
    elements.activeEventUpdated.textContent = lastUpdated;
    elements.dashboardEventTitle.textContent = activeTitle;
    elements.dashboardEventDate.textContent = state.activeEvent?.eventDate
      ? `Event date ${toDateInputValue(state.activeEvent.eventDate)}`
      : "Date not set";
    elements.dashboardEventType.textContent = state.activeEvent?.eventType
      ? `Event type ${state.activeEvent.eventType}`
      : "Type not set";
    elements.dashboardProgramCount.textContent = String(state.program.length);
    elements.dashboardPlannerCount.textContent = String(state.plannerActivities.length);
    elements.dashboardSongCount.textContent = String(state.songs.length);
    elements.dashboardMissingSongs.textContent = String(missingSongs);
    elements.dashboardIncompleteChecklist.textContent = String(incompleteChecklist);
    elements.dashboardNotesCount.textContent = String(state.notes.length);
    elements.dashboardLastUpdated.textContent = lastUpdated;
    elements.dashboardReadyProgram.textContent = String(readyProgram);
    elements.dashboardDoneProgram.textContent = String(doneProgram);
    elements.dashboardApprovedSongs.textContent = String(approvedSongs);
    elements.dashboardPinnedNotes.textContent = String(pinnedNotes);
    renderEventSelector();
    renderDashboardSummary();
    renderRequestLink();
    renderPlannerLink();
  }

  function getFilteredProgram() {
    return state.program.filter((item) => {
      const matchesStatus =
        state.filters.programStatus === "all" || item.status === state.filters.programStatus;
      const haystack = `${item.title} ${item.type} ${item.audioFile || ""} ${item.cueNotes || ""} ${item.micNotes || ""}`
        .toLowerCase();
      const matchesSearch = haystack.includes(state.filters.programSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  function renderProgram() {
    const items = getFilteredProgram();

    if (!state.user || !state.activeEventId) {
      elements.programList.innerHTML = '<div class="empty-state">Sign in to load your running order.</div>';
      return;
    }

    if (!items.length) {
      elements.programList.innerHTML =
        '<div class="empty-state">No program items match this view. Add one to build your running order.</div>';
      return;
    }

    elements.programList.innerHTML = items
      .map((item, index) => {
        const linkedSong = state.songs.find((song) => song.linkedProgramId === item.id);
        const detailsOpen = isDetailsOpen("program", item.id);
        const menuOpen = isMenuOpen("program", item.id);
        return `
          <article class="entity-card program-card" draggable="true" data-program-id="${escapeHtml(item.id)}">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                  <span class="program-order-badge" aria-label="Program order ${index + 1}">${index + 1}</span>
                  <span class="status-chip ${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span>
                  <span class="type-chip general">${escapeHtml(item.type || "other")}</span>
                </div>
                <div class="entity-title-block">
                  <h4>${escapeHtml(item.title)}</h4>
                  <p class="small muted">${linkedSong ? `Linked song: ${escapeHtml(linkedSong.performanceTitle || linkedSong.songName || "Ready")}` : "No linked song"}</p>
                </div>
              </div>
              <div class="card-primary-actions">
                <button type="button" data-action="program-ready" data-id="${escapeHtml(item.id)}">Mark Ready</button>
                <button type="button" data-action="program-done" data-id="${escapeHtml(item.id)}">Mark Done</button>
                <button type="button" class="ghost compact-toggle" data-action="toggle-details" data-id="${escapeHtml(item.id)}" data-section="program" aria-expanded="${detailsOpen ? "true" : "false"}">${detailsOpen ? "Hide Details" : "Details"}</button>
                <div class="item-menu-wrap">
                  <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="program" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="More actions">⋯</button>
                  <div class="item-menu ${menuOpen ? "" : "hidden"}">
                    <button type="button" data-action="edit-program" data-id="${escapeHtml(item.id)}">Edit</button>
                    <button type="button" data-action="program-up" data-id="${escapeHtml(item.id)}">Move Up</button>
                    <button type="button" data-action="program-down" data-id="${escapeHtml(item.id)}">Move Down</button>
                    <button type="button" class="danger" data-action="delete-program" data-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="program-helper-row">
              <div class="helper-row">
                <span class="drag-handle" data-program-id="${escapeHtml(item.id)}">Drag</span>
              </div>
            </div>
            <div class="card-details ${detailsOpen ? "" : "hidden"}">
              <div class="compact-grid">
                <div class="list-card">
                  <strong>Audio File</strong>
                  <p class="small muted">${escapeHtml(item.audioFile || "No audio file assigned")}</p>
                </div>
                <div class="list-card">
                  <strong>Duration</strong>
                  <p class="small muted">${escapeHtml(item.duration || "No duration")}</p>
                </div>
                <div class="list-card">
                <strong>Cue Notes</strong>
                <p class="small muted">${escapeHtml(item.cueNotes || "None")}</p>
                </div>
                <div class="list-card">
                <strong>Mic Notes</strong>
                <p class="small muted">${escapeHtml(item.micNotes || "None")}</p>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getFilteredSongs() {
    return state.songs.filter((item) => {
      const matchesFilter =
        state.filters.songsStatus === "all" ||
        (state.filters.songsStatus === "missing" && !item.fileReceived) ||
        (state.filters.songsStatus === "approved" && item.finalApproved) ||
        (state.filters.songsStatus === "backup-missing" && !item.backupReady);

      const haystack = `${item.performanceTitle} ${item.performer} ${item.songName} ${item.notes || ""}`.toLowerCase();
      const matchesSearch = haystack.includes(state.filters.songsSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }

  function renderSongs() {
    const items = getFilteredSongs();

    if (!state.user || !state.activeEventId) {
      elements.songsList.innerHTML = '<div class="empty-state">Sign in to load your song tracker.</div>';
      return;
    }

    if (!items.length) {
      elements.songsList.innerHTML =
        '<div class="empty-state">No songs match this view. Add a song to track files and approvals.</div>';
      return;
    }

    elements.songsList.innerHTML = items
      .map((item) => {
        const linkedProgram = state.program.find((program) => program.id === item.linkedProgramId);
        const detailsOpen = isDetailsOpen("songs", item.id);
        const menuOpen = isMenuOpen("songs", item.id);
        const songStatus = getSongStatus(item);
        return `
          <article class="entity-card">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-title-block">
                <h4>${escapeHtml(item.performanceTitle || "Untitled performance")}</h4>
                  <p class="small muted">${escapeHtml(item.songName || "No song title")} · ${escapeHtml(item.performer || "No performer")}</p>
                </div>
                <div class="helper-row">
                  <span class="status-chip ${item.fileReceived ? "ready" : "danger"}">${item.fileReceived ? "File ready" : "File missing"}</span>
                  <span class="status-chip ${songStatus === "good" ? "done" : songStatus === "issue" ? "pending" : "danger"}">${escapeHtml(songStatus)}</span>
                </div>
              </div>
              <div class="card-primary-actions">
                <button type="button" data-action="toggle-song-approved" data-id="${escapeHtml(item.id)}">${item.finalApproved ? "Approved" : "Approve"}</button>
                <button type="button" class="ghost compact-toggle" data-action="toggle-details" data-id="${escapeHtml(item.id)}" data-section="songs" aria-expanded="${detailsOpen ? "true" : "false"}">${detailsOpen ? "Hide Details" : "Details"}</button>
                <div class="item-menu-wrap">
                  <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="songs" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="More actions">⋯</button>
                  <div class="item-menu ${menuOpen ? "" : "hidden"}">
                    <button type="button" data-action="edit-song" data-id="${escapeHtml(item.id)}">Edit</button>
                    <button type="button" data-action="toggle-song-backup" data-id="${escapeHtml(item.id)}">${item.backupReady ? "Backup Ready Off" : "Backup Ready"}</button>
                    <button type="button" class="danger" data-action="delete-song" data-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="helper-row">
              <span class="small muted">${linkedProgram ? `Program: ${escapeHtml(linkedProgram.title)}` : "No program link"}</span>
              <span class="small muted">Updated ${escapeHtml(formatDate(item.updatedAt))}</span>
            </div>
            <div class="card-details ${detailsOpen ? "" : "hidden"}">
              <div class="compact-grid">
                <div class="list-card">
                  <strong>Approval</strong>
                  <p class="small muted">${item.finalApproved ? "Approved for show" : "Waiting for approval"}</p>
                </div>
                <div class="list-card">
                  <strong>Backup</strong>
                  <p class="small muted">${item.backupReady ? "Backup ready" : "Backup not ready"}</p>
                </div>
                <div class="list-card full-width-card">
                  <strong>Notes</strong>
                  <p class="small muted">${escapeHtml(item.notes || "No notes")}</p>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getFilteredChecklist() {
    return state.checklist.filter((item) => {
      if (state.filters.checklistStatus === "all") return true;
      if (state.filters.checklistStatus === "incomplete") return !item.checked;
      if (state.filters.checklistStatus === "checked") return item.checked;
      if (state.filters.checklistStatus === "critical") return item.priority === "critical";
      return true;
    });
  }

  function renderChecklist() {
    const items = getFilteredChecklist();

    if (!state.user || !state.activeEventId) {
      elements.checklistList.innerHTML = '<div class="empty-state">Sign in to load your event checklist.</div>';
      return;
    }

    if (!items.length) {
      elements.checklistList.innerHTML =
        '<div class="empty-state">No checklist items match this view. Add one to track setup progress.</div>';
      return;
    }

    const groups = checklistCategories.reduce((acc, category) => {
      acc[category] = items.filter((item) => item.category === category);
      return acc;
    }, {});

    elements.checklistList.innerHTML = checklistCategories
      .filter((category) => groups[category].length)
      .map((category) => {
        const categoryItems = groups[category];
        const incompleteCount = categoryItems.filter((item) => !item.checked).length;

        return `
          <section class="checklist-group">
            <div class="category-head">
              <div>
                <h4>${escapeHtml(category)}</h4>
                <p class="small muted">${incompleteCount} incomplete</p>
              </div>
              <button type="button" data-action="complete-category" data-category="${escapeHtml(category)}">Mark All Complete</button>
            </div>
            <div class="list-stack">
              ${categoryItems
                .map(
                  (item) => `
                    <article class="list-card">
                      <div class="checklist-item-row compact-checklist-row">
                        <div class="entity-main-content">
                          <div class="entity-meta">
                          <button type="button" class="checkbox-button ${item.checked ? "checked" : ""}" data-action="toggle-checklist" data-id="${escapeHtml(item.id)}">${item.checked ? "Done" : "Open"}</button>
                          </div>
                          <div class="entity-title-block">
                            <strong>${escapeHtml(item.item)}</strong>
                            <p class="small muted">${item.checked ? "Checked" : "Open"}</p>
                          </div>
                        </div>
                        <div class="card-primary-actions">
                          ${item.priority === "critical" ? `<span class="priority-chip critical">Critical</span>` : ""}
                          <div class="item-menu-wrap">
                            <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="checklist" aria-expanded="${isMenuOpen("checklist", item.id) ? "true" : "false"}" aria-label="More actions">⋯</button>
                            <div class="item-menu ${isMenuOpen("checklist", item.id) ? "" : "hidden"}">
                              <button type="button" data-action="edit-checklist" data-id="${escapeHtml(item.id)}">Edit</button>
                              <button type="button" class="danger" data-action="delete-checklist" data-id="${escapeHtml(item.id)}">Delete</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          </section>
        `;
      })
      .join("");
  }

  function getFilteredNotes() {
    return state.notes.filter((item) => {
      return state.filters.notesType === "all" || item.type === state.filters.notesType;
    });
  }

  function renderNotes() {
    const items = getFilteredNotes();

    if (!state.user || !state.activeEventId) {
      elements.notesList.innerHTML = '<div class="empty-state">Sign in to load event notes.</div>';
      return;
    }

    if (!items.length) {
      elements.notesList.innerHTML =
        '<div class="empty-state">No notes match this view. Add a note for live reminders or urgent issues.</div>';
      return;
    }

    elements.notesList.innerHTML = items
      .map(
        (item) => `
          <article class="entity-card note-card ${item.pinned ? "drop-target" : ""}">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                <span class="type-chip ${escapeHtml(item.type || "general")}">${escapeHtml(item.type || "general")}</span>
                ${item.pinned ? '<span class="badge badge-live">Pinned</span>' : ""}
                </div>
                <div class="list-card note-text-card">
                  <p>${escapeHtml(item.text || "")}</p>
                </div>
              </div>
              <div class="card-primary-actions">
                <span class="small muted">${escapeHtml(formatDate(item.updatedAt))}</span>
                <div class="item-menu-wrap">
                  <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="notes" aria-expanded="${isMenuOpen("notes", item.id) ? "true" : "false"}" aria-label="More actions">⋯</button>
                  <div class="item-menu ${isMenuOpen("notes", item.id) ? "" : "hidden"}">
                    <button type="button" data-action="edit-note" data-id="${escapeHtml(item.id)}">Edit</button>
                    <button type="button" data-action="toggle-note-pin" data-id="${escapeHtml(item.id)}">${item.pinned ? "Unpin" : "Pin"}</button>
                    <button type="button" class="danger" data-action="delete-note" data-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }

  function getInvoiceDate(item) {
    return item.dueDate || item.createdAt || "";
  }

  function getExpenseDate(item) {
    return item.date || item.createdAt || "";
  }

  function getFinanceYearOptions() {
    const years = new Set();
    state.invoices.forEach((item) => {
      const year = getYearFromDateValue(getInvoiceDate(item));
      if (year) years.add(year);
    });
    state.expenses.forEach((item) => {
      const year = getYearFromDateValue(getExpenseDate(item));
      if (year) years.add(year);
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }

  function isFinanceYearMatch(item, dateGetter) {
    return state.filters.financeYear === "all" || getYearFromDateValue(dateGetter(item)) === state.filters.financeYear;
  }

  function getFilteredInvoices() {
    return state.invoices.filter((item) => isFinanceYearMatch(item, getInvoiceDate));
  }

  function getFilteredExpenses() {
    return state.expenses.filter((item) => isFinanceYearMatch(item, getExpenseDate));
  }

  function renderFinanceYearFilter() {
    if (!elements.financeYearFilter) return;
    const years = getFinanceYearOptions();
    if (state.filters.financeYear !== "all" && !years.includes(state.filters.financeYear)) {
      state.filters.financeYear = "all";
    }
    elements.financeYearFilter.innerHTML = [
      '<option value="all">All years</option>',
      ...years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`),
    ].join("");
    elements.financeYearFilter.value = state.filters.financeYear;
  }

  function renderFinanceSummary(invoices, expenses) {
    const paidIncome = invoices
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + toNumber(item.total), 0);
    const unpaidInvoices = invoices
      .filter((item) => item.status !== "paid")
      .reduce((sum, item) => sum + toNumber(item.balanceDue), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const deductibleExpenses = expenses
      .filter((item) => item.deductible)
      .reduce((sum, item) => sum + toNumber(item.amount), 0);
    const estimatedProfit = paidIncome - totalExpenses;

    elements.financePaidIncome.textContent = formatMoney(paidIncome);
    elements.financeUnpaidInvoices.textContent = formatMoney(unpaidInvoices);
    elements.financeTotalExpenses.textContent = formatMoney(totalExpenses);
    elements.financeDeductibleExpenses.textContent = formatMoney(deductibleExpenses);
    elements.financeEstimatedProfit.textContent = formatMoney(estimatedProfit);
  }

  function renderInvoices(invoices) {
    if (!state.user || !state.activeEventId) {
      elements.invoicesList.innerHTML = '<div class="empty-state">Sign in to load invoices.</div>';
      return;
    }

    if (!invoices.length) {
      elements.invoicesList.innerHTML = '<div class="empty-state">No invoices match this year. Add one to track client billing.</div>';
      return;
    }

    elements.invoicesList.innerHTML = invoices
      .map((item) => {
        const menuOpen = isMenuOpen("invoices", item.id);
        return `
          <article class="entity-card finance-card">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                  <span class="status-chip ${escapeHtml(item.status || "draft")}">${escapeHtml(item.status || "draft")}</span>
                  <span class="small muted">${escapeHtml(item.invoiceNumber || "No invoice number")}</span>
                  <span class="small muted">Due ${escapeHtml(toDateInputValue(item.dueDate) || "No due date")}</span>
                </div>
                <div class="entity-title-block">
                  <h4>${escapeHtml(item.clientName || "Unnamed client")}</h4>
                  <p class="small muted">${escapeHtml(item.eventTitle || state.activeEvent?.title || "Untitled event")}</p>
                </div>
              </div>
              <div class="card-primary-actions">
                <button type="button" data-action="email-invoice" data-id="${escapeHtml(item.id)}">Email Invoice</button>
                <button type="button" data-action="copy-invoice-link" data-id="${escapeHtml(item.id)}">Copy Link</button>
                <div class="item-menu-wrap">
                  <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="invoices" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="More actions">⋯</button>
                  <div class="item-menu ${menuOpen ? "" : "hidden"}">
                    <button type="button" data-action="edit-invoice" data-id="${escapeHtml(item.id)}">Edit</button>
                    <button type="button" class="danger" data-action="delete-invoice" data-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="compact-grid">
              <div class="list-card">
                <strong>Total</strong>
                <p>${escapeHtml(formatMoney(item.total))}</p>
              </div>
              <div class="list-card">
                <strong>Balance Due</strong>
                <p>${escapeHtml(formatMoney(item.balanceDue))}</p>
              </div>
              <div class="list-card">
                <strong>Deposit Paid</strong>
                <p>${escapeHtml(formatMoney(item.depositPaid))}</p>
              </div>
              <div class="list-card">
                <strong>Tax</strong>
                <p>${escapeHtml(formatMoney(item.taxAmount))} at ${escapeHtml(toNumber(item.taxRate))}%</p>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderExpenses(expenses) {
    if (!state.user || !state.activeEventId) {
      elements.expensesList.innerHTML = '<div class="empty-state">Sign in to load expenses.</div>';
      return;
    }

    if (!expenses.length) {
      elements.expensesList.innerHTML = '<div class="empty-state">No expenses match this year. Add one to track event costs.</div>';
      return;
    }

    elements.expensesList.innerHTML = expenses
      .map((item) => {
        const menuOpen = isMenuOpen("expenses", item.id);
        return `
          <article class="entity-card finance-card">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                  <span class="type-chip general">${escapeHtml(item.category || "uncategorized")}</span>
                  ${item.deductible ? '<span class="badge badge-success">Deductible</span>' : ""}
                </div>
                <div class="entity-title-block">
                  <h4>${escapeHtml(item.vendor || "Unnamed vendor")}</h4>
                  <p class="small muted">${escapeHtml(toDateInputValue(item.date) || "No date")} · ${escapeHtml(formatMoney(item.amount))}</p>
                </div>
              </div>
              <div class="card-primary-actions">
                <div class="item-menu-wrap">
                  <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="expenses" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="More actions">⋯</button>
                  <div class="item-menu ${menuOpen ? "" : "hidden"}">
                    <button type="button" data-action="edit-expense" data-id="${escapeHtml(item.id)}">Edit</button>
                    <button type="button" class="danger" data-action="delete-expense" data-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="list-card note-text-card">
              <p>${escapeHtml(item.notes || "No notes")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderInvoiceSettingsForm() {
    if (!elements.invoiceSettingsForm) return;
    const settings = normalizeInvoiceSettings(state.invoiceSettings);
    const fields = elements.invoiceSettingsForm.elements;
    fields.invoiceBusinessName.value = settings.invoiceBusinessName;
    fields.invoiceLogoUrl.value = settings.invoiceLogoUrl;
    fields.defaultTaxRate.value = settings.defaultTaxRate;
    fields.showTaxOnInvoice.checked = settings.showTaxOnInvoice;
    fields.zelleEmail.value = settings.zelleEmail;
    fields.paymentInstructions.value = settings.paymentInstructions;
    fields.invoiceFooterMessage.value = settings.invoiceFooterMessage;
    fields.defaultDueDays.value = settings.defaultDueDays;
    fields.countryStateDisplay.value = settings.countryStateDisplay;

    const disabled = !state.user;
    [...elements.invoiceSettingsForm.elements].forEach((field) => {
      field.disabled = disabled;
    });
    if (elements.invoiceSettingsStatus) {
      elements.invoiceSettingsStatus.textContent = disabled
        ? "Sign in to edit invoice settings."
        : "Saved under users/{uid}/settings/invoice.";
    }
  }

  function renderFinance() {
    if (!elements.invoicesList || !elements.expensesList) return;
    renderInvoiceSettingsForm();
    renderFinanceYearFilter();
    const invoices = getFilteredInvoices();
    const expenses = getFilteredExpenses();
    renderFinanceSummary(invoices, expenses);
    renderInvoices(invoices);
    renderExpenses(expenses);
  }

  function renderRequestLink() {
    if (!elements.requestLinkPanel) return;

    const token = state.activeEvent?.requestToken || "";
    const hasLink = Boolean(state.activeEventId && token);
    const link = hasLink ? requestPageUrl(state.activeEventId, token) : "";
    const qrUrl = hasLink ? qrCodeUrl(link) : "#";

    elements.requestLinkPanel.classList.toggle("hidden", !hasLink);
    elements.requestLinkOutput.value = link;
    elements.requestQrCode.src = hasLink ? qrUrl : "";
    elements.copyRequestLinkBtn.disabled = !hasLink;
    elements.openRequestPageBtn.disabled = !hasLink;
    elements.downloadRequestQrBtn.disabled = !hasLink;
    elements.createRequestLinkBtn.disabled = !state.user || !state.activeEventId;
    elements.createRequestLinkBtn.textContent = hasLink ? "Create Request Link" : "Create Request Link";
  }

  function renderSongRequests() {
    if (!elements.songRequestsList) return;

    const newCount = state.songRequests.filter((item) => normalizeRequestStatus(item.status) === "New").length;
    elements.requestCountBadge.textContent = `${newCount} new`;
    elements.requestCountBadge.className = `badge ${newCount ? "badge-success" : "badge-muted"}`;
    renderRequestLink();

    if (!state.user || !state.activeEventId) {
      elements.songRequestsList.innerHTML = '<div class="empty-state">Sign in to load DJ requests.</div>';
      return;
    }

    if (!state.songRequests.length) {
      elements.songRequestsList.innerHTML =
        '<div class="empty-state">No song requests yet. Create a request link and share the QR code with guests.</div>';
      return;
    }

    elements.songRequestsList.innerHTML = state.songRequests
      .map((item) => {
        const status = normalizeRequestStatus(item.status);
        const linkMarkup = item.link
          ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.link)}</a>`
          : '<span class="muted">No link</span>';

        return `
          <article class="entity-card request-card">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                  <span class="status-chip ${escapeHtml(statusClass(status))}">${escapeHtml(status)}</span>
                  <span class="small muted">${escapeHtml(formatDate(item.submittedAt || item.createdAt))}</span>
                </div>
                <div class="entity-title-block">
                  <h4>${escapeHtml(item.songName || "Untitled song")}</h4>
                  <p class="small muted">${escapeHtml(item.artist || "Artist not provided")} · ${escapeHtml(item.guestName || "Guest not provided")}</p>
                </div>
              </div>
              <div class="card-primary-actions">
                <button type="button" data-action="request-played" data-id="${escapeHtml(item.id)}">Played</button>
                <select data-action="request-status" data-id="${escapeHtml(item.id)}" aria-label="Request status">
                  ${["New", "Accepted", "Played", "Skipped"]
                    .map((value) => `<option value="${value}" ${status === value ? "selected" : ""}>${value}</option>`)
                    .join("")}
                </select>
                <button type="button" class="danger" data-action="delete-request" data-id="${escapeHtml(item.id)}">Delete</button>
              </div>
            </div>
            <div class="compact-grid request-detail-grid">
              <div class="list-card">
                <strong>Song name</strong>
                <p>${escapeHtml(item.songName || "No song name")}</p>
              </div>
              <div class="list-card">
                <strong>Artist</strong>
                <p>${escapeHtml(item.artist || "Not provided")}</p>
              </div>
              <div class="list-card">
                <strong>Guest name</strong>
                <p>${escapeHtml(item.guestName || "Not provided")}</p>
              </div>
              <div class="list-card">
                <strong>Link</strong>
                <p>${linkMarkup}</p>
              </div>
              <div class="list-card full-width-card">
                <strong>Message</strong>
                <p>${escapeHtml(item.message || "No message")}</p>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPlannerLink() {
    if (!elements.plannerLinkPanel) return;

    const token = state.activeEvent?.plannerToken || "";
    const hasLink = Boolean(state.activeEventId && token);
    const link = hasLink ? plannerPageUrl(state.activeEventId, token) : "";
    const qrUrl = hasLink ? qrCodeUrl(link) : "#";

    elements.plannerLinkPanel.classList.toggle("hidden", !hasLink);
    elements.plannerLinkOutput.value = link;
    elements.plannerQrCode.src = hasLink ? qrUrl : "";
    elements.copyPlannerLinkBtn.disabled = !hasLink;
    elements.openPlannerPageBtn.disabled = !hasLink;
    elements.downloadPlannerQrBtn.disabled = !hasLink;
    elements.createPlannerLinkBtn.disabled = !state.user || !state.activeEventId;
  }

  function parseDurationMinutes(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return 0;
    const colonMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (colonMatch) {
      return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
    }
    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour)/);
    const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(m|min|minute)/);
    if (hourMatch || minuteMatch) {
      return Math.round(Number(hourMatch?.[1] || 0) * 60 + Number(minuteMatch?.[1] || 0));
    }
    const numeric = Number(text.replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
  }

  function formatTimelineClock(minutesAfterStart) {
    const base = new Date();
    base.setHours(18, 0, 0, 0);
    base.setMinutes(base.getMinutes() + minutesAfterStart);
    return base.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function sortedPlannerActivities() {
    return [...state.plannerActivities].sort((a, b) => {
      const orderA = Number(a.order || 0);
      const orderB = Number(b.order || 0);
      if (orderA !== orderB) return orderA - orderB;
      return String(a.createdAt?.seconds || "").localeCompare(String(b.createdAt?.seconds || ""));
    });
  }

  function sortedPlannerUploads() {
    return [...state.plannerUploads].sort((a, b) => {
      const timeA = Number(a.uploadedAt?.seconds || a.updatedAt?.seconds || 0);
      const timeB = Number(b.uploadedAt?.seconds || b.updatedAt?.seconds || 0);
      return timeB - timeA;
    });
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (!size) return "Unknown size";
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderPlannerTimeline(items) {
    if (!elements.plannerTimelineList) return;

    if (!state.user || !state.activeEventId) {
      elements.plannerTimelineList.innerHTML = '<div class="empty-state">Sign in to generate a suggested timeline.</div>';
      return;
    }

    if (!items.length) {
      elements.plannerTimelineList.innerHTML = '<div class="empty-state">Activities with durations will appear as a suggested timeline.</div>';
      return;
    }

    let elapsed = 0;
    elements.plannerTimelineList.innerHTML = items
      .map((item, index) => {
        const durationMinutes = parseDurationMinutes(item.duration);
        const start = formatTimelineClock(elapsed);
        elapsed += durationMinutes || 5;
        const end = formatTimelineClock(elapsed);
        return `
          <article class="list-card timeline-card">
            <div>
              <span class="program-order-badge" aria-label="Timeline order ${index + 1}">${index + 1}</span>
            </div>
            <div>
              <strong>${escapeHtml(start)} - ${escapeHtml(end)}</strong>
              <p>${escapeHtml(item.activityName || "Untitled activity")}</p>
              <p class="small muted">${escapeHtml(item.duration || "5 min estimate")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPlannerUploads() {
    if (!elements.plannerUploadsList || !elements.plannerUploadCountBadge) return;

    const uploads = sortedPlannerUploads();
    const count = uploads.length;
    elements.plannerUploadCountBadge.textContent = `${count} ${count === 1 ? "file" : "files"}`;
    elements.plannerUploadCountBadge.className = `badge ${count ? "badge-success" : "badge-muted"}`;

    if (!state.user || !state.activeEventId) {
      elements.plannerUploadsList.innerHTML = '<div class="empty-state">Sign in to load uploaded files.</div>';
      return;
    }

    if (!uploads.length) {
      elements.plannerUploadsList.innerHTML =
        '<div class="empty-state">No client files uploaded yet. Uploaded program files will appear here.</div>';
      return;
    }

    elements.plannerUploadsList.innerHTML = uploads
      .map((item) => {
        const status = String(item.status || "uploaded").toLowerCase();
        const statusClassName = status === "reviewed" ? "done" : "accepted";
        return `
          <article class="entity-card planner-upload-card">
            <div class="card-main-row">
              <div class="entity-main-content">
                <div class="entity-meta">
                  <span class="status-chip ${escapeHtml(statusClassName)}">${escapeHtml(status)}</span>
                  <span class="badge badge-muted">${escapeHtml(String(item.sourceType || "file").toUpperCase())}</span>
                  <span class="small muted">${escapeHtml(formatDate(item.uploadedAt || item.updatedAt))}</span>
                </div>
                <div class="entity-title-block">
                  <h4>${escapeHtml(item.fileName || "Uploaded program file")}</h4>
                  <p class="small muted">${escapeHtml(item.mimeType || "Unknown type")} · ${escapeHtml(formatFileSize(item.fileSizeBytes))}</p>
                  ${item.clientNotes ? `<p class="small muted">${escapeHtml(item.clientNotes)}</p>` : ""}
                </div>
              </div>
              <div class="card-primary-actions">
                <button type="button" data-action="download-planner-upload" data-id="${escapeHtml(item.id)}">View/Download</button>
                <button type="button" data-action="mark-upload-reviewed" data-id="${escapeHtml(item.id)}" ${status === "reviewed" ? "disabled" : ""}>Mark Reviewed</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPlanner() {
    if (!elements.plannerActivitiesList) return;

    const items = sortedPlannerActivities();
    const count = items.length;
    elements.plannerCountBadge.textContent = `${count} ${count === 1 ? "activity" : "activities"}`;
    elements.plannerCountBadge.className = `badge ${count ? "badge-success" : "badge-muted"}`;
    renderPlannerLink();
    renderPlannerTimeline(items);
    renderPlannerUploads();

    if (!state.user || !state.activeEventId) {
      elements.plannerActivitiesList.innerHTML = '<div class="empty-state">Sign in to load planner activities.</div>';
      return;
    }

    if (!items.length) {
      elements.plannerActivitiesList.innerHTML =
        '<div class="empty-state">No client activities yet. Create a planner link and share it with the client.</div>';
      return;
    }

    elements.plannerActivitiesList.innerHTML = items
      .map((item, index) => {
        const menuOpen = isMenuOpen("planner-activities", item.id);
        const hasDetails = item.notes || item.songRequest || item.specialAnnouncement;
        return `
          <article class="entity-card planner-activity-card" draggable="true" data-planner-id="${escapeHtml(item.id)}">
            <div class="activity-card-header">
              <div class="entity-title-block">
                <h4>${escapeHtml(item.activityName || "Untitled activity")}</h4>
                <p class="small muted">Submitted ${escapeHtml(formatDate(item.submittedAt || item.createdAt))}</p>
              </div>
              <span class="program-order-badge" aria-label="Activity order ${index + 1}">${index + 1}</span>
            </div>
            <div class="activity-badges">
              ${item.duration
                ? `<span class="status-chip accepted">${escapeHtml(item.duration)}</span>`
                : `<span class="badge badge-muted">No Duration</span>`}
              <span class="badge ${item.addedToProgram ? "badge-success" : "badge-muted"}">${item.addedToProgram ? "Added to Program" : "Submitted"}</span>
            </div>
            ${hasDetails ? `
            <div class="activity-detail-grid">
              ${item.notes ? `<div class="list-card"><strong>Notes</strong><p class="small muted">${escapeHtml(item.notes)}</p></div>` : ""}
              ${item.songRequest ? `<div class="list-card"><strong>Song Request</strong><p class="small muted">${escapeHtml(item.songRequest)}</p></div>` : ""}
              ${item.specialAnnouncement ? `<div class="list-card full-width-card"><strong>Announcement</strong><p class="small muted">${escapeHtml(item.specialAnnouncement)}</p></div>` : ""}
            </div>
            ` : ""}
            <div class="activity-actions">
              <button type="button" class="primary" data-action="move-planner-to-program" data-id="${escapeHtml(item.id)}">Move to Program</button>
              <div class="item-menu-wrap">
                <button type="button" class="icon-button menu-trigger" data-action="toggle-menu" data-id="${escapeHtml(item.id)}" data-section="planner-activities" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="More actions">⋯</button>
                <div class="item-menu ${menuOpen ? "" : "hidden"}">
                  <button type="button" data-action="copy-planner-to-program" data-id="${escapeHtml(item.id)}">Copy to Program</button>
                  <button type="button" data-action="edit-planner-activity" data-id="${escapeHtml(item.id)}">Edit</button>
                  <button type="button" data-action="mark-planner-added" data-id="${escapeHtml(item.id)}">${item.addedToProgram ? "Mark Submitted" : "Mark Added"}</button>
                  <button type="button" data-action="planner-up" data-id="${escapeHtml(item.id)}">Move Up</button>
                  <button type="button" data-action="planner-down" data-id="${escapeHtml(item.id)}">Move Down</button>
                  <button type="button" class="danger" data-action="delete-planner-activity" data-id="${escapeHtml(item.id)}">Delete</button>
                </div>
              </div>
            </div>
            <div class="program-helper-row">
              <div class="helper-row">
                <span class="drag-handle" data-planner-id="${escapeHtml(item.id)}">Drag</span>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function invoiceSettingsFromForm(formData) {
    return normalizeInvoiceSettings({
      invoiceBusinessName: String(formData.get("invoiceBusinessName") || "").trim(),
      invoiceLogoUrl: String(formData.get("invoiceLogoUrl") || "").trim(),
      defaultTaxRate: toNumber(formData.get("defaultTaxRate")),
      showTaxOnInvoice: formData.get("showTaxOnInvoice") === "on",
      zelleEmail: String(formData.get("zelleEmail") || "").trim(),
      paymentInstructions: String(formData.get("paymentInstructions") || "").trim(),
      invoiceFooterMessage: String(formData.get("invoiceFooterMessage") || "").trim(),
      defaultDueDays: Math.max(0, Math.round(toNumber(formData.get("defaultDueDays")))),
      countryStateDisplay: String(formData.get("countryStateDisplay") || "").trim(),
    });
  }

  async function saveInvoiceSettings(event) {
    event.preventDefault();
    if (!state.user) {
      showToast("Sign in to save invoice settings", "error");
      return;
    }

    try {
      const payload = {
        ...invoiceSettingsFromForm(new FormData(elements.invoiceSettingsForm)),
        updatedAt: serverTimestamp(),
      };
      await setDoc(invoiceSettingsRef(state.user.uid), payload, { merge: true });
      state.invoiceSettings = normalizeInvoiceSettings(payload);
      renderInvoiceSettingsForm();
      showToast("Invoice settings saved", "success");
      const published = state.invoices.filter((inv) => inv.publicToken);
      if (published.length) {
        Promise.all(published.map((inv) => syncPublicInvoice(inv))).catch(() => {});
      }
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  function renderInvoiceLineItemInputs(lineItems) {
    return lineItems
      .map(
        (item, index) => `
          <div class="line-item-row" data-line-item-row>
            <div class="line-item-head">
              <strong>Line Item ${index + 1}</strong>
              <button type="button" class="ghost" data-action="remove-line-item">Remove</button>
            </div>
            <div class="line-item-fields">
              <label>
                <span>Item / Service</span>
                <input name="lineDescription" value="${escapeHtml(item.description || "")}" placeholder="Event sound services" required />
              </label>
              <label>
                <span>Quantity</span>
                <input name="lineQuantity" type="number" min="0" step="0.01" value="${escapeHtml(item.quantity || 1)}" />
              </label>
              <label>
                <span>Unit Price</span>
                <input name="lineUnitPrice" type="number" min="0" step="0.01" value="${escapeHtml(item.unitPrice || "")}" />
              </label>
              <label>
                <span>Amount</span>
                <input name="lineAmount" type="number" min="0" step="0.01" value="${escapeHtml(item.amount || "")}" readonly />
              </label>
              <label class="full-span">
                <span>Details / Notes</span>
                <textarea name="lineDetails">${escapeHtml(item.details || "")}</textarea>
              </label>
              <label class="toggle-row full-span">
                <input type="checkbox" name="lineTaxable" ${item.taxable !== false ? "checked" : ""} />
                <span>Taxable</span>
              </label>
            </div>
          </div>
        `
      )
      .join("");
  }

  function readLineItemsFromForm(formData) {
    const descriptions = formData.getAll("lineDescription");
    const details = formData.getAll("lineDetails");
    const quantities = formData.getAll("lineQuantity");
    const unitPrices = formData.getAll("lineUnitPrice");
    const taxableInputs = [...elements.itemForm.querySelectorAll('[name="lineTaxable"]')];

    return descriptions
      .map((description, index) => {
        const quantity = toNumber(quantities[index] || 1) || 1;
        const unitPrice = roundCurrency(unitPrices[index]);
        return {
          description: String(description || "").trim(),
          details: String(details[index] || "").trim(),
          quantity,
          unitPrice,
          amount: roundCurrency(quantity * unitPrice),
          taxable: taxableInputs[index]?.checked !== false,
        };
      })
      .filter((item) => item.description || item.amount > 0);
  }

  function refreshInvoiceModalCalculations() {
    if (state.modal.entity !== "invoice") return;
    const formData = new FormData(elements.itemForm);
    const lineItems = readLineItemsFromForm(formData);
    const taxRate = toNumber(formData.get("taxRate"));
    const depositPaid = roundCurrency(formData.get("depositPaid"));
    const showTax = formData.get("showTaxOnInvoice") === "on";
    const totals = calculateInvoiceTotals(lineItems, taxRate, depositPaid, showTax);

    elements.itemForm.querySelectorAll("[data-line-item-row]").forEach((row) => {
      const quantity = toNumber(row.querySelector('[name="lineQuantity"]')?.value || 1) || 1;
      const unitPrice = roundCurrency(row.querySelector('[name="lineUnitPrice"]')?.value);
      const amountInput = row.querySelector('[name="lineAmount"]');
      if (amountInput) amountInput.value = roundCurrency(quantity * unitPrice).toFixed(2);
    });

    Object.entries(totals).forEach(([key, value]) => {
      const target = elements.itemForm.querySelector(`[data-invoice-total="${key}"]`);
      if (target) target.textContent = formatMoney(value);
    });
  }

  function addInvoiceLineItemRow() {
    const list = elements.itemForm.querySelector("#invoice-line-items");
    if (!list) return;
    list.insertAdjacentHTML(
      "beforeend",
      renderInvoiceLineItemInputs([{ description: "", details: "", quantity: 1, unitPrice: 0, amount: 0, taxable: true }])
    );
    refreshInvoiceModalCalculations();
  }

  function openModal(entity, mode, item = null) {
    state.modal = {
      entity,
      mode,
      itemId: item?.id || null,
    };

    const actionLabel = entity === "delete-event" ? "Delete Event" : entity === "dj-template" ? "Add Template" : mode === "edit" ? "Save Changes" : "Create";
    let fieldsMarkup = "";

    if (entity === "event") {
      const eventItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Event name</span>
            <input name="title" value="${escapeHtml(eventItem.title || "")}" required />
          </label>
          <label>
            <span>Client/person name</span>
            <input name="clientName" value="${escapeHtml(eventItem.clientName || eventItem.contactName || "")}" autocomplete="name" />
          </label>
          <label>
            <span>Event Type</span>
            <select name="eventType">
              ${eventTypes
                .map((value) => `<option value="${value}" ${eventItem.eventType === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <span>Event date</span>
            <input name="eventDate" type="date" value="${escapeHtml(toDateInputValue(eventItem.eventDate))}" />
          </label>
          <label>
            <span>Start time</span>
            <input name="startTime" type="time" value="${escapeHtml(eventItem.startTime || "")}" />
          </label>
          <label>
            <span>End time</span>
            <input name="endTime" type="time" value="${escapeHtml(eventItem.endTime || "")}" />
          </label>
          <label>
            <span>Venue name</span>
            <input name="venue" value="${escapeHtml(eventItem.venue || eventItem.venueName || "")}" />
          </label>
          <label>
            <span>Venue address</span>
            <input name="venueAddress" value="${escapeHtml(eventItem.venueAddress || "")}" autocomplete="street-address" />
          </label>
          <label class="full-span">
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(eventItem.notes || "")}</textarea>
          </label>
        </div>
      `;
    }

    if (entity === "program") {
      const programItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Title</span>
            <input name="title" value="${escapeHtml(programItem.title || "")}" required />
          </label>
          <label>
            <span>Type</span>
            <select name="type">
              ${["dance", "song", "speech", "video", "other"]
                .map((value) => `<option value="${value}" ${programItem.type === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <span>Audio File</span>
            <input name="audioFile" value="${escapeHtml(programItem.audioFile || "")}" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${["pending", "ready", "done"]
                .map((value) => `<option value="${value}" ${programItem.status === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <span>Duration</span>
            <input name="duration" value="${escapeHtml(programItem.duration || "")}" placeholder="Optional" />
          </label>
          <label class="full-span">
            <span>Cue Notes</span>
            <textarea name="cueNotes">${escapeHtml(programItem.cueNotes || "")}</textarea>
          </label>
          <label class="full-span">
            <span>Mic Notes</span>
            <textarea name="micNotes">${escapeHtml(programItem.micNotes || "")}</textarea>
          </label>
        </div>
      `;
    }

    if (entity === "planner-activity") {
      const plannerItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>What would you like to happen?</span>
            <input name="activityName" value="${escapeHtml(plannerItem.activityName || "")}" required />
          </label>
          <label>
            <span>Approximate time needed</span>
            <input name="duration" value="${escapeHtml(plannerItem.duration || "")}" placeholder="Example: 10 minutes" />
          </label>
          <label class="full-span">
            <span>Special instructions</span>
            <textarea name="notes">${escapeHtml(plannerItem.notes || "")}</textarea>
          </label>
          <label>
            <span>Song for this activity (optional)</span>
            <input name="songRequest" value="${escapeHtml(plannerItem.songRequest || "")}" />
          </label>
          <label>
            <span>Announcement or message (optional)</span>
            <input name="specialAnnouncement" value="${escapeHtml(plannerItem.specialAnnouncement || "")}" />
          </label>
          <label class="toggle-row full-span">
            <input type="checkbox" name="addedToProgram" ${plannerItem.addedToProgram ? "checked" : ""} />
            <span>Added to Program</span>
          </label>
        </div>
      `;
    }

    if (entity === "song") {
      const songItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Performance Title</span>
            <input name="performanceTitle" value="${escapeHtml(songItem.performanceTitle || "")}" required />
          </label>
          <label>
            <span>Performer</span>
            <input name="performer" value="${escapeHtml(songItem.performer || "")}" />
          </label>
          <label>
            <span>Song Name</span>
            <input name="songName" value="${escapeHtml(songItem.songName || "")}" required />
          </label>
          <label>
            <span>Linked Program Item</span>
            <select name="linkedProgramId">
              <option value="">None</option>
              ${state.program
                .map(
                  (programItem) =>
                    `<option value="${escapeHtml(programItem.id)}" ${songItem.linkedProgramId === programItem.id ? "selected" : ""}>${escapeHtml(programItem.title)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="full-span">
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(songItem.notes || "")}</textarea>
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="fileReceived" ${songItem.fileReceived ? "checked" : ""} />
            <span>File received</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="finalApproved" ${songItem.finalApproved ? "checked" : ""} />
            <span>Final approved</span>
          </label>
          <label class="toggle-row full-span">
            <input type="checkbox" name="backupReady" ${songItem.backupReady ? "checked" : ""} />
            <span>Backup ready</span>
          </label>
        </div>
      `;
    }

    if (entity === "checklist") {
      const checklistItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Category</span>
            <select name="category">
              ${checklistCategories
                .map(
                  (value) => `<option value="${value}" ${checklistItem.category === value ? "selected" : ""}>${value}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">
              ${["normal", "important", "critical"]
                .map(
                  (value) => `<option value="${value}" ${checklistItem.priority === value ? "selected" : ""}>${value}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="full-span">
            <span>Item</span>
            <input name="item" value="${escapeHtml(checklistItem.item || "")}" required />
          </label>
          <label class="full-span">
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(checklistItem.notes || "")}</textarea>
          </label>
          <label class="toggle-row full-span">
            <input type="checkbox" name="checked" ${checklistItem.checked ? "checked" : ""} />
            <span>Checked</span>
          </label>
        </div>
      `;
    }

    if (entity === "note") {
      const noteItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Type</span>
            <select name="type">
              ${["general", "sound", "urgent", "reminder"]
                .map((value) => `<option value="${value}" ${noteItem.type === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="pinned" ${noteItem.pinned ? "checked" : ""} />
            <span>Pinned</span>
          </label>
          <label class="full-span">
            <span>Text</span>
            <textarea name="text" required>${escapeHtml(noteItem.text || "")}</textarea>
          </label>
        </div>
      `;
    }

    if (entity === "invoice") {
      const invoiceItem = item || {};
      const invoiceDate = toDateInputValue(invoiceItem.invoiceDate) || new Date().toISOString().slice(0, 10);
      const dueDate =
        toDateInputValue(invoiceItem.dueDate) || addDaysToDateInput(invoiceDate, state.invoiceSettings.defaultDueDays);
      const taxRate = invoiceItem.taxRate ?? state.invoiceSettings.defaultTaxRate;
      const showTaxOnInvoice = invoiceItem.showTaxOnInvoice ?? state.invoiceSettings.showTaxOnInvoice;
      const lineItems = getInvoiceLineItems(invoiceItem);
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Client Name</span>
            <input name="clientName" value="${escapeHtml(invoiceItem.clientName || "")}" required />
          </label>
          <label>
            <span>Client Email</span>
            <input name="clientEmail" type="email" value="${escapeHtml(invoiceItem.clientEmail || "")}" />
          </label>
          <label>
            <span>Event Title</span>
            <input name="eventTitle" value="${escapeHtml(invoiceItem.eventTitle || state.activeEvent?.title || "")}" required />
          </label>
          <label>
            <span>Invoice Date</span>
            <input name="invoiceDate" type="date" value="${escapeHtml(invoiceDate)}" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${["draft", "sent", "paid"]
                .map((value) => `<option value="${value}" ${invoiceItem.status === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <span>Tax Rate (%)</span>
            <input name="taxRate" type="number" min="0" step="0.001" value="${escapeHtml(taxRate)}" />
          </label>
          <label>
            <span>Deposit Paid</span>
            <input name="depositPaid" type="number" min="0" step="0.01" value="${escapeHtml(invoiceItem.depositPaid || "")}" />
          </label>
          <label>
            <span>Due Date</span>
            <input name="dueDate" type="date" value="${escapeHtml(dueDate)}" />
          </label>
          <label class="toggle-row">
            <input type="checkbox" name="showTaxOnInvoice" ${showTaxOnInvoice ? "checked" : ""} />
            <span>Show tax on invoice</span>
          </label>
          <div class="full-span line-items-editor">
            <div class="line-items-title">
              <div>
                <p class="section-kicker">Itemized Billing</p>
                <h4>Line Items</h4>
              </div>
              <button type="button" data-action="add-line-item">Add Line Item</button>
            </div>
            <div id="invoice-line-items">
              ${renderInvoiceLineItemInputs(lineItems)}
            </div>
          </div>
          <div class="full-span invoice-calculation-panel">
            <div><span>Subtotal</span><strong data-invoice-total="subtotal">${formatMoney(invoiceItem.subtotal)}</strong></div>
            <div><span>Taxable Subtotal</span><strong data-invoice-total="taxableSubtotal">${formatMoney(invoiceItem.taxableSubtotal)}</strong></div>
            <div><span>Tax</span><strong data-invoice-total="taxAmount">${formatMoney(invoiceItem.taxAmount)}</strong></div>
            <div><span>Total</span><strong data-invoice-total="total">${formatMoney(invoiceItem.total)}</strong></div>
            <div><span>Balance Due</span><strong data-invoice-total="balanceDue">${formatMoney(invoiceItem.balanceDue)}</strong></div>
          </div>
          <label class="full-span">
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(invoiceItem.notes || "")}</textarea>
          </label>
          <label class="full-span">
            <span>Payment Instructions</span>
            <textarea name="paymentInstructions">${escapeHtml(invoiceItem.paymentInstructions || invoicePaymentInstructions())}</textarea>
          </label>
        </div>
      `;
    }

    if (entity === "expense") {
      const expenseItem = item || {};
      fieldsMarkup = `
        <div class="form-grid">
          <label>
            <span>Date</span>
            <input name="date" type="date" value="${escapeHtml(toDateInputValue(expenseItem.date))}" />
          </label>
          <label>
            <span>Category</span>
            <input name="category" value="${escapeHtml(expenseItem.category || "")}" placeholder="Travel, gear, supplies" />
          </label>
          <label>
            <span>Vendor</span>
            <input name="vendor" value="${escapeHtml(expenseItem.vendor || "")}" required />
          </label>
          <label>
            <span>Amount</span>
            <input name="amount" type="number" min="0" step="0.01" value="${escapeHtml(expenseItem.amount || "")}" required />
          </label>
          <label class="toggle-row full-span">
            <input type="checkbox" name="deductible" ${expenseItem.deductible ? "checked" : ""} />
            <span>Deductible</span>
          </label>
          <label class="full-span">
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(expenseItem.notes || "")}</textarea>
          </label>
        </div>
      `;
    }

    if (entity === "delete-event") {
      const eventTitle = (item || state.activeEvent)?.title || "this event";
      fieldsMarkup = `
        <div class="form-grid">
          <div class="full-span">
            <p>You are about to permanently delete <strong>${escapeHtml(eventTitle)}</strong>.</p>
            <p class="small muted" style="margin-top:0.5rem;">All program items, songs, checklist items, notes, invoices, and expenses will be deleted. This cannot be undone.</p>
          </div>
          <label class="full-span">
            <span>Type DELETE to confirm</span>
            <input name="deleteConfirm" placeholder="DELETE" autocomplete="off" spellcheck="false" />
          </label>
        </div>
      `;
    }

    if (entity === "dj-template") {
      const eventTitle = state.activeEvent?.title || "this event";
      fieldsMarkup = `
        <div class="form-grid">
          <div class="full-span">
            <p>Add the DJ template to <strong>${escapeHtml(eventTitle)}</strong>?</p>
            <p class="small muted" style="margin-top:0.5rem;">Adds 10 program items, a DJ checklist, and a planning note. This cannot be undone.</p>
          </div>
        </div>
      `;
    }

    const specialModalTitles = {
      "delete-event": "Delete Event",
      "dj-template": "Add DJ Template",
      "planner-activity": mode === "edit" ? "Edit Planner Activity" : "Add Planner Activity",
    };
    elements.modalTitle.textContent = specialModalTitles[entity] || `${mode === "edit" ? "Edit" : "Add"} ${entity.charAt(0).toUpperCase() + entity.slice(1)}`;
    const submitBtnClass = entity === "delete-event" ? "danger" : "primary";
    elements.itemForm.innerHTML = `
      ${fieldsMarkup}
      <div class="modal-actions">
        <button type="button" id="modal-cancel-btn">Cancel</button>
        <button type="submit" class="${submitBtnClass}">${actionLabel}</button>
      </div>
    `;
    elements.modalOverlay.classList.remove("hidden");
    elements.modalOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    refreshInvoiceModalCalculations();
  }

  function closeModal() {
    state.modal = {
      entity: null,
      mode: null,
      itemId: null,
    };
    elements.modalOverlay.classList.add("hidden");
    elements.modalOverlay.setAttribute("aria-hidden", "true");
    elements.itemForm.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function formBoolean(formData, key) {
    return formData.get(key) === "on";
  }

  function roundCurrency(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function buildInvoicePayload(formData) {
    const taxRate = toNumber(formData.get("taxRate"));
    const depositPaid = roundCurrency(formData.get("depositPaid"));
    const showTaxOnInvoice = formData.get("showTaxOnInvoice") === "on";
    const lineItems = readLineItemsFromForm(formData);
    const totals = calculateInvoiceTotals(lineItems, taxRate, depositPaid, showTaxOnInvoice);
    const settings = normalizeInvoiceSettings(state.invoiceSettings);

    return {
      clientName: String(formData.get("clientName") || "").trim(),
      clientEmail: String(formData.get("clientEmail") || "").trim(),
      eventTitle: String(formData.get("eventTitle") || "").trim(),
      invoiceDate: String(formData.get("invoiceDate") || "").trim(),
      lineItems,
      subtotal: totals.subtotal,
      taxableSubtotal: totals.taxableSubtotal,
      taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      depositPaid,
      balanceDue: totals.balanceDue,
      showTaxOnInvoice,
      status: String(formData.get("status") || "draft"),
      dueDate: String(formData.get("dueDate") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      paymentInstructions: String(formData.get("paymentInstructions") || invoicePaymentInstructions(settings)).trim(),
      invoiceBusinessName: settings.invoiceBusinessName,
      invoiceLogoUrl: settings.invoiceLogoUrl,
      zelleEmail: settings.zelleEmail,
      invoiceFooterMessage: settings.invoiceFooterMessage,
      countryStateDisplay: settings.countryStateDisplay,
      updatedAt: serverTimestamp(),
    };
  }

  function publicInvoiceUrl(token) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invoice.html?token=${encodeURIComponent(token)}`;
  }

  function buildPublicInvoicePayload(invoice) {
    const settings = normalizeInvoiceSettings({
      ...state.invoiceSettings,
      invoiceBusinessName: invoice.invoiceBusinessName,
      invoiceLogoUrl: invoice.invoiceLogoUrl,
      zelleEmail: invoice.zelleEmail,
      paymentInstructions: invoice.paymentInstructions,
      invoiceFooterMessage: invoice.invoiceFooterMessage,
      countryStateDisplay: invoice.countryStateDisplay,
      showTaxOnInvoice: invoice.showTaxOnInvoice,
      defaultTaxRate: invoice.taxRate,
    });
    const lineItems = getInvoiceLineItems(invoice);
    const totals = calculateInvoiceTotals(lineItems, invoice.taxRate, invoice.depositPaid, settings.showTaxOnInvoice);
    return {
      appName: settings.invoiceBusinessName,
      businessName: settings.invoiceBusinessName,
      invoiceLogoUrl: settings.invoiceLogoUrl,
      invoiceNumber: invoice.invoiceNumber || "",
      clientName: invoice.clientName || "",
      eventTitle: invoice.eventTitle || "",
      invoiceDate: invoice.invoiceDate || "",
      dueDate: invoice.dueDate || "",
      status: invoice.status || "draft",
      lineItems,
      subtotal: totals.subtotal,
      taxableSubtotal: totals.taxableSubtotal,
      taxRate: toNumber(invoice.taxRate),
      taxAmount: totals.taxAmount,
      total: totals.total,
      depositPaid: toNumber(invoice.depositPaid),
      balanceDue: totals.balanceDue,
      showTaxOnInvoice: settings.showTaxOnInvoice,
      notes: invoice.notes || "",
      paymentInstructions: invoice.paymentInstructions || settings.paymentInstructions,
      zelleEmail: settings.zelleEmail,
      invoiceFooterMessage: settings.invoiceFooterMessage,
      countryStateDisplay: settings.countryStateDisplay,
      ownerUid: state.user?.uid || "",
      paymentMethodsPlaceholder: true,
      updatedAt: serverTimestamp(),
    };
  }

  async function syncPublicInvoice(invoice) {
    if (!invoice.publicToken) return;
    await setDoc(publicInvoiceRef(invoice.publicToken), buildPublicInvoicePayload(invoice), { merge: true });
  }

  async function ensurePublicInvoice(item) {
    if (!item) return null;
    const nextInvoice = {
      ...item,
      invoiceDate: item.invoiceDate || toDateInputValue(item.createdAt) || new Date().toISOString().slice(0, 10),
      invoiceNumber: item.invoiceNumber || makeInvoiceNumber(),
      publicToken: item.publicToken || makePublicToken(),
      paymentInstructions: item.paymentInstructions || invoicePaymentInstructions(),
      lineItems: getInvoiceLineItems(item),
    };

    if (!item.invoiceNumber || !item.publicToken || !item.paymentInstructions || !item.invoiceDate) {
      await updateDoc(doc(collectionRef(state.user.uid, state.activeEventId, "invoices"), item.id), {
        invoiceDate: nextInvoice.invoiceDate,
        invoiceNumber: nextInvoice.invoiceNumber,
        publicToken: nextInvoice.publicToken,
        paymentInstructions: nextInvoice.paymentInstructions,
        updatedAt: serverTimestamp(),
      });
    }

    await syncPublicInvoice(nextInvoice);
    return nextInvoice;
  }

  function nowProgramOrder() {
    if (!state.program.length) return 1;
    return Math.max(...state.program.map((item) => Number(item.order || 0))) + 1;
  }

  function programPayloadFromPlannerActivity(item = {}) {
    const cueNotes = [
      item.notes ? `Special instructions: ${item.notes}` : "",
      item.songRequest ? `Song request: ${item.songRequest}` : "",
      item.specialAnnouncement ? `Announcement: ${item.specialAnnouncement}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: String(item.activityName || "Planner activity").trim(),
      type: item.songRequest ? "song" : "other",
      audioFile: String(item.songRequest || "").trim(),
      cueNotes,
      micNotes: String(item.specialAnnouncement || "").trim(),
      status: "pending",
      duration: String(item.duration || "").trim(),
      sourcePlannerActivityId: item.id || "",
      updatedAt: serverTimestamp(),
    };
  }

  async function addPlannerActivityToProgram(itemId, markAdded = false) {
    if (!state.user || !state.activeEventId) return;
    const item = findItem("plannerActivities", itemId);
    if (!item) return;

    await addDoc(collectionRef(state.user.uid, state.activeEventId, "program"), {
      ...programPayloadFromPlannerActivity(item),
      order: nowProgramOrder(),
      createdAt: serverTimestamp(),
    });

    if (markAdded) {
      await updateDoc(doc(publicPlannerActivitiesRef(state.activeEventId), itemId), {
        addedToProgram: true,
        addedToProgramAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await touchActiveEvent();
    showToast(markAdded ? "Activity moved into Program" : "Activity copied into Program", "success");
  }

  async function ensureEventSeed(uid, eventId) {
    const eventDocRef = eventRef(uid, eventId);
    const snapshot = await getDoc(eventDocRef);

    if (!snapshot.exists()) {
      await setDoc(eventDocRef, {
        title: "My Current Event",
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const eventData = snapshot.exists() ? snapshot.data() : {};

    if (eventData.seededVersion === 1) return;

    const batch = writeBatch(db);
    const eventCollectionRef = collectionRef(uid, eventId, "program");
    const songsCollectionRef = collectionRef(uid, eventId, "songs");
    const checklistCollectionRef = collectionRef(uid, eventId, "checklist");
    const notesCollectionRef = collectionRef(uid, eventId, "notes");

    const sampleProgram = [
      {
        title: "Opening Welcome",
        type: "speech",
        order: 1,
        audioFile: "",
        cueNotes: "House lights to warm wash.",
        micNotes: "Handheld on stage left.",
        status: "ready",
        duration: "02:00",
      },
      {
        title: "Group Performance",
        type: "song",
        order: 2,
        audioFile: "group-performance.wav",
        cueNotes: "Fade in stage center spot.",
        micNotes: "Check pack frequencies before cue.",
        status: "pending",
        duration: "04:30",
      },
      {
        title: "Closing Video",
        type: "video",
        order: 3,
        audioFile: "closing-video.mp4",
        cueNotes: "Projector source HDMI 2.",
        micNotes: "Mute podium mic before playback.",
        status: "pending",
        duration: "03:10",
      },
    ];

    sampleProgram.forEach((item) => {
      batch.set(doc(eventCollectionRef), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    [
      {
        performanceTitle: "Group Performance",
        performer: "Junior Team",
        songName: "Spark Anthem",
        fileReceived: true,
        finalApproved: false,
        backupReady: false,
        notes: "Waiting on final trim.",
        linkedProgramId: "",
      },
      {
        performanceTitle: "Solo Feature",
        performer: "Maya",
        songName: "Night Lights",
        fileReceived: false,
        finalApproved: false,
        backupReady: true,
        notes: "Follow up with coach for final file.",
        linkedProgramId: "",
      },
    ].forEach((item) => {
      batch.set(doc(songsCollectionRef), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    [
      {
        category: "Sound Gear",
        item: "Main mixer powered and scene loaded",
        checked: false,
        priority: "critical",
        notes: "",
      },
      {
        category: "Cables",
        item: "Playback lines taped and tested",
        checked: false,
        priority: "important",
        notes: "",
      },
      {
        category: "Microphones",
        item: "Spare batteries at monitor world",
        checked: true,
        priority: "important",
        notes: "",
      },
      {
        category: "Backup",
        item: "USB backup playlist available",
        checked: false,
        priority: "critical",
        notes: "",
      },
    ].forEach((item) => {
      batch.set(doc(checklistCollectionRef), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    [
      {
        text: "Confirm opening cue with stage manager at call time.",
        type: "reminder",
        pinned: true,
      },
      {
        text: "Keep backup laptop on charger backstage right.",
        type: "sound",
        pinned: false,
      },
    ].forEach((item) => {
      batch.set(doc(notesCollectionRef), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    batch.set(
      eventDocRef,
      {
        title: eventData.title || "My Current Event",
        ownerUid: uid,
        createdAt: eventData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        seededVersion: 1,
      },
      { merge: true }
    );

    await batch.commit();
  }

  async function createEventForUser(user, eventData = {}, options = {}) {
    const title = String(eventData.title || "My Current Event").trim() || "My Current Event";
    const eventId = `${slugify(title) || "event"}-${Date.now()}`;
    await setDoc(eventRef(user.uid, eventId), {
      title,
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      eventDate: eventData.eventDate || "",
      eventType: eventData.eventType || "Other",
      venue: eventData.venue || "",
      venueAddress: eventData.venueAddress || "",
      clientName: eventData.clientName || eventData.contactName || "",
      startTime: eventData.startTime || "",
      endTime: eventData.endTime || "",
      contactName: eventData.contactName || "",
      contactPhone: eventData.contactPhone || "",
      notes: eventData.notes || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(userMetaRef(user.uid), {
      activeEventId: eventId,
      updatedAt: serverTimestamp(),
    });
    rememberActiveEventId(user.uid, eventId);
    if (options.seed) {
      await ensureEventSeed(user.uid, eventId);
    }
    return eventId;
  }

  async function ensureActiveEvent(user) {
    const metaRef = userMetaRef(user.uid);
    const metaSnapshot = await getDoc(metaRef);
    const storedEventId = getStoredActiveEventId(user.uid);
    let activeEventId = metaSnapshot.exists() ? metaSnapshot.data().activeEventId : null;

    if (storedEventId) {
      const storedSnapshot = await getDoc(eventRef(user.uid, storedEventId));
      if (storedSnapshot.exists()) {
        activeEventId = storedEventId;
        await setDoc(
          metaRef,
          {
            activeEventId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    if (!activeEventId) {
      activeEventId = await createEventForUser(user, { title: "My Current Event" }, { seed: true });
    }

    return activeEventId;
  }

  function subscribeToCollection(refKey, refQuery, mapFn, onRender) {
    if (state.unsubscribers[refKey]) {
      state.unsubscribers[refKey]();
    }

    state.unsubscribers[refKey] = onSnapshot(
      refQuery,
      (snapshot) => {
        state[refKey] = snapshot.docs.map(mapFn);
        onRender();
        renderDashboard();
        setSyncState("Live", "badge-live");
      },
      (error) => {
        showToast(mapFirebaseError(error), "error");
        setSyncState("Error", "badge-muted");
      }
    );
  }

  function attachActiveEventListeners() {
    const { user, activeEventId } = state;
    if (!user || !activeEventId) return;

    const currentEventRef = eventRef(user.uid, activeEventId);

    if (state.unsubscribers.activeEvent) state.unsubscribers.activeEvent();
    state.unsubscribers.activeEvent = onSnapshot(
      currentEventRef,
      (snapshot) => {
        state.activeEvent = snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data(),
            }
          : null;
        elements.activeEventTitleInput.value = state.activeEvent?.title || "";
        renderDashboard();
        setSyncState("Live", "badge-live");
      },
      (error) => {
        showToast(mapFirebaseError(error), "error");
      }
    );

    subscribeToCollection(
      "program",
      query(collectionRef(user.uid, activeEventId, "program"), orderBy("order", "asc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderProgram
    );

    subscribeToCollection(
      "songs",
      query(collectionRef(user.uid, activeEventId, "songs"), orderBy("updatedAt", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderSongs
    );

    subscribeToCollection(
      "checklist",
      query(collectionRef(user.uid, activeEventId, "checklist"), orderBy("createdAt", "asc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderChecklist
    );

    subscribeToCollection(
      "notes",
      query(collectionRef(user.uid, activeEventId, "notes"), orderBy("updatedAt", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderNotes
    );

    subscribeToCollection(
      "invoices",
      query(collectionRef(user.uid, activeEventId, "invoices"), orderBy("updatedAt", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderFinance
    );

    subscribeToCollection(
      "expenses",
      query(collectionRef(user.uid, activeEventId, "expenses"), orderBy("date", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderFinance
    );

    subscribeToCollection(
      "songRequests",
      query(publicSongRequestsRef(activeEventId), orderBy("submittedAt", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderSongRequests
    );

    subscribeToCollection(
      "plannerActivities",
      query(publicPlannerActivitiesRef(activeEventId), orderBy("order", "asc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderPlanner
    );

    subscribeToCollection(
      "plannerUploads",
      query(publicUploadsRef(activeEventId), orderBy("uploadedAt", "desc")),
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }),
      renderPlannerUploads
    );
  }

  async function setActiveEventId(activeEventId) {
    if (!state.user || !activeEventId || state.activeEventId === activeEventId) return;
    state.activeEventId = activeEventId;
    rememberActiveEventId(state.user.uid, activeEventId);
    clearCollectionsState();
    state.undo.program = null;
    state.undo.songs = null;
    state.undo.checklist = null;
    state.undo.notes = null;
    renderUndoButtons();
    renderEventSelector();
    renderDashboard();
    renderProgram();
    renderSongs();
    renderChecklist();
    renderNotes();
    renderFinance();
    renderSongRequests();
    renderPlanner();
    renderPlannerUploads();
    attachActiveEventListeners();
  }

  async function selectActiveEvent(activeEventId) {
    if (!state.user || !activeEventId) return;

    try {
      rememberActiveEventId(state.user.uid, activeEventId);
      await setActiveEventId(activeEventId);
      await setDoc(
        userMetaRef(state.user.uid),
        {
          activeEventId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Event switched", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  function handleEventsSnapshot(user) {
    if (state.unsubscribers.events) state.unsubscribers.events();

    state.unsubscribers.events = onSnapshot(
      eventsCollectionRef(user.uid),
      async (snapshot) => {
        state.events = snapshot.docs
          .map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .sort((a, b) => timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt));
        renderEventSelector();

        const activeExists = state.events.some((eventItem) => eventItem.id === state.activeEventId);
        if (!state.activeEventId && state.events.length) {
          await selectActiveEvent(state.events[0].id);
        } else if (state.activeEventId && !activeExists && state.events.length) {
          await selectActiveEvent(state.events[0].id);
        }
      },
      (error) => {
        showToast(mapFirebaseError(error), "error");
      }
    );
  }

  async function handleMetaSnapshot(user) {
    if (state.unsubscribers.activeMeta) state.unsubscribers.activeMeta();

    state.unsubscribers.activeMeta = onSnapshot(
      userMetaRef(user.uid),
      async (snapshot) => {
        const activeEventId = snapshot.exists() ? snapshot.data().activeEventId : null;

        if (!activeEventId) {
          const createdId = await createEventForUser(user, { title: "My Current Event" }, { seed: true });
          await setActiveEventId(createdId);
          return;
        }

        await setActiveEventId(activeEventId);
      },
      (error) => {
        showToast(mapFirebaseError(error), "error");
      }
    );
  }

  function handleInvoiceSettingsSnapshot(user) {
    if (state.unsubscribers.invoiceSettings) state.unsubscribers.invoiceSettings();

    state.unsubscribers.invoiceSettings = onSnapshot(
      invoiceSettingsRef(user.uid),
      (snapshot) => {
        state.invoiceSettings = normalizeInvoiceSettings(snapshot.exists() ? snapshot.data() : {});
        renderInvoiceSettingsForm();
      },
      (error) => {
        showToast(mapFirebaseError(error), "error");
      }
    );
  }

  async function saveFormSubmission(event) {
    event.preventDefault();
    if (!state.user || !state.modal.entity) return;

    const formData = new FormData(elements.itemForm);
    const { entity, mode, itemId } = state.modal;
    const uid = state.user.uid;
    const eventId = state.activeEventId;

    try {
      if (entity === "event") {
        const payload = {
          title: String(formData.get("title") || "").trim(),
          eventDate: String(formData.get("eventDate") || "").trim(),
          eventType: String(formData.get("eventType") || "Other"),
          venue: String(formData.get("venue") || "").trim(),
          venueAddress: String(formData.get("venueAddress") || "").trim(),
          clientName: String(formData.get("clientName") || "").trim(),
          contactName: String(formData.get("clientName") || "").trim(),
          startTime: String(formData.get("startTime") || "").trim(),
          endTime: String(formData.get("endTime") || "").trim(),
          contactPhone: mode === "edit" ? state.activeEvent?.contactPhone || "" : "",
          notes: String(formData.get("notes") || "").trim(),
        };

        if (!payload.title) {
          showToast("Event name is required", "error");
          return;
        }

        if (mode === "edit" && (itemId || state.activeEventId)) {
          const targetEventId = itemId || state.activeEventId;
          await updateDoc(eventRef(uid, targetEventId), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
          state.activeEvent = {
            ...(state.activeEvent || {}),
            id: targetEventId,
            ...payload,
          };
          elements.activeEventTitleInput.value = payload.title;
          renderDashboard();
          await syncPublicEventMetadata({ title: payload.title });
          closeModal();
          showToast("Event settings saved", "success");
          return;
        }

        const createdId = await createEventForUser(state.user, payload);
        await setActiveEventId(createdId);
        closeModal();
        showToast("New event created", "success");
        return;
      }

      if (entity === "delete-event") {
        const confirmInput = String(formData.get("deleteConfirm") || "").trim();
        if (confirmInput !== "DELETE") {
          showToast("Type DELETE (all caps) to confirm", "error");
          return;
        }
        await deleteEventWithAllData(uid, itemId || state.activeEventId);
        return;
      }

      if (entity === "dj-template") {
        if (!eventId) return;
        await addDjTemplateToEvent(uid, eventId);
        return;
      }

      if (!eventId) return;

      if (entity === "program") {
        const payload = {
          title: String(formData.get("title") || "").trim(),
          type: String(formData.get("type") || "other"),
          audioFile: String(formData.get("audioFile") || "").trim(),
          cueNotes: String(formData.get("cueNotes") || "").trim(),
          micNotes: String(formData.get("micNotes") || "").trim(),
          status: String(formData.get("status") || "pending"),
          duration: String(formData.get("duration") || "").trim(),
          updatedAt: serverTimestamp(),
        };

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "program"), itemId), payload);
        } else {
          await addDoc(collectionRef(uid, eventId, "program"), {
            ...payload,
            order: nowProgramOrder(),
            createdAt: serverTimestamp(),
          });
        }
      }

      if (entity === "planner-activity") {
        const payload = {
          activityName: String(formData.get("activityName") || "").trim(),
          duration: String(formData.get("duration") || "").trim(),
          notes: String(formData.get("notes") || "").trim(),
          songRequest: String(formData.get("songRequest") || "").trim(),
          specialAnnouncement: String(formData.get("specialAnnouncement") || "").trim(),
          addedToProgram: formBoolean(formData, "addedToProgram"),
          updatedAt: serverTimestamp(),
        };

        if (!payload.activityName) {
          showToast("Activity name is required", "error");
          return;
        }

        await updateDoc(doc(publicPlannerActivitiesRef(eventId), itemId), payload);
      }

      if (entity === "song") {
        const payload = normalizeSongPayload({
          performanceTitle: String(formData.get("performanceTitle") || "").trim(),
          performer: String(formData.get("performer") || "").trim(),
          songName: String(formData.get("songName") || "").trim(),
          fileReceived: formBoolean(formData, "fileReceived"),
          finalApproved: formBoolean(formData, "finalApproved"),
          backupReady: formBoolean(formData, "backupReady"),
          notes: String(formData.get("notes") || "").trim(),
          linkedProgramId: String(formData.get("linkedProgramId") || "").trim(),
          updatedAt: serverTimestamp(),
        });

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "songs"), itemId), payload);
        } else {
          await addDoc(collectionRef(uid, eventId, "songs"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (entity === "checklist") {
        const payload = {
          category: String(formData.get("category") || checklistCategories[0]),
          item: String(formData.get("item") || "").trim(),
          checked: formBoolean(formData, "checked"),
          priority: String(formData.get("priority") || "normal"),
          notes: String(formData.get("notes") || "").trim(),
          updatedAt: serverTimestamp(),
        };

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "checklist"), itemId), payload);
        } else {
          await addDoc(collectionRef(uid, eventId, "checklist"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (entity === "note") {
        const payload = {
          text: String(formData.get("text") || "").trim(),
          type: String(formData.get("type") || "general"),
          pinned: formBoolean(formData, "pinned"),
          updatedAt: serverTimestamp(),
        };

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "notes"), itemId), payload);
        } else {
          await addDoc(collectionRef(uid, eventId, "notes"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (entity === "invoice") {
        const payload = buildInvoicePayload(formData);
        const existingInvoice = mode === "edit" ? findItem("invoices", itemId) : null;
        const invoicePayload = {
          ...payload,
          invoiceNumber: existingInvoice?.invoiceNumber || makeInvoiceNumber(),
          publicToken: existingInvoice?.publicToken || makePublicToken(),
        };

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "invoices"), itemId), invoicePayload);
        } else {
          await addDoc(collectionRef(uid, eventId, "invoices"), {
            ...invoicePayload,
            createdAt: serverTimestamp(),
          });
        }
        await syncPublicInvoice(invoicePayload);
      }

      if (entity === "expense") {
        const payload = {
          date: String(formData.get("date") || "").trim(),
          category: String(formData.get("category") || "").trim(),
          vendor: String(formData.get("vendor") || "").trim(),
          amount: roundCurrency(formData.get("amount")),
          deductible: formBoolean(formData, "deductible"),
          notes: String(formData.get("notes") || "").trim(),
          updatedAt: serverTimestamp(),
        };

        if (mode === "edit") {
          await updateDoc(doc(collectionRef(uid, eventId, "expenses"), itemId), payload);
        } else {
          await addDoc(collectionRef(uid, eventId, "expenses"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      await touchActiveEvent();
      closeModal();
      showToast("Saved", "success");
    } catch (error) {
      console.error("saveFormSubmission failed", error);
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function reorderProgramItems(reorderedIds) {
    if (!state.user || !state.activeEventId) return;

    try {
      const batch = writeBatch(db);
      reorderedIds.forEach((id, index) => {
        batch.update(doc(collectionRef(state.user.uid, state.activeEventId, "program"), id), {
          order: index + 1,
          updatedAt: serverTimestamp(),
        });
      });
      batch.update(eventRef(state.user.uid, state.activeEventId), {
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast("Program order updated", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function moveProgramItem(itemId, direction) {
    const items = [...state.program].sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    await reorderProgramItems(items.map((item) => item.id));
  }

  async function reorderPlannerActivities(reorderedIds) {
    if (!state.user || !state.activeEventId) return;

    try {
      const batch = writeBatch(db);
      reorderedIds.forEach((id, index) => {
        batch.update(doc(publicPlannerActivitiesRef(state.activeEventId), id), {
          order: index + 1,
          updatedAt: serverTimestamp(),
        });
      });
      batch.update(eventRef(state.user.uid, state.activeEventId), {
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast("Planner order updated", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function movePlannerActivity(itemId, direction) {
    const items = sortedPlannerActivities();
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    await reorderPlannerActivities(items.map((item) => item.id));
  }

  async function syncPublicEventMetadata(overrides = {}) {
    if (!state.user || !state.activeEventId || !state.activeEvent) return;
    if (!state.activeEvent.requestToken && !state.activeEvent.plannerToken) return;

    const title = overrides.title ?? state.activeEvent.title ?? "Event";
    const publicPayload = {
      title,
      ownerUid: state.user.uid,
      requestLinkEnabled: Boolean(state.activeEvent.requestToken),
      plannerLinkEnabled: Boolean(state.activeEvent.plannerToken),
      updatedAt: serverTimestamp(),
    };
    if (state.activeEvent.requestToken) publicPayload.requestToken = state.activeEvent.requestToken;
    if (state.activeEvent.plannerToken) publicPayload.plannerToken = state.activeEvent.plannerToken;
    await setDoc(publicEventRef(state.activeEventId), publicPayload, { merge: true });
  }

  async function renameActiveEvent() {
    const nextTitle = elements.activeEventTitleInput.value.trim();
    if (!state.user || !state.activeEventId || !nextTitle) return;

    try {
      await updateDoc(eventRef(state.user.uid, state.activeEventId), {
        title: nextTitle,
        updatedAt: serverTimestamp(),
      });
      await syncPublicEventMetadata({ title: nextTitle });
      showToast("Event renamed", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function deleteEventWithAllData(uid, eventId) {
    if (!uid || !eventId) return;
    try {
      const [
        programSnap,
        songsSnap,
        checklistSnap,
        notesSnap,
        invoicesSnap,
        expensesSnap,
        songRequestsSnap,
        plannerActivitiesSnap,
      ] = await Promise.all([
        getDocs(collectionRef(uid, eventId, "program")),
        getDocs(collectionRef(uid, eventId, "songs")),
        getDocs(collectionRef(uid, eventId, "checklist")),
        getDocs(collectionRef(uid, eventId, "notes")),
        getDocs(collectionRef(uid, eventId, "invoices")),
        getDocs(collectionRef(uid, eventId, "expenses")),
        getDocs(publicSongRequestsRef(eventId)),
        getDocs(publicPlannerActivitiesRef(eventId)),
      ]);
      const batch = writeBatch(db);
      programSnap.docs.forEach((d) => batch.delete(d.ref));
      songsSnap.docs.forEach((d) => batch.delete(d.ref));
      checklistSnap.docs.forEach((d) => batch.delete(d.ref));
      notesSnap.docs.forEach((d) => batch.delete(d.ref));
      invoicesSnap.docs.forEach((d) => batch.delete(d.ref));
      invoicesSnap.docs.forEach((d) => {
        const token = d.data().publicToken;
        if (token) batch.delete(publicInvoiceRef(token));
      });
      expensesSnap.docs.forEach((d) => batch.delete(d.ref));
      songRequestsSnap.docs.forEach((d) => batch.delete(d.ref));
      plannerActivitiesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(publicEventRef(eventId));
      batch.delete(eventRef(uid, eventId));
      await batch.commit();
      closeModal();
      showToast("Event deleted", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function addDjTemplateToEvent(uid, eventId) {
    if (!uid || !eventId) return;
    try {
      const currentMaxOrder = state.program.length
        ? Math.max(...state.program.map((p) => Number(p.order || 0)))
        : 0;

      const programItems = [
        { title: "DJ Setup", type: "other", order: currentMaxOrder + 1 },
        { title: "Guest Arrival Music", type: "song", order: currentMaxOrder + 2 },
        { title: "Welcome / Opening", type: "speech", order: currentMaxOrder + 3 },
        { title: "Dinner / Background Music", type: "song", order: currentMaxOrder + 4 },
        { title: "Cake Cutting", type: "other", order: currentMaxOrder + 5 },
        { title: "Birthday Song", type: "song", order: currentMaxOrder + 6 },
        { title: "Speeches / Announcements", type: "speech", order: currentMaxOrder + 7 },
        { title: "Open Dance Floor", type: "dance", order: currentMaxOrder + 8 },
        { title: "Last Song", type: "song", order: currentMaxOrder + 9 },
        { title: "Event End", type: "other", order: currentMaxOrder + 10 },
      ];

      const checklistItems = [
        { category: "Miscellaneous", item: "Send invoice" },
        { category: "Miscellaneous", item: "Confirm payment/deposit" },
        { category: "Miscellaneous", item: "Confirm event address" },
        { category: "Miscellaneous", item: "Confirm setup time" },
        { category: "Miscellaneous", item: "Confirm start time" },
        { category: "Miscellaneous", item: "Confirm end time" },
        { category: "Miscellaneous", item: "Confirm indoor/outdoor setup" },
        { category: "Miscellaneous", item: "Confirm music preferences" },
        { category: "Miscellaneous", item: "Confirm must-play songs" },
        { category: "Miscellaneous", item: "Confirm do-not-play songs" },
        { category: "Miscellaneous", item: "Confirm parking instructions" },
        { category: "Microphones", item: "Confirm microphone requirements" },
        { category: "Microphones", item: "Charge microphones" },
        { category: "Power", item: "Confirm power outlet access" },
        { category: "Power", item: "Pack extension cords" },
        { category: "Sound Gear", item: "Pack speakers" },
        { category: "Sound Gear", item: "Pack mixer" },
        { category: "Cables", item: "Pack audio cables" },
        { category: "Playback", item: "Pack laptop" },
      ];

      const planningNoteText = `DJ Client Planning Questions

Timeline:
- What time can we arrive for setup?
- What time do guests start arriving?
- What time is cake cutting?
- Are there speeches?
- Are there games or activities?
- What time does the event end?

Music:
- What type of music do you want?
- Any must-play songs?
- Any do-not-play songs?
- Are guest requests allowed?

Announcements:
- Who will speak on the microphone?
- Should we make announcements or only hand over the microphone?
- Any special introductions?

Venue:
- Indoor or outdoor?
- Is power available near setup?
- Any parking/unloading instructions?

Contact:
- Main contact person?
- Backup contact?`;

      const batch = writeBatch(db);

      programItems.forEach((item) => {
        batch.set(doc(collectionRef(uid, eventId, "program")), {
          ...item,
          audioFile: "",
          cueNotes: "",
          micNotes: "",
          duration: "",
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      checklistItems.forEach((item) => {
        batch.set(doc(collectionRef(uid, eventId, "checklist")), {
          ...item,
          checked: false,
          priority: "normal",
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      batch.set(doc(collectionRef(uid, eventId, "notes")), {
        text: planningNoteText,
        type: "reminder",
        pinned: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(eventRef(uid, eventId), {
        djTemplateAdded: true,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      closeModal();
      showToast("DJ template added", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  function createNewEvent() {
    if (!state.user) return;
    openModal("event", "create");
  }

  function currentRequestLink() {
    const token = state.activeEvent?.requestToken || "";
    if (!state.activeEventId || !token) return "";
    return requestPageUrl(state.activeEventId, token);
  }

  function currentPlannerLink() {
    const token = state.activeEvent?.plannerToken || "";
    if (!state.activeEventId || !token) return "";
    return plannerPageUrl(state.activeEventId, token);
  }

  async function ensureDjRequestLink() {
    if (!state.user || !state.activeEventId) {
      showToast("Select an event first", "error");
      return;
    }

    try {
      const token = state.activeEvent?.requestToken || makeRequestToken();
      const linkEnabledAt = state.activeEvent?.requestLinkEnabledAt || serverTimestamp();
      const publicPayload = {
        ownerUid: state.user.uid,
        title: state.activeEvent?.title || "Event",
        requestToken: token,
        requestLinkEnabled: true,
        requestLinkEnabledAt: linkEnabledAt,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(
          eventRef(state.user.uid, state.activeEventId),
          {
            requestToken: token,
            requestLinkEnabled: true,
            requestLinkEnabledAt: linkEnabledAt,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(publicEventRef(state.activeEventId), publicPayload, { merge: true }),
      ]);

      state.activeEvent = {
        ...(state.activeEvent || {}),
        requestToken: token,
        requestLinkEnabled: true,
      };
      renderSongRequests();
      showToast("Request link ready", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function ensureProgramPlannerLink() {
    if (!state.user || !state.activeEventId) {
      showToast("Select an event first", "error");
      return;
    }

    try {
      const token = state.activeEvent?.plannerToken || makeRequestToken();
      const linkEnabledAt = state.activeEvent?.plannerLinkEnabledAt || serverTimestamp();
      const publicPayload = {
        ownerUid: state.user.uid,
        title: state.activeEvent?.title || "Event",
        plannerToken: token,
        plannerLinkEnabled: true,
        plannerLinkEnabledAt: linkEnabledAt,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(
          eventRef(state.user.uid, state.activeEventId),
          {
            plannerToken: token,
            plannerLinkEnabled: true,
            plannerLinkEnabledAt: linkEnabledAt,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(publicEventRef(state.activeEventId), publicPayload, { merge: true }),
      ]);

      state.activeEvent = {
        ...(state.activeEvent || {}),
        plannerToken: token,
        plannerLinkEnabled: true,
      };
      renderPlanner();
      showToast("Planner link ready", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function copyRequestLink() {
    const link = currentRequestLink();
    if (!link) return;
    await copyTextToClipboard(link, "Request link copied");
  }

  async function copyPlannerLink() {
    const link = currentPlannerLink();
    if (!link) return;
    await copyTextToClipboard(link, "Planner link copied");
  }

  function openRequestPage() {
    const link = currentRequestLink();
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function openPlannerPage() {
    const link = currentPlannerLink();
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function downloadRequestQrCode() {
    const link = currentRequestLink();
    if (!link) return;

    const qrUrl = qrCodeUrl(link, 720);
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${slugify(state.activeEvent?.title || "dj-request")}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      showToast("QR code downloaded", "success");
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
      showToast("QR code opened in a new tab", "info");
    }
  }

  async function downloadPlannerQrCode() {
    const link = currentPlannerLink();
    if (!link) return;

    const qrUrl = qrCodeUrl(link, 720);
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${slugify(state.activeEvent?.title || "program-planner")}-planner-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      showToast("Planner QR code downloaded", "success");
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
      showToast("Planner QR code opened in a new tab", "info");
    }
  }

  async function openPlannerUpload(itemId) {
    const item = findItem("plannerUploads", itemId);
    if (!item?.storagePath) {
      showToast("Upload file path is missing", "error");
      return;
    }

    try {
      const url = await getDownloadURL(storageRef(storage, item.storagePath));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("openPlannerUpload failed", error);
      showToast("Could not open uploaded file", "error");
    }
  }

  async function markPlannerUploadReviewed(itemId) {
    if (!state.activeEventId) return;
    await updateDoc(doc(publicUploadsRef(state.activeEventId), itemId), {
      status: "reviewed",
      updatedAt: serverTimestamp(),
    });
    await touchActiveEvent();
    showToast("Upload marked reviewed", "success");
  }

  function buildInvoiceEmail(item) {
    const link = item.publicToken ? publicInvoiceUrl(item.publicToken) : "";
    const subject = `Invoice for ${item.eventTitle || state.activeEvent?.title || "your event"}`;
    const lineItems = getInvoiceLineItems(item);
    const lineItemSummary = lineItems.map(
      (lineItem) => `${lineItem.description || "Item"} (${lineItem.quantity} x ${formatMoney(lineItem.unitPrice)}): ${formatMoney(lineItem.amount)}`
    );
    const body = [
      `Hello ${item.clientName || ""},`,
      "",
      `Here are the invoice details for ${item.eventTitle || state.activeEvent?.title || "your event"}:`,
      `Invoice number: ${item.invoiceNumber || ""}`,
      ...lineItemSummary,
      `Subtotal: ${formatMoney(item.subtotal)}`,
      `Tax: ${formatMoney(item.taxAmount)}`,
      `Total: ${formatMoney(item.total)}`,
      `Deposit paid: ${formatMoney(item.depositPaid)}`,
      `Balance due: ${formatMoney(item.balanceDue)}`,
      item.dueDate ? `Due date: ${toDateInputValue(item.dueDate)}` : "",
      link ? `Invoice link: ${link}` : "",
      "",
      item.paymentInstructions || invoicePaymentInstructions(),
      "",
      item.notes ? `Notes: ${item.notes}` : "",
      "",
      "Thank you.",
    ].filter((line) => line !== "");

    return `mailto:${encodeURIComponent(item.clientEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.join("\n"))}`;
  }

  async function copyTextToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, "success");
    } catch {
      showToast("Copy failed. Select and copy manually.", "error");
    }
  }

  function csvEscape(value) {
    const stringValue = String(value ?? "");
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  function downloadCsv(filename, rows) {
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportInvoicesCsv() {
    const rows = [
      [
        "client name",
        "client email",
        "event title",
        "invoice number",
        "invoice date",
        "subtotal",
        "line items",
        "tax rate",
        "tax amount",
        "total",
        "deposit paid",
        "balance due",
        "status",
        "due date",
        "notes",
        "payment instructions",
        "public link",
      ],
      ...getFilteredInvoices().map((item) => [
        item.clientName || "",
        item.clientEmail || "",
        item.eventTitle || "",
        item.invoiceNumber || "",
        toDateInputValue(item.invoiceDate),
        toNumber(item.subtotal).toFixed(2),
        getInvoiceLineItems(item)
          .map((lineItem) => `${lineItem.description || "Item"} (${lineItem.quantity} x ${lineItem.unitPrice} = ${lineItem.amount})`)
          .join("; "),
        toNumber(item.taxRate),
        toNumber(item.taxAmount).toFixed(2),
        toNumber(item.total).toFixed(2),
        toNumber(item.depositPaid).toFixed(2),
        toNumber(item.balanceDue).toFixed(2),
        item.status || "draft",
        toDateInputValue(item.dueDate),
        item.notes || "",
        item.paymentInstructions || invoicePaymentInstructions(),
        item.publicToken ? publicInvoiceUrl(item.publicToken) : "",
      ]),
    ];
    downloadCsv(`invoices-${state.filters.financeYear}.csv`, rows);
    showToast("Invoices CSV exported", "success");
  }

  function exportExpensesCsv() {
    const rows = [
      ["date", "category", "vendor", "amount", "deductible", "notes"],
      ...getFilteredExpenses().map((item) => [
        toDateInputValue(item.date),
        item.category || "",
        item.vendor || "",
        toNumber(item.amount).toFixed(2),
        item.deductible ? "yes" : "no",
        item.notes || "",
      ]),
    ];
    downloadCsv(`expenses-${state.filters.financeYear}.csv`, rows);
    showToast("Expenses CSV exported", "success");
  }

  function findItem(collectionName, id) {
    return state[collectionName].find((item) => item.id === id);
  }

  async function restoreDeletedItem(section, collectionName, snapshot) {
    const restored = cloneItem(snapshot);
    if (!restored?.id) return;

    const { id, ...payload } = restored;
    await setDoc(doc(collectionRef(state.user.uid, state.activeEventId, collectionName), id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    await touchActiveEvent();
    clearUndoEntry(section);
    showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} restored`, "success");
  }

  async function applyUndo(section) {
    const entry = state.undo[section];
    if (!entry || !state.user || !state.activeEventId) return;

    try {
      if (entry.kind === "delete") {
        await restoreDeletedItem(section, entry.collectionName, entry.snapshot);
        return;
      }

      if (entry.kind === "update") {
        await updateDoc(doc(collectionRef(state.user.uid, state.activeEventId, entry.collectionName), entry.id), {
          ...entry.previousValues,
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
        clearUndoEntry(section);
        showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} updated`, "success");
      }
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function handleEntityAction(action, id, extra = "") {
    if (!state.user || !state.activeEventId) return;

    console.log("handleEntityAction", { action, id, extra });
    const uid = state.user.uid;
    const eventId = state.activeEventId;

    try {
      if (action === "toggle-details") {
        toggleDetails(extra, id);
        if (extra === "program") renderProgram();
        if (extra === "songs") renderSongs();
        if (extra === "invoices" || extra === "expenses") renderFinance();
        return;
      }

      if (action === "toggle-menu") {
        toggleMenu(extra, id);
        if (extra === "program") renderProgram();
        if (extra === "songs") renderSongs();
        if (extra === "checklist") renderChecklist();
        if (extra === "notes") renderNotes();
        if (extra === "invoices" || extra === "expenses") renderFinance();
        if (extra === "planner-activities") renderPlanner();
        return;
      }

      if (action === "edit-program") {
        closeOpenMenu();
        openModal("program", "edit", findItem("program", id));
      }
      if (action === "edit-song") {
        closeOpenMenu();
        openModal("song", "edit", findItem("songs", id));
      }
      if (action === "edit-checklist") {
        closeOpenMenu();
        openModal("checklist", "edit", findItem("checklist", id));
      }
      if (action === "edit-note") {
        closeOpenMenu();
        openModal("note", "edit", findItem("notes", id));
      }
      if (action === "edit-invoice") {
        closeOpenMenu();
        openModal("invoice", "edit", findItem("invoices", id));
      }
      if (action === "edit-planner-activity") {
        closeOpenMenu();
        openModal("planner-activity", "edit", findItem("plannerActivities", id));
      }
      if (action === "edit-expense") {
        closeOpenMenu();
        openModal("expense", "edit", findItem("expenses", id));
      }

      if (action === "delete-program") {
        setUndoEntry("program", {
          kind: "delete",
          label: "Delete",
          collectionName: "program",
          snapshot: cloneItem(findItem("program", id)),
        });
        await deleteDoc(doc(collectionRef(uid, eventId, "program"), id));
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Program item deleted", "success");
      }

      if (action === "delete-song") {
        setUndoEntry("songs", {
          kind: "delete",
          label: "Delete",
          collectionName: "songs",
          snapshot: cloneItem(findItem("songs", id)),
        });
        await deleteDoc(doc(collectionRef(uid, eventId, "songs"), id));
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Song deleted", "success");
      }

      if (action === "delete-checklist") {
        setUndoEntry("checklist", {
          kind: "delete",
          label: "Delete",
          collectionName: "checklist",
          snapshot: cloneItem(findItem("checklist", id)),
        });
        await deleteDoc(doc(collectionRef(uid, eventId, "checklist"), id));
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Checklist item deleted", "success");
      }

      if (action === "delete-note") {
        setUndoEntry("notes", {
          kind: "delete",
          label: "Delete",
          collectionName: "notes",
          snapshot: cloneItem(findItem("notes", id)),
        });
        await deleteDoc(doc(collectionRef(uid, eventId, "notes"), id));
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Note deleted", "success");
      }

      if (action === "delete-invoice") {
        const invoice = findItem("invoices", id);
        await deleteDoc(doc(collectionRef(uid, eventId, "invoices"), id));
        if (invoice?.publicToken) {
          await deleteDoc(publicInvoiceRef(invoice.publicToken));
        }
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Invoice deleted", "success");
      }

      if (action === "delete-expense") {
        await deleteDoc(doc(collectionRef(uid, eventId, "expenses"), id));
        await touchActiveEvent();
        closeOpenMenu();
        showToast("Expense deleted", "success");
      }

      if (action === "request-status" || action === "request-played") {
        const nextStatus = action === "request-played" ? "Played" : normalizeRequestStatus(extra);
        await updateDoc(doc(publicSongRequestsRef(eventId), id), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
        showToast(`Request marked ${nextStatus}`, "success");
      }

      if (action === "delete-request") {
        await deleteDoc(doc(publicSongRequestsRef(eventId), id));
        await touchActiveEvent();
        showToast("Request deleted", "success");
      }

      if (action === "delete-planner-activity") {
        closeOpenMenu();
        await deleteDoc(doc(publicPlannerActivitiesRef(eventId), id));
        await touchActiveEvent();
        showToast("Planner activity deleted", "success");
      }

      if (action === "mark-planner-added") {
        closeOpenMenu();
        const plannerItem = findItem("plannerActivities", id);
        if (!plannerItem) return;
        await updateDoc(doc(publicPlannerActivitiesRef(eventId), id), {
          addedToProgram: !plannerItem.addedToProgram,
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
        showToast(plannerItem.addedToProgram ? "Activity marked submitted" : "Activity marked added", "success");
      }

      if (action === "copy-planner-to-program") {
        await addPlannerActivityToProgram(id, false);
      }

      if (action === "move-planner-to-program") {
        await addPlannerActivityToProgram(id, true);
      }

      if (action === "download-planner-upload") {
        await openPlannerUpload(id);
      }

      if (action === "mark-upload-reviewed") {
        await markPlannerUploadReviewed(id);
      }

      if (action === "email-invoice") {
        const invoice = await ensurePublicInvoice(findItem("invoices", id));
        if (!invoice) return;
        window.location.href = buildInvoiceEmail(invoice);
        showToast("Invoice email draft opened", "info");
      }

      if (action === "copy-invoice-link") {
        const invoice = await ensurePublicInvoice(findItem("invoices", id));
        if (!invoice?.publicToken) return;
        await copyTextToClipboard(publicInvoiceUrl(invoice.publicToken), "Invoice link copied");
      }

      if (action === "program-ready" || action === "program-done") {
        const programItem = findItem("program", id);
        if (!programItem) return;
        setUndoEntry("program", {
          kind: "update",
          label: "Status",
          collectionName: "program",
          id,
          previousValues: { status: programItem.status || "pending" },
        });
        await updateDoc(doc(collectionRef(uid, eventId, "program"), id), {
          status: action === "program-ready" ? "ready" : "done",
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
      }

      if (action === "program-up") await moveProgramItem(id, "up");
      if (action === "program-down") await moveProgramItem(id, "down");
      if (action === "planner-up") await movePlannerActivity(id, "up");
      if (action === "planner-down") await movePlannerActivity(id, "down");

      if (action === "toggle-song-file" || action === "toggle-song-approved" || action === "toggle-song-backup") {
        const song = findItem("songs", id);
        if (!song) return;

        const updates = normalizeSongPayload({
          fileReceived: song.fileReceived,
          finalApproved: song.finalApproved,
          backupReady: song.backupReady,
          updatedAt: serverTimestamp(),
        });

        if (action === "toggle-song-file") updates.fileReceived = !song.fileReceived;
        if (action === "toggle-song-approved") updates.finalApproved = !song.finalApproved;
        if (action === "toggle-song-backup") updates.backupReady = !song.backupReady;
        updates.songStatus = getSongStatus(updates);

        setUndoEntry("songs", {
          kind: "update",
          label:
            action === "toggle-song-approved"
              ? "Approve"
              : action === "toggle-song-backup"
                ? "Backup"
                : "File",
          collectionName: "songs",
          id,
          previousValues: normalizeSongPayload({
            fileReceived: song.fileReceived,
            finalApproved: song.finalApproved,
            backupReady: song.backupReady,
          }),
        });

        await updateDoc(doc(collectionRef(uid, eventId, "songs"), id), updates);
        await touchActiveEvent();
      }

      if (action === "toggle-checklist") {
        const item = findItem("checklist", id);
        if (!item) return;
        setUndoEntry("checklist", {
          kind: "update",
          label: "Check",
          collectionName: "checklist",
          id,
          previousValues: { checked: item.checked },
        });
        await updateDoc(doc(collectionRef(uid, eventId, "checklist"), id), {
          checked: !item.checked,
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
      }

      if (action === "complete-category") {
        const batch = writeBatch(db);
        state.checklist
          .filter((item) => item.category === extra && !item.checked)
          .forEach((item) => {
            batch.update(doc(collectionRef(uid, eventId, "checklist"), item.id), {
              checked: true,
              updatedAt: serverTimestamp(),
            });
          });
        batch.update(eventRef(uid, eventId), {
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast("Category marked complete", "success");
      }

      if (action === "toggle-note-pin") {
        const note = findItem("notes", id);
        if (!note) return;
        setUndoEntry("notes", {
          kind: "update",
          label: note.pinned ? "Unpin" : "Pin",
          collectionName: "notes",
          id,
          previousValues: { pinned: note.pinned },
        });
        await updateDoc(doc(collectionRef(uid, eventId, "notes"), id), {
          pinned: !note.pinned,
          updatedAt: serverTimestamp(),
        });
        await touchActiveEvent();
      }

      renderUndoButtons();
    } catch (error) {
      console.error("handleEntityAction failed", { action, id, extra, error });
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function handleCreateAccount() {
    console.log("create account clicked");
    const { email, password } = getCredentials();

    try {
      showMessage("Creating account...");
      await createUserWithEmailAndPassword(auth, email, password);
      showMessage("Account created successfully.");
      showToast("Account created", "success");
    } catch (error) {
      showMessage(mapFirebaseError(error), true);
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function handleSignIn() {
    console.log("sign in clicked");
    const { email, password } = getCredentials();

    try {
      showMessage("Signing in...");
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("Sign in successful.");
      showToast("Signed in", "success");
    } catch (error) {
      showMessage(mapFirebaseError(error), true);
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function handleSignOut() {
    console.log("sign out clicked");

    try {
      showMessage("Signing out...");
      await signOut(auth);
      showMessage("Signed out.");
      showToast("Signed out", "info");
    } catch (error) {
      showMessage(mapFirebaseError(error), true);
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function handleForgotPassword() {
    const email = elements.email.value.trim();

    if (!email) {
      const message = "Enter your email first to reset your password.";
      showMessage(message, true);
      showToast(message, "error");
      return;
    }

    try {
      showMessage("Sending password reset email...");
      await sendPasswordResetEmail(auth, email);
      showMessage("Password reset email sent. Check your inbox.");
      showToast("Password reset email sent", "success");
    } catch (error) {
      showMessage(mapFirebaseError(error), true);
      showToast(mapFirebaseError(error), "error");
    }
  }

  function bindQuickActions() {
    elements.quickAddProgram.addEventListener("click", () => openModal("program", "create"));
    elements.quickAddSong.addEventListener("click", () => openModal("song", "create"));
    elements.quickAddChecklist.addEventListener("click", () => openModal("checklist", "create"));
    elements.quickAddNote.addEventListener("click", () => openModal("note", "create"));
    elements.addProgramBtn.addEventListener("click", () => openModal("program", "create"));
    elements.addSongBtn.addEventListener("click", () => openModal("song", "create"));
    elements.addChecklistBtn.addEventListener("click", () => openModal("checklist", "create"));
    elements.addNoteBtn.addEventListener("click", () => openModal("note", "create"));
    elements.editEventBtn.addEventListener("click", () => {
      if (!state.activeEvent) {
        showToast("Select an event first", "error");
        return;
      }
      openModal("event", "edit", state.activeEvent);
    });
    elements.addInvoiceBtn.addEventListener("click", () => openModal("invoice", "create"));
    elements.addExpenseBtn.addEventListener("click", () => openModal("expense", "create"));
    elements.exportInvoicesCsvBtn.addEventListener("click", exportInvoicesCsv);
    elements.exportExpensesCsvBtn.addEventListener("click", exportExpensesCsv);
    elements.invoiceSettingsForm.addEventListener("submit", saveInvoiceSettings);
    elements.createRequestLinkBtn.addEventListener("click", ensureDjRequestLink);
    elements.copyRequestLinkBtn.addEventListener("click", copyRequestLink);
    elements.downloadRequestQrBtn.addEventListener("click", downloadRequestQrCode);
    elements.openRequestPageBtn.addEventListener("click", openRequestPage);
    elements.createPlannerLinkBtn.addEventListener("click", ensureProgramPlannerLink);
    elements.copyPlannerLinkBtn.addEventListener("click", copyPlannerLink);
    elements.downloadPlannerQrBtn.addEventListener("click", downloadPlannerQrCode);
    elements.openPlannerPageBtn.addEventListener("click", openPlannerPage);
  }

  function bindFilters() {
    elements.programSearch.addEventListener("input", (event) => {
      state.filters.programSearch = event.target.value.trim();
      renderProgram();
    });

    elements.programFilter.addEventListener("change", (event) => {
      state.filters.programStatus = event.target.value;
      renderProgram();
    });

    elements.songsSearch.addEventListener("input", (event) => {
      state.filters.songsSearch = event.target.value.trim();
      renderSongs();
    });

    elements.songsFilter.addEventListener("change", (event) => {
      state.filters.songsStatus = event.target.value;
      renderSongs();
    });

    elements.checklistFilter.addEventListener("change", (event) => {
      state.filters.checklistStatus = event.target.value;
      renderChecklist();
    });

    elements.notesFilter.addEventListener("change", (event) => {
      state.filters.notesType = event.target.value;
      renderNotes();
    });

    elements.financeYearFilter.addEventListener("change", (event) => {
      state.filters.financeYear = event.target.value;
      renderFinance();
    });
  }

  function bindEntityDelegation() {
    elements.programList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "program");
    });

    elements.songsList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "songs");
    });

    elements.checklistList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(
        button.dataset.action,
        button.dataset.id,
        button.dataset.section || button.dataset.category || "checklist"
      );
    });

    elements.notesList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "notes");
    });

    elements.invoicesList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "invoices");
    });

    elements.expensesList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "expenses");
    });

    elements.songRequestsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "songRequests");
    });

    elements.songRequestsList.addEventListener("change", (event) => {
      const field = event.target.closest("select[data-action]");
      if (!field) return;
      handleEntityAction(field.dataset.action, field.dataset.id, field.value);
    });

    elements.plannerActivitiesList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "plannerActivities");
    });

    elements.plannerUploadsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      handleEntityAction(button.dataset.action, button.dataset.id, button.dataset.section || "plannerUploads");
    });
  }

  function bindUndoControls() {
    elements.programUndoBtn.addEventListener("click", () => applyUndo("program"));
    elements.songsUndoBtn.addEventListener("click", () => applyUndo("songs"));
    elements.checklistUndoBtn.addEventListener("click", () => applyUndo("checklist"));
    elements.notesUndoBtn.addEventListener("click", () => applyUndo("notes"));
    elements.dashboardDetailsToggle.addEventListener("click", () => {
      state.dashboardSummaryOpen = !state.dashboardSummaryOpen;
      renderDashboardSummary();
    });
  }

  function bindProgramDragAndDrop() {
    elements.programList.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".program-card");
      if (!card) return;
      state.dragProgramId = card.dataset.programId;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });

    elements.programList.addEventListener("dragend", (event) => {
      const card = event.target.closest(".program-card");
      if (card) card.classList.remove("dragging");
      state.dragProgramId = null;
      elements.programList.querySelectorAll(".program-card").forEach((item) => item.classList.remove("drop-target"));
    });

    elements.programList.addEventListener("dragover", (event) => {
      event.preventDefault();
      const card = event.target.closest(".program-card");
      if (!card || !state.dragProgramId) return;
      elements.programList.querySelectorAll(".program-card").forEach((item) => item.classList.remove("drop-target"));
      if (card.dataset.programId !== state.dragProgramId) {
        card.classList.add("drop-target");
      }
    });

    elements.programList.addEventListener("drop", async (event) => {
      event.preventDefault();
      const targetCard = event.target.closest(".program-card");
      if (!targetCard || !state.dragProgramId || targetCard.dataset.programId === state.dragProgramId) return;

      const items = [...state.program].sort((a, b) => (a.order || 0) - (b.order || 0));
      const sourceIndex = items.findIndex((item) => item.id === state.dragProgramId);
      const targetIndex = items.findIndex((item) => item.id === targetCard.dataset.programId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);
      await reorderProgramItems(items.map((item) => item.id));
    });
  }

  function bindPlannerDragAndDrop() {
    elements.plannerActivitiesList.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".planner-activity-card");
      if (!card) return;
      state.dragPlannerActivityId = card.dataset.plannerId;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });

    elements.plannerActivitiesList.addEventListener("dragend", (event) => {
      const card = event.target.closest(".planner-activity-card");
      if (card) card.classList.remove("dragging");
      state.dragPlannerActivityId = null;
      elements.plannerActivitiesList
        .querySelectorAll(".planner-activity-card")
        .forEach((item) => item.classList.remove("drop-target"));
    });

    elements.plannerActivitiesList.addEventListener("dragover", (event) => {
      event.preventDefault();
      const card = event.target.closest(".planner-activity-card");
      if (!card || !state.dragPlannerActivityId) return;
      elements.plannerActivitiesList
        .querySelectorAll(".planner-activity-card")
        .forEach((item) => item.classList.remove("drop-target"));
      if (card.dataset.plannerId !== state.dragPlannerActivityId) {
        card.classList.add("drop-target");
      }
    });

    elements.plannerActivitiesList.addEventListener("drop", async (event) => {
      event.preventDefault();
      const targetCard = event.target.closest(".planner-activity-card");
      if (!targetCard || !state.dragPlannerActivityId || targetCard.dataset.plannerId === state.dragPlannerActivityId) return;

      const items = sortedPlannerActivities();
      const sourceIndex = items.findIndex((item) => item.id === state.dragPlannerActivityId);
      const targetIndex = items.findIndex((item) => item.id === targetCard.dataset.plannerId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);
      await reorderPlannerActivities(items.map((item) => item.id));
    });
  }

  function bindModal() {
    elements.modalCloseBtn.addEventListener("click", closeModal);
    elements.modalOverlay.addEventListener("click", (event) => {
      if (event.target === elements.modalOverlay) closeModal();
    });
    elements.itemForm.addEventListener("submit", saveFormSubmission);
    elements.itemForm.addEventListener("click", (event) => {
      if (event.target.id === "modal-cancel-btn") closeModal();
      if (event.target.dataset.action === "add-line-item") addInvoiceLineItemRow();
      if (event.target.dataset.action === "remove-line-item") {
        const row = event.target.closest("[data-line-item-row]");
        const rows = elements.itemForm.querySelectorAll("[data-line-item-row]");
        if (row && rows.length > 1) row.remove();
        refreshInvoiceModalCalculations();
      }
    });
    elements.itemForm.addEventListener("input", (event) => {
      if (state.modal.entity !== "invoice") return;
      if (event.target.name === "invoiceDate" && !elements.itemForm.dueDate.value) {
        elements.itemForm.dueDate.value = addDaysToDateInput(event.target.value, state.invoiceSettings.defaultDueDays);
      }
      refreshInvoiceModalCalculations();
    });
    elements.itemForm.addEventListener("change", (event) => {
      if (state.modal.entity !== "invoice") return;
      if (event.target.name === "showTaxOnInvoice" || event.target.name === "lineTaxable") {
        refreshInvoiceModalCalculations();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (state.modal.entity) closeModal();
        if (state.mobileMenuOpen) closeMobileMenu();
        if (state.openMenu.id) {
          closeOpenMenu();
          renderProgram();
          renderSongs();
          renderChecklist();
          renderNotes();
          renderFinance();
        }
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".item-menu-wrap")) {
        const hadOpenMenu = Boolean(state.openMenu.id);
        if (hadOpenMenu) {
          closeOpenMenu();
          renderProgram();
          renderSongs();
          renderChecklist();
          renderNotes();
          renderFinance();
        }
      }
    });
  }

  function bindNavigation() {
    elements.mobileMenuButton.addEventListener("click", () => {
      if (state.mobileMenuOpen) {
        closeMobileMenu();
        return;
      }
      openMobileMenu();
    });

    elements.mobileMenuCloseBtn.addEventListener("click", closeMobileMenu);
    elements.mobileNavOverlay.addEventListener("click", (event) => {
      if (event.target === elements.mobileNavOverlay) closeMobileMenu();
    });

    elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
  }

  function bindEvents() {
    elements.createAccountBtn.addEventListener("click", handleCreateAccount);
    elements.signInBtn.addEventListener("click", handleSignIn);
    elements.forgotPasswordBtn.addEventListener("click", handleForgotPassword);
    elements.signOutBtn.addEventListener("click", handleSignOut);
    elements.renameEventBtn.addEventListener("click", renameActiveEvent);
    elements.newEventBtn.addEventListener("click", createNewEvent);
    elements.dashboardNewEventBtn.addEventListener("click", createNewEvent);
    elements.eventSelector.addEventListener("change", (event) => {
      selectActiveEvent(event.target.value);
    });

    elements.deleteEventBtn.addEventListener("click", () => {
      if (!state.user || !state.activeEventId) return;
      openModal("delete-event", "confirm", { id: state.activeEventId, title: state.activeEvent?.title });
    });

    elements.addDjTemplateBtn.addEventListener("click", () => {
      if (!state.user || !state.activeEventId) return;
      if (state.activeEvent?.djTemplateAdded) {
        showToast("DJ template already added to this event", "error");
        return;
      }
      openModal("dj-template", "confirm");
    });

    bindNavigation();
    bindQuickActions();
    bindFilters();
    bindEntityDelegation();
    bindUndoControls();
    bindProgramDragAndDrop();
    bindPlannerDragAndDrop();
    bindModal();
  }

  function watchAuth() {
    onAuthStateChanged(auth, async (user) => {
      console.log("auth state changed", user ? user.email : "signed out");
      unsubscribeAll();

      if (!user) {
        state.user = null;
        setSignedOutUi();
        return;
      }

      state.user = user;
      setSignedInUi(user);

      try {
        const activeEventId = await ensureActiveEvent(user);
        await setActiveEventId(activeEventId);
        handleInvoiceSettingsSnapshot(user);
        handleEventsSnapshot(user);
        await handleMetaSnapshot(user);
        showMessage("Firestore connected.");
      } catch (error) {
        clearRenderedData();
        showMessage(mapFirebaseError(error), true);
        showToast(mapFirebaseError(error), "error");
      }
    });
  }

  applyAppBranding();
  bindEvents();
  switchTab("dashboard");
  setSignedOutUi();
  renderProgram();
  renderSongs();
  renderChecklist();
  renderNotes();
  renderFinance();
  renderSongRequests();
  renderPlanner();
  renderUndoButtons();
  renderDashboardSummary();
  watchAuth();
});
