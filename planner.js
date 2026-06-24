import { db, storage } from "./firebase-config.js";
import {
  addDoc,
  collection,
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
import {
  ref as storageRef,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event") || "";
  const token = params.get("token") || "";

  const form = document.querySelector("#planner-form");
  const eventTitle = document.querySelector("#planner-event-title");
  const status = document.querySelector("#planner-status");
  const submitBtn = document.querySelector("#add-planner-activity-btn");
  const list = document.querySelector("#public-planner-list");
  const activityCountBadge = document.querySelector("#activity-count");
  const quickAddButtons = document.querySelectorAll("[data-quick-activity]");
  const methodButtons = document.querySelectorAll("[data-planner-method]");
  const methodPanels = document.querySelectorAll("[data-method-panel]");
  const pasteText = document.querySelector("#paste-program-text");
  const createFromTextBtn = document.querySelector("#create-activities-from-text-btn");
  const pasteDraftList = document.querySelector("#paste-activity-drafts");
  const submitPasteBtn = document.querySelector("#submit-paste-activities-btn");
  const pasteStatus = document.querySelector("#paste-planner-status");
  const uploadForm = document.querySelector("#upload-planner-form");
  const uploadBtn = document.querySelector("#upload-program-file-btn");
  const uploadStatus = document.querySelector("#upload-planner-status");

  let activities = [];
  let pasteDrafts = [];
  let dragActivityId = null;
  let unsubscribe = null;
  let plannerReady = false;
  const maxUploadBytes = 10 * 1024 * 1024;
  const acceptedExtensions = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png", "xls", "xlsx", "csv", "txt"]);

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error-text", isError);
    status.classList.toggle("muted", !isError);
  }

  function setElementStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error-text", isError);
    element.classList.toggle("muted", !isError);
  }

  function clean(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function safeFileName(value) {
    return String(value || "program-file")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140) || "program-file";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDate(dateValue) {
    if (!dateValue?.toDate) return "Just now";
    return dateValue.toDate().toLocaleString();
  }

  function plannerActivitiesRef() {
    return collection(db, "events", eventId, "plannerActivities");
  }

  function uploadsRef() {
    return collection(db, "events", eventId, "uploads");
  }

  function sortActivities(items) {
    return [...items].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }

  function nextOrder() {
    if (!activities.length) return 1;
    return Math.max(...activities.map((item) => Number(item.order || 0))) + 1;
  }

  function switchPlannerMethod(method) {
    methodButtons.forEach((button) => {
      const active = button.dataset.plannerMethod === method;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    methodPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.methodPanel !== method);
    });
  }

  function stripActivityPrefix(line) {
    return String(line || "")
      .trim()
      .replace(/^[\s>*•●○▪▫-]+/, "")
      .replace(/^\(?\d{1,3}[\).:-]\s*/, "")
      .replace(/^[a-zA-Z][\).:-]\s*/, "")
      .replace(/^[-–—]\s*/, "")
      .trim();
  }

  function parsePasteLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(stripActivityPrefix)
      .filter(Boolean)
      .map((line, index) => ({
        id: `draft-${Date.now()}-${index}`,
        activityName: clean(line, 140),
        duration: "10 min",
        notes: "",
      }));
  }

  function renderPasteDrafts() {
    if (!pasteDraftList || !submitPasteBtn) return;
    submitPasteBtn.classList.toggle("hidden", !pasteDrafts.length);

    if (!pasteDrafts.length) {
      pasteDraftList.innerHTML = "";
      return;
    }

    pasteDraftList.innerHTML = pasteDrafts
      .map((draft, index) => `
        <article class="entity-card paste-draft-card" data-draft-id="${escapeHtml(draft.id)}">
          <div class="entity-meta">
            <span class="program-order-badge" aria-label="Draft activity order ${index + 1}">${index + 1}</span>
            <span class="status-chip accepted">10 min default</span>
          </div>
          <div class="form-grid">
            <label>
              <span>Activity name</span>
              <input data-draft-field="activityName" maxlength="140" value="${escapeHtml(draft.activityName)}" />
            </label>
            <label>
              <span>Duration</span>
              <input data-draft-field="duration" maxlength="40" value="${escapeHtml(draft.duration)}" />
            </label>
            <label class="full-span">
              <span>Notes</span>
              <textarea data-draft-field="notes" maxlength="700">${escapeHtml(draft.notes)}</textarea>
            </label>
          </div>
          <div class="card-primary-actions">
            <button class="danger" type="button" data-action="remove-draft" data-id="${escapeHtml(draft.id)}">Remove</button>
          </div>
        </article>
      `)
      .join("");
  }

  function syncPasteDraftField(target) {
    const card = target.closest("[data-draft-id]");
    if (!card) return;
    const draft = pasteDrafts.find((item) => item.id === card.dataset.draftId);
    if (!draft) return;
    draft[target.dataset.draftField] = target.value;
  }

  function renderActivities() {
    const sorted = sortActivities(activities);
    if (activityCountBadge) {
      activityCountBadge.textContent = sorted.length ? String(sorted.length) : "";
    }
    if (!sorted.length) {
      list.innerHTML = '<div class="empty-state">No activities added yet. Use the form above to build your program.</div>';
      return;
    }

    list.innerHTML = sorted
      .map((item, index) => `
        <article class="entity-card public-planner-item" draggable="true" data-planner-id="${escapeHtml(item.id)}">
          <div class="card-main-row">
            <div class="entity-main-content">
              <div class="entity-meta">
                <span class="program-order-badge" aria-label="Activity order ${index + 1}">${index + 1}</span>
                <span class="status-chip accepted">${escapeHtml(item.duration || "No duration")}</span>
                <span class="small muted">${escapeHtml(formatDate(item.submittedAt || item.createdAt))}</span>
              </div>
              <div class="entity-title-block">
                <h4>${escapeHtml(item.activityName || "Untitled activity")}</h4>
                <p class="small muted">${escapeHtml(item.notes || "No notes")}</p>
              </div>
            </div>
            <div class="card-primary-actions">
              <button type="button" data-action="move-up" data-id="${escapeHtml(item.id)}">Up</button>
              <button type="button" data-action="move-down" data-id="${escapeHtml(item.id)}">Down</button>
            </div>
          </div>
          <div class="compact-grid planner-detail-grid">
            <div class="list-card">
              <strong>Song request</strong>
              <p>${escapeHtml(item.songRequest || "None")}</p>
            </div>
            <div class="list-card">
              <strong>Special announcement</strong>
              <p>${escapeHtml(item.specialAnnouncement || "None")}</p>
            </div>
          </div>
        </article>
      `)
      .join("");
  }

  async function loadPublicEvent() {
    if (!eventId || !token) {
      throw new Error("This planner link is missing event details.");
    }

    const snapshot = await getDoc(doc(db, "events", eventId));
    if (!snapshot.exists()) {
      throw new Error("This planner link is not active.");
    }

    const eventData = snapshot.data();
    if (!eventData.plannerLinkEnabled || eventData.plannerToken !== token) {
      throw new Error("This planner link is not active.");
    }

    eventTitle.textContent = eventData.title || "Event planner";
  }

  function subscribeToActivities() {
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(
      query(plannerActivitiesRef(), orderBy("order", "asc")),
      (snapshot) => {
        activities = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        renderActivities();
      },
      (error) => {
        console.error("subscribeToActivities failed", error);
        setStatus("Could not load activities. Please refresh.", true);
      }
    );
  }

  async function submitActivity(event) {
    event.preventDefault();
    if (!plannerReady) {
      setStatus("This planner link is still loading. Please try again in a moment.", true);
      return;
    }
    const formData = new FormData(form);
    const payload = {
      activityName: clean(formData.get("activityName"), 140),
      duration: clean(formData.get("duration"), 40),
      notes: clean(formData.get("notes"), 700),
      songRequest: clean(formData.get("songRequest"), 220),
      specialAnnouncement: clean(formData.get("specialAnnouncement"), 260),
      order: nextOrder(),
      sourceMethod: "typed",
      clientConfirmed: true,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!payload.activityName) {
      setStatus("Tell us what you would like to happen.", true);
      return;
    }

    submitBtn.disabled = true;
    setStatus("Adding activity...");

    try {
      await addDoc(plannerActivitiesRef(), payload);
      form.reset();
      setStatus("Activity added.");
    } catch (error) {
      console.error("submitActivity failed", error);
      setStatus("Could not add activity. Please try again.", true);
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function submitPasteActivities() {
    if (!plannerReady) {
      setElementStatus(pasteStatus, "This planner link is still loading. Please try again in a moment.", true);
      return;
    }

    const validDrafts = pasteDrafts
      .map((draft) => ({
        activityName: clean(draft.activityName, 140),
        duration: clean(draft.duration, 40) || "10 min",
        notes: clean(draft.notes, 700),
      }))
      .filter((draft) => draft.activityName);

    if (!validDrafts.length) {
      setElementStatus(pasteStatus, "Add at least one activity name before submitting.", true);
      return;
    }

    submitPasteBtn.disabled = true;
    setElementStatus(pasteStatus, "Submitting activities...");

    try {
      const batch = writeBatch(db);
      const startOrder = nextOrder();
      validDrafts.forEach((draft, index) => {
        batch.set(doc(plannerActivitiesRef()), {
          ...draft,
          songRequest: "",
          specialAnnouncement: "",
          order: startOrder + index,
          sourceMethod: "paste",
          clientConfirmed: true,
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      pasteDrafts = [];
      pasteText.value = "";
      renderPasteDrafts();
      setElementStatus(pasteStatus, "Activities submitted.");
    } catch (error) {
      console.error("submitPasteActivities failed", error);
      setElementStatus(pasteStatus, "Could not submit activities. Please try again.", true);
    } finally {
      submitPasteBtn.disabled = false;
    }
  }

  function fileSourceType(file) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "file";
    if (extension === "jpeg") return "jpg";
    return extension;
  }

  function validateUploadFile(file) {
    if (!file) return "Choose a program file to upload.";
    const extension = fileSourceType(file);
    if (!acceptedExtensions.has(extension)) return "Please upload PDF, DOC/DOCX, JPG/PNG, XLS/XLSX, CSV, or TXT.";
    if (file.size > maxUploadBytes) return "File is too large. Please upload a file under 10 MB.";
    return "";
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (!plannerReady) {
      setElementStatus(uploadStatus, "This planner link is still loading. Please try again in a moment.", true);
      return;
    }

    const file = uploadForm.elements.programFile.files?.[0];
    const validationError = validateUploadFile(file);
    if (validationError) {
      setElementStatus(uploadStatus, validationError, true);
      return;
    }

    uploadBtn.disabled = true;
    setElementStatus(uploadStatus, "Uploading file...");

    try {
      const uploadDocRef = doc(uploadsRef());
      const uploadId = uploadDocRef.id;
      const fileName = safeFileName(file.name);
      const storagePath = `uploads/events/${eventId}/${uploadId}/original-${fileName}`;
      await uploadBytes(storageRef(storage, storagePath), file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          uploadedBy: "client",
          eventId,
          uploadId,
        },
      });
      await setDoc(uploadDocRef, {
        uploadedBy: "client",
        uploadMethod: "file",
        sourceType: fileSourceType(file),
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        status: "uploaded",
        clientNotes: clean(new FormData(uploadForm).get("clientNotes"), 700),
        uploadedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      uploadForm.reset();
      setElementStatus(uploadStatus, "Program file uploaded successfully. Your event organizer will review it.");
    } catch (error) {
      console.error("submitUpload failed", error);
      setElementStatus(uploadStatus, "Could not upload file. Please try again.", true);
    } finally {
      uploadBtn.disabled = false;
    }
  }

  async function reorderActivities(reorderedIds) {
    const batch = writeBatch(db);
    reorderedIds.forEach((id, index) => {
      batch.update(doc(plannerActivitiesRef(), id), {
        order: index + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    setStatus("Order updated.");
  }

  async function moveActivity(itemId, direction) {
    const sorted = sortActivities(activities);
    const index = sorted.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const [moved] = sorted.splice(index, 1);
    sorted.splice(targetIndex, 0, moved);
    await reorderActivities(sorted.map((item) => item.id));
  }

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    try {
      if (button.dataset.action === "move-up") await moveActivity(button.dataset.id, "up");
      if (button.dataset.action === "move-down") await moveActivity(button.dataset.id, "down");
    } catch (error) {
      console.error("moveActivity failed", error);
      setStatus("Could not update order. Please try again.", true);
    }
  });

  quickAddButtons.forEach((button) => {
    button.addEventListener("click", () => {
      form.elements.activityName.value = button.dataset.quickActivity || "";
      form.elements.duration.value = button.dataset.duration || "";
      form.elements.activityName.focus();
      setStatus("Activity details filled in. Add any instructions, then submit.");
    });
  });

  methodButtons.forEach((button) => {
    button.addEventListener("click", () => switchPlannerMethod(button.dataset.plannerMethod));
  });

  createFromTextBtn.addEventListener("click", () => {
    pasteDrafts = parsePasteLines(pasteText.value);
    renderPasteDrafts();
    setElementStatus(
      pasteStatus,
      pasteDrafts.length
        ? "Review and edit these activities before submitting."
        : "Paste one activity per line, then create activities.",
      !pasteDrafts.length
    );
  });

  pasteDraftList.addEventListener("input", (event) => {
    if (event.target.matches("[data-draft-field]")) {
      syncPasteDraftField(event.target);
    }
  });

  pasteDraftList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='remove-draft']");
    if (!button) return;
    pasteDrafts = pasteDrafts.filter((draft) => draft.id !== button.dataset.id);
    renderPasteDrafts();
    setElementStatus(pasteStatus, pasteDrafts.length ? "Review and edit these activities before submitting." : "");
  });

  submitPasteBtn.addEventListener("click", submitPasteActivities);
  uploadForm.addEventListener("submit", submitUpload);

  list.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".public-planner-item");
    if (!card) return;
    dragActivityId = card.dataset.plannerId;
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  list.addEventListener("dragend", (event) => {
    const card = event.target.closest(".public-planner-item");
    if (card) card.classList.remove("dragging");
    dragActivityId = null;
    list.querySelectorAll(".public-planner-item").forEach((item) => item.classList.remove("drop-target"));
  });

  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    const card = event.target.closest(".public-planner-item");
    if (!card || !dragActivityId) return;
    list.querySelectorAll(".public-planner-item").forEach((item) => item.classList.remove("drop-target"));
    if (card.dataset.plannerId !== dragActivityId) {
      card.classList.add("drop-target");
    }
  });

  list.addEventListener("drop", async (event) => {
    event.preventDefault();
    const targetCard = event.target.closest(".public-planner-item");
    if (!targetCard || !dragActivityId || targetCard.dataset.plannerId === dragActivityId) return;

    const sorted = sortActivities(activities);
    const sourceIndex = sorted.findIndex((item) => item.id === dragActivityId);
    const targetIndex = sorted.findIndex((item) => item.id === targetCard.dataset.plannerId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = sorted.splice(sourceIndex, 1);
    sorted.splice(targetIndex, 0, moved);
    try {
      await reorderActivities(sorted.map((item) => item.id));
    } catch (error) {
      console.error("drop reorder failed", error);
      setStatus("Could not update order. Please try again.", true);
    }
  });

  try {
    submitBtn.disabled = true;
    uploadBtn.disabled = true;
    await loadPublicEvent();
    plannerReady = true;
    subscribeToActivities();
    submitBtn.disabled = false;
    uploadBtn.disabled = false;
    setStatus("");
    form.addEventListener("submit", submitActivity);
  } catch (error) {
    console.error("loadPublicEvent failed", error);
    form.classList.add("hidden");
    uploadForm.classList.add("hidden");
    document.querySelector("#paste-planner-panel")?.classList.add("hidden");
    list.innerHTML = "";
    setStatus(error.message || "This planner link is not active.", true);
  }
});
