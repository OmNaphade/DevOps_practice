const DATA_FILES = {
  theory: "data-theory.json",
  coding: "data-coding.json"
};

const SECTION_COLORS = {
  s1: "#4f8eff",
  s2: "#00e5c0",
  s3: "#ffd166",
  s4: "#ff6b6b",
  s5: "#c77dff",
  s6: "#ffb347",
  s7: "#88d988",
  s8: "#ff78cc",
  s9: "#5bc8f5",
  s10: "#ffa03c"
};

const $ = id => document.getElementById(id);

let activeTab = "theory";
let theoryData = [];
let codingData = [];
let latestQuestion = null;

const LOCAL_THEORY_KEY = "interviewHubTheoryAdditions";
const LOCAL_CONTENT_KEY = "interviewHubContentAdditionsV2";
const DEFAULT_THEORY_TOPIC = "Java";
const DEFAULT_CODING_SUBTOPIC = "General";

function escHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(value) {
  return escHtml(value).replace(/'/g, "&#39;");
}

function slugTag(tag) {
  return String(tag || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace("frequent", "freq")
    .replace("javascript", "js");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function searchable(parts) {
  return parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ").slice(0, 1000);
}

function titleCaseFromSlug(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCodingSubtopic(card) {
  const tags = safeArray(card && card.tags).filter(tag => {
    const raw = String(tag || "").toLowerCase();
    return !["easy", "medium", "hard", "java", "javascript", "sql"].includes(raw);
  });
  return tags[0] || DEFAULT_CODING_SUBTOPIC;
}

function statusHtml(message, detail = "") {
  return `
    <div class="empty-state">
      <p>${escHtml(message)}</p>
      ${detail ? `<small>${escHtml(detail)}</small>` : ""}
    </div>`;
}

function readLocalTheoryAdds() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_THEORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeLocalTheoryAdds(items) {
  localStorage.setItem(LOCAL_THEORY_KEY, JSON.stringify(items));
}

function emptyContentAdds() {
  return {
    theoryTopics: [],
    theorySections: [],
    theoryQuestions: [],
    codingSections: [],
    codingSubtopics: [],
    codingCards: []
  };
}

function readContentAdds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CONTENT_KEY) || "{}");
    return { ...emptyContentAdds(), ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return emptyContentAdds();
  }
}

function writeContentAdds(items) {
  localStorage.setItem(LOCAL_CONTENT_KEY, JSON.stringify({ ...emptyContentAdds(), ...items }));
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || []));
}

function normalizeTheoryData(data) {
  return cloneData(data).map(sec => ({
    ...sec,
    mainTopic: sec.mainTopic || DEFAULT_THEORY_TOPIC,
    questions: safeArray(sec.questions)
  }));
}

function normalizeCodingData(data) {
  return cloneData(data).map(sec => ({
    ...sec,
    cards: safeArray(sec.cards).map(card => ({
      ...card,
      subtopic: card.subtopic || inferCodingSubtopic(card)
    }))
  }));
}

function mergedTheoryData() {
  const merged = normalizeTheoryData(theoryData);
  const additionsV2 = readContentAdds();

  additionsV2.theorySections.forEach(section => {
    if (!merged.some(sec => sec.id === section.id)) {
      merged.push({ ...section, questions: safeArray(section.questions) });
    }
  });

  additionsV2.theoryQuestions.forEach(item => {
    const section = merged.find(sec => sec.id === item.sectionId);
    if (section) {
      section.questions = safeArray(section.questions);
      if (!section.questions.some(q => q.id === item.question.id)) {
        section.questions.push(item.question);
      }
    }
  });

  readLocalTheoryAdds().forEach(item => {
    const section = merged.find(sec => sec.id === item.sectionId);
    if (section) {
      section.questions = safeArray(section.questions);
      if (!section.questions.some(q => q.id === item.question.id)) {
        section.questions.push(item.question);
      }
    }
  });
  return merged;
}

function mergedCodingData() {
  const merged = normalizeCodingData(codingData);
  const additions = readContentAdds();

  additions.codingSections.forEach(section => {
    if (!merged.some(sec => sec.id === section.id)) {
      merged.push({ ...section, cards: safeArray(section.cards) });
    }
  });

  additions.codingCards.forEach(item => {
    const section = merged.find(sec => sec.id === item.sectionId);
    if (section) {
      section.cards = safeArray(section.cards);
      if (!section.cards.some(card => card.num === item.card.num && card.title === item.card.title)) {
        section.cards.push(item.card);
      }
    }
  });

  return merged;
}

