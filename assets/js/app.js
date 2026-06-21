/*
  Collaborative AI Artwork Prompt
  Creator: Dimitrios Kanatas
*/

const appTranslations = window.AppTranslations || {};
const activityConfig = window.ActivityConfig || { slots: [] };
const promptTemplates = window.PromptTemplates || {};
const storageKey = "techEduDsaiCollaborativePrompt";
const maxAnswerLength = 80;

const elements = {
  promptOutput: document.getElementById("promptOutput"),
  teamNumber: document.getElementById("teamNumber"),
  teamTitle: document.getElementById("teamTitle"),
  operatorTeamTitle: document.getElementById("operatorTeamTitle"),
  operatorMission: document.getElementById("operatorMission"),
  missionLabel: document.getElementById("missionLabel"),
  statusLabel: document.getElementById("statusLabel"),
  progressLabel: document.getElementById("progressLabel"),
  progressFill: document.getElementById("progressFill"),
  completionBanner: document.getElementById("completionBanner"),
  wordForm: document.getElementById("wordForm"),
  teamWord: document.getElementById("teamWord"),
  lockButton: document.getElementById("lockButton"),
  startButton: document.getElementById("startButton"),
  pauseButton: document.getElementById("pauseButton"),
  previousButton: document.getElementById("previousButton"),
  nextButton: document.getElementById("nextButton"),
  speedRange: document.getElementById("speedRange"),
  copyButton: document.getElementById("copyButton"),
  exportButton: document.getElementById("exportButton"),
  resetButton: document.getElementById("resetButton"),
  presentationButton: document.getElementById("presentationButton"),
  projectionToggle: document.getElementById("projectionToggle")
};

const isPresentationView = new URLSearchParams(window.location.search).get("view") === "presentation";

const state = {
  language: "en",
  answers: {},
  drafts: {},
  currentSlot: 0,
  started: false,
  paused: false,
  typingIndex: 0,
  timer: null
};

function labels(language = state.language) {
  return appTranslations[language]?.ui || appTranslations.en.ui;
}

function templateFor(language = state.language) {
  return promptTemplates[language] || promptTemplates.en || "";
}

function parseTemplate(language = state.language) {
  const template = templateFor(language);
  const placeholderPattern = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
  const segments = [];
  const slotIds = [];
  let lastIndex = 0;
  let match;

  while ((match = placeholderPattern.exec(template)) !== null) {
    segments.push(template.slice(lastIndex, match.index));
    slotIds.push(match[1]);
    lastIndex = match.index + match[0].length;
  }

  segments.push(template.slice(lastIndex));
  return { segments, slotIds };
}

function configuredSlot(id) {
  return activityConfig.slots.find(slot => slot.id === id) || { id };
}

function slotText(id, language = state.language) {
  const translated = appTranslations[language]?.slots?.[id] || appTranslations.en?.slots?.[id];
  if (translated) return translated;

  const title = id
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    title,
    mission: labels(language).configurationError
  };
}

function currentModel(language = state.language) {
  return parseTemplate(language);
}

function currentSlotIds() {
  return currentModel().slotIds;
}

function slotCount() {
  return currentSlotIds().length;
}

function displaySlot(index, language = state.language) {
  const id = currentModel(language).slotIds[index];
  const config = configuredSlot(id);
  const text = slotText(id, language);

  return {
    id,
    label: config.label?.[language] || `${labels(language).teamLabel || "Team"} ${index + 1}`,
    title: text.title,
    mission: text.mission
  };
}

function ensureAnswerShape() {
  currentSlotIds().forEach(id => {
    if (typeof state.answers[id] !== "string") state.answers[id] = "";
    if (typeof state.drafts[id] !== "string") state.drafts[id] = "";
  });
}

function normalizeAnswer(value) {
  return typeof value === "string" ? value.slice(0, maxAnswerLength) : "";
}

function normalizeSavedValue(value) {
  const slotIds = currentSlotIds();
  if (Array.isArray(value)) {
    return slotIds.reduce((result, id, index) => {
      result[id] = normalizeAnswer(value[index]);
      return result;
    }, {});
  }

  if (value && typeof value === "object") {
    return slotIds.reduce((result, id) => {
      result[id] = normalizeAnswer(value[id]);
      return result;
    }, {});
  }

  return {};
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      answers: state.answers,
      drafts: state.drafts,
      currentSlot: state.currentSlot,
      started: state.started,
      language: state.language
    }));
  } catch {
    // The activity remains usable when storage is unavailable or full.
  }
}

