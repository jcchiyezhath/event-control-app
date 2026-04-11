import { auth, db } from "./firebase-config.js";
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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const pageCopy = {
    dashboard: "Live event control for phone and laptop.",
    program: "Running order, status, and cue tracking.",
    songs: "Files, approvals, and backup readiness.",
    checklist: "Fast setup checks grouped by category.",
    notes: "Urgent updates and live reminders.",
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

  const state = {
    user: null,
    activeEventId: null,
    activeEvent: null,
    program: [],
    songs: [],
    checklist: [],
    notes: [],
    filters: {
      programSearch: "",
      programStatus: "all",
      songsSearch: "",
      songsStatus: "all",
      checklistStatus: "all",
      notesType: "all",
    },
    unsubscribers: {
      activeMeta: null,
      activeEvent: null,
      program: null,
      songs: null,
      checklist: null,
      notes: null,
    },
    dragProgramId: null,
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
    renameEventBtn: document.querySelector("#rename-event-btn"),
    newEventBtn: document.querySelector("#new-event-btn"),
    dashboardEventTitle: document.querySelector("#dashboard-event-title"),
    dashboardProgramCount: document.querySelector("#dashboard-program-count"),
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
    programSearch: document.querySelector("#program-search"),
    programFilter: document.querySelector("#program-filter"),
    songsSearch: document.querySelector("#songs-search"),
    songsFilter: document.querySelector("#songs-filter"),
    checklistFilter: document.querySelector("#checklist-filter"),
    notesFilter: document.querySelector("#notes-filter"),
    addProgramBtn: document.querySelector("#add-program-btn"),
    programUndoBtn: document.querySelector("#program-undo-btn"),
    addSongBtn: document.querySelector("#add-song-btn"),
    songsUndoBtn: document.querySelector("#songs-undo-btn"),
    addChecklistBtn: document.querySelector("#add-checklist-btn"),
    checklistUndoBtn: document.querySelector("#checklist-undo-btn"),
    addNoteBtn: document.querySelector("#add-note-btn"),
    notesUndoBtn: document.querySelector("#notes-undo-btn"),
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

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cloneItem(item) {
    return item ? { ...item } : null;
  }

  function getSongStatus(item) {
    if (!item?.fileReceived) return "file missing";
    if (item.finalApproved) return "good";
    return "issue";
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
    elements.pageTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
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
    state.detailsOpen.program = {};
    state.detailsOpen.songs = {};
    closeOpenMenu();
  }

  function clearRenderedData() {
    clearCollectionsState();
    state.activeEvent = null;
    state.activeEventId = null;
    state.undo.program = null;
    state.undo.songs = null;
    state.undo.checklist = null;
    state.undo.notes = null;
    elements.activeEventTitle.textContent = "Not loaded";
    elements.activeEventUpdated.textContent = "No event selected";
    elements.activeEventTitleInput.value = "";
    renderDashboard();
    renderProgram();
    renderSongs();
    renderChecklist();
    renderNotes();
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

  function eventRef(uid, eventId) {
    return doc(db, "users", uid, "events", eventId);
  }

  function collectionRef(uid, eventId, name) {
    return collection(db, "users", uid, "events", eventId, name);
  }

  async function touchActiveEvent() {
    if (!state.user || !state.activeEventId) return;

    await updateDoc(eventRef(state.user.uid, state.activeEventId), {
      updatedAt: serverTimestamp(),
    });
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
    elements.dashboardProgramCount.textContent = String(state.program.length);
    elements.dashboardSongCount.textContent = String(state.songs.length);
    elements.dashboardMissingSongs.textContent = String(missingSongs);
    elements.dashboardIncompleteChecklist.textContent = String(incompleteChecklist);
    elements.dashboardNotesCount.textContent = String(state.notes.length);
    elements.dashboardLastUpdated.textContent = lastUpdated;
    elements.dashboardReadyProgram.textContent = String(readyProgram);
    elements.dashboardDoneProgram.textContent = String(doneProgram);
    elements.dashboardApprovedSongs.textContent = String(approvedSongs);
    elements.dashboardPinnedNotes.textContent = String(pinnedNotes);
    renderDashboardSummary();
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

  function openModal(entity, mode, item = null) {
    state.modal = {
      entity,
      mode,
      itemId: item?.id || null,
    };

    const actionLabel = mode === "edit" ? "Save Changes" : "Create";
    let fieldsMarkup = "";

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

    elements.modalTitle.textContent = `${mode === "edit" ? "Edit" : "Add"} ${entity.charAt(0).toUpperCase() + entity.slice(1)}`;
    elements.itemForm.innerHTML = `
      ${fieldsMarkup}
      <div class="modal-actions">
        <button type="button" id="modal-cancel-btn">Cancel</button>
        <button type="submit" class="primary">${actionLabel}</button>
      </div>
    `;
    elements.modalOverlay.classList.remove("hidden");
    elements.modalOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
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

  function nowProgramOrder() {
    if (!state.program.length) return 1;
    return Math.max(...state.program.map((item) => Number(item.order || 0))) + 1;
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

  async function createEventForUser(uid, title = "My Current Event") {
    const eventId = `${slugify(title) || "event"}-${Date.now()}`;
    await setDoc(eventRef(uid, eventId), {
      title,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(userMetaRef(uid), {
      activeEventId: eventId,
      updatedAt: serverTimestamp(),
    });
    await ensureEventSeed(uid, eventId);
    return eventId;
  }

  async function ensureActiveEvent(user) {
    const metaRef = userMetaRef(user.uid);
    const metaSnapshot = await getDoc(metaRef);
    let activeEventId = metaSnapshot.exists() ? metaSnapshot.data().activeEventId : null;

    if (!activeEventId) {
      activeEventId = await createEventForUser(user.uid, "My Current Event");
    } else {
      await ensureEventSeed(user.uid, activeEventId);
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
  }

  async function setActiveEventId(activeEventId) {
    if (!state.user || !activeEventId || state.activeEventId === activeEventId) return;
    state.activeEventId = activeEventId;
    clearCollectionsState();
    renderProgram();
    renderSongs();
    renderChecklist();
    renderNotes();
    await ensureEventSeed(state.user.uid, activeEventId);
    attachActiveEventListeners();
  }

  async function handleMetaSnapshot(user) {
    if (state.unsubscribers.activeMeta) state.unsubscribers.activeMeta();

    state.unsubscribers.activeMeta = onSnapshot(
      userMetaRef(user.uid),
      async (snapshot) => {
        const activeEventId = snapshot.exists() ? snapshot.data().activeEventId : null;

        if (!activeEventId) {
          const createdId = await createEventForUser(user.uid, "My Current Event");
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

  async function saveFormSubmission(event) {
    event.preventDefault();
    if (!state.user || !state.activeEventId || !state.modal.entity) return;

    const formData = new FormData(elements.itemForm);
    const { entity, mode, itemId } = state.modal;
    const uid = state.user.uid;
    const eventId = state.activeEventId;

    try {
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

  async function renameActiveEvent() {
    const nextTitle = elements.activeEventTitleInput.value.trim();
    if (!state.user || !state.activeEventId || !nextTitle) return;

    try {
      await updateDoc(eventRef(state.user.uid, state.activeEventId), {
        title: nextTitle,
        updatedAt: serverTimestamp(),
      });
      showToast("Event renamed", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
  }

  async function createNewEvent() {
    if (!state.user) return;

    try {
      const title = `My Current Event ${new Date().toLocaleDateString()}`;
      await createEventForUser(state.user.uid, title);
      showToast("New event created", "success");
    } catch (error) {
      showToast(mapFirebaseError(error), "error");
    }
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
        return;
      }

      if (action === "toggle-menu") {
        toggleMenu(extra, id);
        if (extra === "program") renderProgram();
        if (extra === "songs") renderSongs();
        if (extra === "checklist") renderChecklist();
        if (extra === "notes") renderNotes();
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

  function bindModal() {
    elements.modalCloseBtn.addEventListener("click", closeModal);
    elements.modalOverlay.addEventListener("click", (event) => {
      if (event.target === elements.modalOverlay) closeModal();
    });
    elements.itemForm.addEventListener("submit", saveFormSubmission);
    elements.itemForm.addEventListener("click", (event) => {
      if (event.target.id === "modal-cancel-btn") closeModal();
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

    bindNavigation();
    bindQuickActions();
    bindFilters();
    bindEntityDelegation();
    bindUndoControls();
    bindProgramDragAndDrop();
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
        await ensureActiveEvent(user);
        await handleMetaSnapshot(user);
        showMessage("Firestore connected.");
      } catch (error) {
        clearRenderedData();
        showMessage(mapFirebaseError(error), true);
        showToast(mapFirebaseError(error), "error");
      }
    });
  }

  bindEvents();
  switchTab("dashboard");
  setSignedOutUi();
  renderProgram();
  renderSongs();
  renderChecklist();
  renderNotes();
  renderUndoButtons();
  renderDashboardSummary();
  watchAuth();
});