function allTheoryQuestions(data = mergedTheoryData()) {
  return data.flatMap(sec => safeArray(sec.questions));
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function buildAnswerHtml(q) {
  const parts = [];
  const tableHeaders = safeArray(q.tableHeaders);
  const tableRows = safeArray(q.tableRows);

  if (q.explanation) {
    parts.push(`<div class="answer-text"><p>${q.explanation}</p></div>`);
  }

  if (q.code) {
    const lang = q.language || "java";
    parts.push(`<pre><code class="language-${attr(lang)}">${escHtml(q.code)}</code></pre>`);
  }

  if (tableHeaders.length) {
    const ths = tableHeaders.map(h => `<th>${escHtml(h)}</th>`).join("");
    const trs = tableRows.map(row =>
      `<tr>${safeArray(row).map(c => `<td>${c}</td>`).join("")}</tr>`
    ).join("");
    parts.push(`<table><tr>${ths}</tr>${trs}</table>`);
  }

  if (q.note) parts.push(`<div class="note">Note: ${q.note}</div>`);
  if (q.tip) parts.push(`<div class="tip">${q.tip}</div>`);
  if (q.warn) parts.push(`<div class="warn">${q.warn}</div>`);

  return parts.join("\n");
}

function tagClass(tag) {
  const raw = String(tag || "").toLowerCase();
  if (raw.includes("easy")) return "tag-easy";
  if (raw.includes("hard")) return "tag-hard";
  if (raw.includes("frequent") || raw.includes("star")) return "tag-freq";
  if (raw.includes("sql")) return "tag-sql";
  if (raw.includes("java") && !raw.includes("javascript")) return "tag-java";
  if (raw.includes("javascript")) return "tag-js";
  return `tag-${slugTag(tag) || "medium"}`;
}

function renderTheory(data) {
  Object.entries(SECTION_COLORS).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  });
  data.forEach((sec, index) => {
    const fallback = Object.values(SECTION_COLORS)[index % Object.values(SECTION_COLORS).length];
    document.documentElement.style.setProperty(`--color-${sec.id}`, SECTION_COLORS[sec.id] || fallback);
  });

  $("tocLinks").innerHTML = data.map(sec => `
    <a class="toc-item" href="#${attr(sec.id)}">
      <span class="toc-dot" style="background:var(--color-${attr(sec.id)})"></span>
      <span>
        <strong>${escHtml(sec.toc || sec.title)}</strong>
        <small>${escHtml(sec.mainTopic || DEFAULT_THEORY_TOPIC)}</small>
      </span>
    </a>
  `).join("");

  $("theoryMain").innerHTML = data.map(sec => {
    const questions = safeArray(sec.questions);
    const cards = questions.map(q => {
      const tags = safeArray(q.tags).map(t => `<span class="tag ${tagClass(t)}">${escHtml(t)}</span>`).join("");
      const search = searchable([sec.mainTopic, sec.title, q.question, q.explanation, q.code, q.note, q.tip, q.warn, safeArray(q.tags).join(" ")]);
      return `
        <div class="t-card" id="${attr(q.id)}" data-search="${attr(search)}">
          <button class="t-card-q" type="button" onclick="toggleCard(this)">
            <span class="t-qnum">${escHtml(String(q.id || "").toUpperCase())}</span>
            <span class="t-qtext">${escHtml(q.question)}</span>
            <span class="t-arrow">></span>
          </button>
          <div class="t-card-a">
            ${buildAnswerHtml(q)}
            ${tags ? `<div class="tags">${tags}</div>` : ""}
          </div>
        </div>`;
    }).join("");

    return `
      <section class="t-section" id="${attr(sec.id)}">
        <div class="t-section-header">
          <div class="t-icon ${attr(sec.color)}">${escHtml(sec.icon || "")}</div>
          <div>
            <div class="t-title">${escHtml(sec.title)}</div>
            <div class="topic-kicker">${escHtml(sec.mainTopic || DEFAULT_THEORY_TOPIC)}</div>
          </div>
          <div class="t-count ${attr(sec.dcolor)}">${questions.length} Q</div>
        </div>
        ${cards}
      </section>`;
  }).join("");

  $("statTheory").textContent = `${data.reduce((sum, sec) => sum + safeArray(sec.questions).length, 0)} Theory Q&A`;
  highlightCode();
}