function clearSavedState() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Storage can be blocked in strict privacy or local-file modes.
  }
}

function loadState() {
  let saved = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    ensureAnswerShape();
    return;
  }
  if (!saved) {
    ensureAnswerShape();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.language = parsed.language === "el" ? "el" : "en";
    state.answers = normalizeSavedValue(parsed.answers);
    state.drafts = normalizeSavedValue(parsed.drafts);
    state.currentSlot = Number.isInteger(parsed.currentSlot)
      ? Math.min(parsed.currentSlot, slotCount())
      : Math.min(parsed.currentTeam || findFirstOpenSlot(), slotCount());
    state.started = Boolean(parsed.started);
    ensureAnswerShape();
  } catch {
    clearSavedState();
    ensureAnswerShape();
  }
}

function findFirstOpenSlot() {
  const index = currentSlotIds().findIndex(id => !state.answers[id]?.trim());
  return index === -1 ? slotCount() : index;
}

function getCompletedCount() {
  return currentSlotIds().filter(id => state.answers[id]?.trim()).length;
}

function getDelay() {
  const value = Number(elements.speedRange.value);
  return Math.max(12, 102 - value);
}

function createTextSpan(className, text = "") {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function buildPrefixFragment(slotIndex) {
  const model = currentModel();
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < slotIndex; index += 1) {
    const id = model.slotIds[index];
    fragment.append(document.createTextNode(model.segments[index]));
    if (state.answers[id]) {
      fragment.append(createTextSpan("prompt-word", state.answers[id]));
    }
  }

  return fragment;
}

function buildPromptForLanguage(language) {
  const model = currentModel(language);
  let text = "";

  model.slotIds.forEach((id, index) => {
    text += model.segments[index] + (state.answers[id] || `{{${id}}}`);
  });

  return text + model.segments[model.segments.length - 1];
}

function buildFullPrompt() {
  return buildPromptForLanguage(state.language);
}

function renderPrompt() {
  const model = currentModel();
  const count = slotCount();

  if (!state.started) {
    elements.promptOutput.replaceChildren(createTextSpan("cursor"));
    return;
  }

  if (state.currentSlot >= count) {
    const nodes = [
      buildPrefixFragment(count),
      document.createTextNode(model.segments[count].slice(0, state.typingIndex))
    ];
    if (state.typingIndex < model.segments[count].length) {
      nodes.push(createTextSpan("cursor"));
    }
    elements.promptOutput.replaceChildren(...nodes);
    return;
  }

  const currentSegment = model.segments[state.currentSlot];
  const typedSegment = currentSegment.slice(0, state.typingIndex);
  const segmentComplete = state.typingIndex >= currentSegment.length;
  const slot = displaySlot(state.currentSlot);
  const placeholder = segmentComplete
    ? createTextSpan("prompt-placeholder", `${labels().placeholder} ${slot.label}`)
    : createTextSpan("cursor");

  elements.promptOutput.replaceChildren(
    buildPrefixFragment(state.currentSlot),
    document.createTextNode(typedSegment),
    placeholder
  );
}

function renderPresentationPrompt(text, index) {
  const nodes = [document.createTextNode(text.slice(0, index))];
  if (index < text.length) {
    nodes.push(createTextSpan("cursor"));
  }
  elements.promptOutput.replaceChildren(...nodes);
  elements.promptOutput.scrollTop = elements.promptOutput.scrollHeight;
}

function startPresentation() {
  document.body.classList.add("presentation-view");
  state.started = true;
  state.currentSlot = slotCount();
  state.typingIndex = 0;
  updateText();

  const text = buildFullPrompt();
  let index = 0;
  const presentationDelay = Math.max(10, Math.round(getDelay() * 0.65));

  function step() {
    index += 1;
    renderPresentationPrompt(text, index);
    if (index < text.length) {
      window.setTimeout(step, presentationDelay);
    }
  }

  renderPresentationPrompt(text, index);
  window.setTimeout(step, 450);
}

