import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event") || "";
  const token = params.get("token") || "";

  const form = document.querySelector("#song-request-form");
  const eventTitle = document.querySelector("#request-event-title");
  const status = document.querySelector("#request-status");
  const submitBtn = document.querySelector("#submit-request-btn");
  const successPanel = document.querySelector("#request-success");

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error-text", isError);
    status.classList.toggle("muted", !isError);
  }

  function clean(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function isAllowedMusicLink(value) {
    if (!value) return true;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      return [
        "youtube.com",
        "youtu.be",
        "spotify.com",
        "open.spotify.com",
        "music.apple.com",
      ].some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  async function loadPublicEvent() {
    if (!eventId || !token) {
      throw new Error("This request link is missing event details.");
    }

    const snapshot = await getDoc(doc(db, "events", eventId));
    if (!snapshot.exists()) {
      throw new Error("This request link is not active.");
    }

    const eventData = snapshot.data();
    if (!eventData.requestLinkEnabled || eventData.requestToken !== token) {
      throw new Error("This request link is not active.");
    }

    eventTitle.textContent = eventData.title || "Event request list";
  }

  async function submitRequest(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      songName: clean(formData.get("songName"), 140),
      artist: clean(formData.get("artist"), 140),
      link: clean(formData.get("link"), 500),
      guestName: clean(formData.get("guestName"), 120),
      message: clean(formData.get("message"), 500),
      status: "New",
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    if (!payload.songName) {
      setStatus("Song name is required.", true);
      return;
    }

    if (!isAllowedMusicLink(payload.link)) {
      setStatus("Use a YouTube, Spotify, or Apple Music link.", true);
      return;
    }

    submitBtn.disabled = true;
    setStatus("Sending request...");

    try {
      await addDoc(collection(db, "events", eventId, "songRequests"), payload);
      form.reset();
      form.classList.add("hidden");
      successPanel.classList.remove("hidden");
    } catch (error) {
      console.error("submitRequest failed", error);
      setStatus("Could not send request. Please try again.", true);
      submitBtn.disabled = false;
    }
  }

  try {
    submitBtn.disabled = true;
    await loadPublicEvent();
    submitBtn.disabled = false;
    setStatus("");
    form.addEventListener("submit", submitRequest);
  } catch (error) {
    console.error("loadPublicEvent failed", error);
    form.classList.add("hidden");
    setStatus(error.message || "This request link is not active.", true);
  }
});