function renderCoding(data) {
  $("codingNav").innerHTML = data.map(sec => `<a href="#c-${attr(sec.id)}">${escHtml(sec.label)}</a>`).join("");

  $("codingMain").innerHTML = data.map(sec => {
    const cards = safeArray(sec.cards).map(card => {
      const complexity = safeArray(card.complexity).map(item => `
        <div class="cx-item">
          <span class="cx-label">${escHtml(item.label)}</span>
          <span class="cx-val">${escHtml(item.val)}</span>
        </div>
      `).join("");
      const tags = safeArray(card.tags).map(t => `<span class="tag ${tagClass(t)}">${escHtml(t)}</span>`).join("");
      const subtopic = card.subtopic || inferCodingSubtopic(card);
      const search = searchable([sec.label, subtopic, card.title, card.desc, card.approach, card.sqlNote, card.code, safeArray(card.tags).join(" ")]);

      return `
        <article class="c-card" data-search="${attr(search)}">
          <div class="c-card-header">
            <div class="c-num ${attr(card.numColor || "teal")}">${escHtml(card.num)}</div>
            <div class="c-meta">
              <h3>${escHtml(card.title)}</h3>
              ${card.desc ? `<p>${escHtml(card.desc)}</p>` : ""}
              <div class="subtopic-pill">${escHtml(subtopic)}</div>
              ${tags ? `<div class="tag-row">${tags}</div>` : ""}
            </div>
          </div>
          ${complexity ? `<div class="complexity">${complexity}</div>` : ""}
          ${card.approach ? `<div class="approach"><span class="approach-icon">Tip</span>${card.approach}</div>` : ""}
          ${card.sqlNote ? `<div class="sql-note">${card.sqlNote}</div>` : ""}
          <pre><code class="language-${attr(card.language || "java")}">${escHtml(card.code || "")}</code></pre>
        </article>`;
    }).join("");

    return `
      <section class="c-section" id="c-${attr(sec.id)}">
        <div class="c-section-label">${escHtml(sec.label)}</div>
        ${cards}
      </section>`;
  }).join("");

  $("statCoding").textContent = `${data.reduce((sum, sec) => sum + safeArray(sec.cards).length, 0)} Coding Problems`;
  highlightCode();
}

function populateQuestionForm() {
  if (!$("qaMainTopic")) return;
  populateContentForm();
  updateFormMode();
}

function populateContentForm() {
  const kind = formValue("qaKind") || "theory";
  const mainSelect = $("qaMainTopic");
  const subtopicSelect = $("qaSubtopic");
  if (!mainSelect || !subtopicSelect) return;
  const previousMain = mainSelect.value;

  if (kind === "coding") {
    const sections = mergedCodingData();
    mainSelect.innerHTML = sections.map(sec =>
      `<option value="${attr(sec.id)}">${escHtml(sec.label)}</option>`
    ).join("");
    if (sections.some(sec => sec.id === previousMain)) mainSelect.value = previousMain;
    populateCodingSubtopics();
  } else {
    const additions = readContentAdds();
    const topics = uniqueBy([
      ...normalizeTheoryData(theoryData).map(sec => sec.mainTopic || DEFAULT_THEORY_TOPIC),
      ...safeArray(additions.theoryTopics)
    ].filter(Boolean), item => item.toLowerCase());

    mainSelect.innerHTML = topics.map(topic =>
      `<option value="${attr(topic)}">${escHtml(topic)}</option>`
    ).join("");
    if (topics.includes(previousMain)) mainSelect.value = previousMain;
    populateTheorySubtopics();
  }

  suggestQuestionId();
}

function populateTheorySubtopics() {
  const selectedTopic = formValue("qaMainTopic") || DEFAULT_THEORY_TOPIC;
  const sections = mergedTheoryData().filter(sec => (sec.mainTopic || DEFAULT_THEORY_TOPIC) === selectedTopic);
  $("qaSubtopic").innerHTML = sections.map(sec =>
    `<option value="${attr(sec.id)}">${escHtml(sec.title)}</option>`
  ).join("");
}

function populateCodingSubtopics() {
  const sectionId = formValue("qaMainTopic");
  const additions = readContentAdds();
  const section = mergedCodingData().find(sec => sec.id === sectionId);
  const subtopics = uniqueBy([
    DEFAULT_CODING_SUBTOPIC,
    ...safeArray(section && section.cards).map(card => card.subtopic || inferCodingSubtopic(card)),
    ...safeArray(additions.codingSubtopics)
      .filter(item => item.sectionId === sectionId)
      .map(item => item.name)
  ].filter(Boolean), item => item.toLowerCase());

  $("qaSubtopic").innerHTML = subtopics.map(name =>
    `<option value="${attr(name)}">${escHtml(name)}</option>`
  ).join("");
}