function stopTyping() {
  if (state.timer) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }
}

function typeStep() {
  stopTyping();
  if (!state.started || state.paused) return;

  const model = currentModel();
  const count = slotCount();
  const segment = model.segments[Math.min(state.currentSlot, count)];

  if (state.typingIndex < segment.length) {
    state.typingIndex += 1;
    renderPrompt();
    updateStatus();
    state.timer = window.setTimeout(typeStep, getDelay());
    return;
  }

  renderPrompt();
  updateStatus();
  updateButtons();
}

function startTypingForSlot(slotIndex) {
  stopTyping();
  state.currentSlot = Math.max(0, Math.min(slotIndex, slotCount()));
  state.typingIndex = 0;
  state.started = true;
  state.paused = false;
  ensureAnswerShape();
  saveState();
  renderPrompt();
  updateUi();
  typeStep();
}

function updateText() {
  document.title = labels().title;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    element.textContent = labels()[key];
  });
  elements.missionLabel.textContent = labels().mission;
  elements.teamWord.placeholder = labels().inputPlaceholder;
  document.querySelectorAll("[data-language]").forEach(button => {
    button.classList.toggle("active", button.dataset.language === state.language);
  });
}

function updateStatus() {
  const model = currentModel();
  const count = slotCount();
  let status = labels().waiting;

  if (state.started && state.currentSlot >= count && state.typingIndex >= model.segments[count].length) {
    status = labels().completeStatus;
  } else if (state.paused) {
    status = labels().paused;
  } else if (state.started) {
    const segment = model.segments[Math.min(state.currentSlot, count)];
    status = state.typingIndex >= segment.length ? labels().awaiting : labels().typing;
  }

  elements.statusLabel.textContent = status;
}

function updateTeamDetails() {
  const count = slotCount();
  if (count === 0) {
    elements.teamNumber.textContent = "";
    elements.teamTitle.textContent = labels().configurationError;
    elements.operatorTeamTitle.textContent = labels().configurationError;
    elements.operatorMission.textContent = labels().configurationError;
    elements.teamWord.value = "";
    return;
  }

  const slotIndex = Math.min(state.currentSlot, count - 1);
  const slot = displaySlot(slotIndex);

  elements.teamNumber.textContent = state.currentSlot >= count ? "Final" : slot.label;
  elements.teamTitle.textContent = state.currentSlot >= count ? labels().ready : slot.title;
  elements.operatorTeamTitle.textContent = state.currentSlot >= count
    ? labels().ready
    : `${slot.label} / ${slot.title}`;
  elements.operatorMission.textContent = state.currentSlot >= count
    ? labels().complete
    : slot.mission;
  elements.teamWord.value = state.currentSlot < count
    ? state.drafts[slot.id] || state.answers[slot.id] || ""
    : "";
}

function updateProgress() {
  const completed = getCompletedCount();
  const count = slotCount();
  elements.progressLabel.textContent = `${completed} / ${count}`;
  elements.progressFill.style.width = count === 0 ? "0%" : `${(completed / count) * 100}%`;
  elements.completionBanner.hidden = completed !== count || count === 0;
}

function updateButtons() {
  const model = currentModel();
  const count = slotCount();
  const segment = model.segments[Math.min(state.currentSlot, count)] || "";
  const slot = state.currentSlot < count ? displaySlot(state.currentSlot) : null;
  const canLock = state.started && slot && state.typingIndex >= segment.length;
  const canMoveNext = Boolean(slot && state.answers[slot.id]);

  elements.lockButton.disabled = !canLock;
  elements.teamWord.disabled = state.currentSlot >= count;
  elements.previousButton.disabled = state.currentSlot <= 0;
  elements.nextButton.disabled = !canMoveNext;
  elements.presentationButton.disabled = getCompletedCount() !== count || count === 0;
  elements.pauseButton.textContent = state.paused ? labels().resume : labels().pause;
}

function updateUi() {
  updateText();
  updateTeamDetails();
  updateProgress();
  updateStatus();
  updateButtons();
}