function updateFormMode() {
  const kind = formValue("qaKind") || "theory";
  const action = formValue("qaAction") || "question";
  const isCoding = kind === "coding";
  const isMainTopic = action === "main-topic";
  const isSubtopic = action === "subtopic";
  const isQuestion = action === "question";

  document.querySelectorAll("[data-show]").forEach(el => {
    const flags = el.dataset.show.split(/\s+/);
    el.hidden = !flags.includes(action);
  });

  $("qaMainTopicLabel").textContent = isCoding ? "Coding Main Topic" : "Theory Main Topic";
  $("qaSubtopicLabel").textContent = isCoding ? "Coding Subtopic" : "Theory Subtopic";
  $("qaQuestionLabel").textContent = isCoding ? "Problem Title" : "Question";
  $("qaExplanationLabel").textContent = isCoding ? "Description / Problem Statement" : "Answer / Explanation";
  $("qaIdLabel").textContent = isCoding ? "Problem Number" : "Question ID";
  $("qaNewMainTopicLabel").textContent = isCoding ? "New Coding Main Topic" : "New Theory Main Topic";
  $("qaNewSubtopicLabel").textContent = isCoding ? "New Coding Subtopic" : "New Theory Subtopic";

  $("qaQuestion").required = isQuestion;
  $("qaExplanation").required = isQuestion && !isCoding;
  $("qaId").required = isQuestion;
  $("qaNewMainTopic").required = isMainTopic;
  $("qaNewSubtopic").required = isSubtopic;
  $("qaSubtopic").required = isQuestion && !isMainTopic;
  $("qaMainTopic").required = !isMainTopic;

  $("codingFields").hidden = !isCoding || !isQuestion;
  $("qaMarker").disabled = isCoding;

  populateContentForm();
}

function nextQuestionId() {
  const nums = allTheoryQuestions()
    .map(q => String(q.id || "").match(/^q(\d+)$/i))
    .filter(Boolean)
    .map(match => Number(match[1]));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `q${String(next).padStart(2, "0")}`;
}

function nextTheorySectionId() {
  const nums = mergedTheoryData()
    .map(sec => String(sec.id || "").match(/^s(\d+)$/i))
    .filter(Boolean)
    .map(match => Number(match[1]));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `s${next}`;
}

function nextCodingNum() {
  const nums = mergedCodingData()
    .flatMap(sec => safeArray(sec.cards))
    .map(card => Number(String(card.num || "").replace(/\D/g, "")))
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(2, "0");
}

function suggestQuestionId() {
  const input = $("qaId");
  if (!input || input.value.trim()) return;
  input.value = formValue("qaKind") === "coding" ? nextCodingNum() : nextQuestionId();
}

function formValue(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function selectedTags() {
  return [formValue("qaDifficulty"), formValue("qaMarker")].filter(Boolean);
}

function addContent(event) {
  event.preventDefault();
  const kind = formValue("qaKind") || "theory";
  const action = formValue("qaAction") || "question";

  if (action === "main-topic") return addMainTopic(kind);
  if (action === "subtopic") return addSubtopic(kind);
  return kind === "coding" ? addCodingProblem() : addTheoryQuestion();
}

function addMainTopic(kind) {
  const name = formValue("qaNewMainTopic");
  if (!name) return setQaStatus("Enter a main topic name.", "error");
  const additions = readContentAdds();

  if (kind === "coding") {
    const idBase = slugify(name, "coding-topic");
    const existingIds = mergedCodingData().map(sec => sec.id);
    let id = idBase;
    let count = 2;
    while (existingIds.includes(id)) id = `${idBase}-${count++}`;
    additions.codingSections.push({ id, label: name, cards: [] });
  } else {
    const existing = [
      ...normalizeTheoryData(theoryData).map(sec => sec.mainTopic || DEFAULT_THEORY_TOPIC),
      ...additions.theoryTopics
    ].map(item => item.toLowerCase());
    if (!existing.includes(name.toLowerCase())) additions.theoryTopics.push(name);
  }

  writeContentAdds(additions);
  refreshAfterAdd(`${name} main topic added. Add a subtopic next.`);
}

function addSubtopic(kind) {
  const name = formValue("qaNewSubtopic");
  if (!name) return setQaStatus("Enter a subtopic name.", "error");
  const additions = readContentAdds();

  if (kind === "coding") {
    const sectionId = formValue("qaMainTopic");
    additions.codingSubtopics.push({ sectionId, name });
  } else {
    const index = mergedTheoryData().length + additions.theorySections.length + 1;
    const colorIndex = ((index - 1) % 10) + 1;
    additions.theorySections.push({
      id: nextTheorySectionId(),
      icon: formValue("qaIcon"),
      color: `c${colorIndex}`,
      dcolor: `d${colorIndex}`,
      title: name,
      toc: name,
      mainTopic: formValue("qaMainTopic") || DEFAULT_THEORY_TOPIC,
      questions: []
    });
  }

  writeContentAdds(additions);
  refreshAfterAdd(`${name} subtopic added.`);
}

function addTheoryQuestion() {

  const sectionId = formValue("qaSubtopic");
  const id = formValue("qaId");
  const questionText = formValue("qaQuestion");
  const explanation = formValue("qaExplanation");
  const exists = allTheoryQuestions().some(q => String(q.id).toLowerCase() === id.toLowerCase());

  if (exists) {
    setQaStatus(`Question ID ${id} already exists. Use the suggested next ID.`, "error");
    return;
  }

  const question = {
    id,
    question: questionText,
    explanation,
    code: formValue("qaCode"),
    language: formValue("qaLanguage") || "java",
    tableHeaders: [],
    tableRows: [],
    note: formValue("qaNote"),
    tip: formValue("qaTip"),
    warn: formValue("qaWarn"),
    tags: selectedTags()
  };

  const additions = readContentAdds();
  additions.theoryQuestions.push({ sectionId, question });
  writeContentAdds(additions);
  latestQuestion = question;

  refreshAfterAdd(`Added ${id}. It is saved in this browser and visible in Theory.`);
}

function addCodingProblem() {
  const sectionId = formValue("qaMainTopic");
  const subtopic = formValue("qaSubtopic") || DEFAULT_CODING_SUBTOPIC;
  const num = formValue("qaId") || nextCodingNum();
  const title = formValue("qaQuestion");
  const language = formValue("qaLanguage") || "java";
  const difficulty = formValue("qaDifficulty") || "Medium";

  const card = {
    num,
    numColor: formValue("qaNumColor") || "teal",
    title,
    desc: formValue("qaExplanation"),
    subtopic,
    tags: [titleCaseFromSlug(language), subtopic, difficulty].filter(Boolean),
    complexity: [
      { label: "TIME", val: formValue("qaTime") || "O(n)" },
      { label: "SPACE", val: formValue("qaSpace") || "O(1)" }
    ],
    approach: formValue("qaApproach"),
    sqlNote: formValue("qaSqlNote"),
    language,
    code: formValue("qaCode")
  };

  const additions = readContentAdds();
  additions.codingCards.push({ sectionId, card });
  writeContentAdds(additions);
  latestQuestion = card;

  refreshAfterAdd(`Added coding problem ${num}. It is saved in this browser and visible in Coding Solutions.`);
}

function refreshAfterAdd(message) {
  renderTheory(mergedTheoryData());
  renderCoding(mergedCodingData());
  renderLatestQuestion();
  $("qaForm").reset();
  $("qaKind").value = "theory";
  $("qaAction").value = "question";
  $("qaLanguage").value = "java";
  $("qaDifficulty").value = "Medium";
  $("qaMarker").value = "";
  $("qaNumColor").value = "teal";
  updateFormMode();
  setQaStatus(message, "success");
}

function renderLatestQuestion() {
  const el = $("latestQuestionJson");
  if (!el) return;
  el.textContent = latestQuestion ? JSON.stringify(latestQuestion, null, 2) : "{}";
}

function setQaStatus(message, type = "") {
  const el = $("qaStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `form-status ${type}`;
}

function exportTheoryJson() {
  const data = mergedTheoryData();
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "data-theory.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setQaStatus("Exported updated data-theory.json.", "success");
}

function exportCodingJson() {
  const data = mergedCodingData();
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "data-coding.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setQaStatus("Exported updated data-coding.json.", "success");
}

function clearLocalQuestions() {
  const legacyCount = readLocalTheoryAdds().length;
  const additions = readContentAdds();
  const count = legacyCount +
    additions.theoryTopics.length +
    additions.theorySections.length +
    additions.theoryQuestions.length +
    additions.codingSections.length +
    additions.codingSubtopics.length +
    additions.codingCards.length;
  if (!count) {
    setQaStatus("No browser-added content to clear.", "");
    return;
  }
  if (!confirm(`Remove ${count} browser-added item(s)? Export first if you want to keep them.`)) return;
  localStorage.removeItem(LOCAL_THEORY_KEY);
  localStorage.removeItem(LOCAL_CONTENT_KEY);
  latestQuestion = null;
  renderTheory(mergedTheoryData());
  renderCoding(mergedCodingData());
  renderLatestQuestion();
  updateFormMode();
  setQaStatus("Browser-added content cleared.", "success");
}

async function copyLatestQuestion() {
  if (!latestQuestion) {
    setQaStatus("No latest question to copy yet.", "");
    return;
  }
  await navigator.clipboard.writeText(JSON.stringify(latestQuestion, null, 2));
  setQaStatus("Latest question JSON copied.", "success");
}

function highlightCode() {
  if (window.Prism) Prism.highlightAll();
}

function switchTab(tab) {
  activeTab = tab;
  try { sessionStorage.setItem("activeTab", tab); } catch (e) {}

  ["theory", "coding", "add"].forEach(name => {
    const panel = $(`panel-${name}`);
    const button = $(`btn-${name}`);
    if (panel) panel.classList.toggle("active", name === tab);
    if (button) button.className = `tab-btn${name === tab ? ` active-${name}` : ""}`;
  });

  const isAdd = tab === "add";
  $("searchInput").style.display = isAdd ? "none" : "";
  if (!isAdd) {
    $("searchInput").value = "";
    onSearch();
  }
}

function onSearch() {
  const query = $("searchInput").value.toLowerCase().trim();
  const panel = $(`panel-${activeTab}`);
  if (!panel) return;

  const cardSelector = activeTab === "coding" ? ".c-card" : ".t-card";
  const sectionSelector = activeTab === "coding" ? ".c-section" : ".t-section";

  panel.querySelectorAll(cardSelector).forEach(card => {
    card.style.display = !query || card.dataset.search.includes(query) ? "" : "none";
  });

  panel.querySelectorAll(sectionSelector).forEach(section => {
    const anyVisible = [...section.querySelectorAll(cardSelector)].some(card => card.style.display !== "none");
    section.style.display = anyVisible ? "" : "none";
  });
}

function toggleCard(el) {
  el.closest(".t-card").classList.toggle("open");
}

async function init() {
  $("theoryMain").innerHTML = statusHtml("Loading theory questions...");
  $("codingMain").innerHTML = statusHtml("Loading coding problems...");

  try {
    [theoryData, codingData] = await Promise.all([
      loadJson(DATA_FILES.theory),
      loadJson(DATA_FILES.coding)
    ]);
    renderTheory(mergedTheoryData());
    renderCoding(mergedCodingData());
    populateQuestionForm();
    renderLatestQuestion();
  } catch (err) {
    const detail = location.protocol === "file:"
      ? "Open through a local server so the browser can load JSON files."
      : err.message;
    $("theoryMain").innerHTML = statusHtml("Could not load question data.", detail);
    $("codingMain").innerHTML = statusHtml("Could not load coding data.", detail);
    console.error(err);
  }

  try {
    const saved = sessionStorage.getItem("activeTab");
    if (["theory", "coding", "add"].includes(saved) && saved !== "theory") switchTab(saved);
  } catch (e) {}
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".t-card.open").forEach(card => card.classList.remove("open"));
    $("searchInput").value = "";
    onSearch();
  }
  if (event.altKey && event.key === "1") switchTab("theory");
  if (event.altKey && event.key === "2") switchTab("coding");
  if (event.altKey && event.key === "3") switchTab("add");
});

window.switchTab = switchTab;
window.onSearch = onSearch;
window.toggleCard = toggleCard;
window.addContent = addContent;
window.updateFormMode = updateFormMode;
window.populateContentForm = populateContentForm;
window.exportTheoryJson = exportTheoryJson;
window.exportCodingJson = exportCodingJson;
window.clearLocalQuestions = clearLocalQuestions;
window.copyLatestQuestion = copyLatestQuestion;
window.suggestQuestionId = suggestQuestionId;

document.addEventListener("DOMContentLoaded", init);