function lockCurrentWord() {
  const count = slotCount();
  if (state.currentSlot >= count) return;

  const segment = currentModel().segments[state.currentSlot];
  if (state.typingIndex < segment.length) return;

  const slot = displaySlot(state.currentSlot);
  const word = normalizeAnswer(elements.teamWord.value.trim());
  if (!word) {
    elements.teamWord.focus();
    return;
  }

  state.answers[slot.id] = word;
  state.drafts[slot.id] = word;
  saveState();

  if (state.currentSlot + 1 >= count) {
    startTypingForSlot(count);
  } else {
    startTypingForSlot(state.currentSlot + 1);
  }
}

async function copyPrompt() {
  const text = buildFullPrompt();
  try {
    await navigator.clipboard.writeText(text);
    flashStatus(labels().copied);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    flashStatus(labels().copied);
  }
}

function exportPrompt() {
  const data = {
    createdAt: new Date().toISOString(),
    language: state.language,
    slots: currentSlotIds().map((id, index) => ({
      id,
      team: index + 1,
      label: displaySlot(index, "en").label,
      title: slotText(id, "en").title,
      answer: state.answers[id] || ""
    })),
    prompts: {
      en: buildPromptForLanguage("en"),
      el: buildPromptForLanguage("el")
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "collaborative-ai-artwork-prompt.json";
  link.click();
  URL.revokeObjectURL(url);
  flashStatus(labels().exported);
}

function flashStatus(message) {
  const previous = elements.statusLabel.textContent;
  elements.statusLabel.textContent = message;
  window.setTimeout(() => {
    elements.statusLabel.textContent = previous;
    updateStatus();
  }, 1200);
}

function resetAll() {
  stopTyping();
  state.answers = {};
  state.drafts = {};
  ensureAnswerShape();
  state.currentSlot = 0;
  state.started = false;
  state.paused = false;
  state.typingIndex = 0;
  clearSavedState();
  renderPrompt();
  updateUi();
}

document.querySelectorAll("[data-language]").forEach(button => {
  button.addEventListener("click", () => {
    const oldSegment = currentModel().segments[Math.min(state.currentSlot, slotCount())] || "";
    state.language = button.dataset.language;
    ensureAnswerShape();

    const newSegment = currentModel().segments[Math.min(state.currentSlot, slotCount())] || "";
    if (state.started && state.typingIndex >= oldSegment.length) {
      state.typingIndex = newSegment.length;
    } else {
      state.typingIndex = Math.min(state.typingIndex, newSegment.length);
    }

    saveState();
    renderPrompt();
    updateUi();
  });
});

elements.wordForm.addEventListener("submit", event => {
  event.preventDefault();
  lockCurrentWord();
});

elements.startButton.addEventListener("click", () => {
  startTypingForSlot(findFirstOpenSlot());
});

elements.pauseButton.addEventListener("click", () => {
  if (!state.started) return;
  state.paused = !state.paused;
  updateUi();
  if (!state.paused) typeStep();
});

elements.previousButton.addEventListener("click", () => {
  startTypingForSlot(Math.max(0, state.currentSlot - 1));
});

elements.nextButton.addEventListener("click", () => {
  startTypingForSlot(Math.min(slotCount(), state.currentSlot + 1));
});

elements.copyButton.addEventListener("click", copyPrompt);
elements.exportButton.addEventListener("click", exportPrompt);
elements.resetButton.addEventListener("click", resetAll);
elements.presentationButton.addEventListener("click", () => {
  if (getCompletedCount() !== slotCount()) return;
  const presentationUrl = new URL(window.location.href);
  presentationUrl.searchParams.set("view", "presentation");
  window.open(presentationUrl.href, "_blank", "noopener,noreferrer");
});

elements.projectionToggle.addEventListener("click", () => {
  document.body.classList.toggle("projection");
});

elements.teamWord.addEventListener("input", () => {
  if (state.currentSlot < slotCount()) {
    const slot = displaySlot(state.currentSlot);
    state.drafts[slot.id] = normalizeAnswer(elements.teamWord.value);
    saveState();
  }
});

loadState();

if (isPresentationView) {
  startPresentation();
} else {
  renderPrompt();
  updateUi();
}

if (!isPresentationView && state.started) {
  state.typingIndex = currentModel().segments[Math.min(state.currentSlot, slotCount())].length;
  renderPrompt();
  updateUi();
}
