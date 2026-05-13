const STORAGE_KEY = "brainquiz-progress-v1";
const TAIPEI_TIME_ZONE = "Asia/Taipei";
const DECK_LABELS = {
  Monday: "Monday 題庫",
  Tuesday: "Tuesday 題庫",
  Wednesday: "Wednesday 題庫",
  Thursday: "Thursday 題庫",
  Friday: "Friday 題庫",
};

const todayLabel = document.getElementById("todayLabel");
const deckLabel = document.getElementById("deckLabel");
const indexLabel = document.getElementById("indexLabel");
const panelTitle = document.getElementById("panelTitle");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const toggleAnswerButton = document.getElementById("toggleAnswerButton");
const resetButton = document.getElementById("resetButton");
const weekdayPanel = document.getElementById("weekdayPanel");
const weekendPanel = document.getElementById("weekendPanel");

let answerVisible = false;

function formatToday(date) {
  return (
    new Intl.DateTimeFormat("zh-TW", {
      timeZone: TAIPEI_TIME_ZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date) + "（台北時間）"
  );
}

function getTaipeiContext(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const isoDate = `${lookup.year}-${lookup.month}-${lookup.day}`;

  return {
    isoDate,
    weekdayName: lookup.weekday,
    todayLabel: formatToday(date),
  };
}

function loadProgress() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function isoToUtcDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(fromIso, toIso) {
  const diffMs = isoToUtcDate(toIso) - isoToUtcDate(fromIso);
  return Math.floor(diffMs / 86400000);
}

function getQuestionIndex(deckName, todayIso, totalQuestions) {
  const progress = loadProgress();
  const entry = progress[deckName];

  if (!entry || !entry.anchorDate) {
    progress[deckName] = { anchorDate: todayIso };
    saveProgress(progress);
    return 0;
  }

  const diffDays = daysBetween(entry.anchorDate, todayIso);
  const elapsedWeeks = diffDays > 0 ? Math.floor(diffDays / 7) : 0;
  return elapsedWeeks % totalQuestions;
}

function resetCurrentDeck(deckName, todayIso) {
  const progress = loadProgress();
  progress[deckName] = { anchorDate: todayIso };
  saveProgress(progress);
}

function setAnswerVisibility(visible) {
  answerVisible = visible;
  answerText.classList.toggle("is-concealed", !visible);
  toggleAnswerButton.textContent = visible ? "隱藏答案" : "顯示答案";
}

function renderWeekdayGame(deckName, context, date) {
  const questions = window.BRAIN_QUIZ_DATA?.[deckName] || [];
  const todayIso = context.isoDate;

  todayLabel.textContent = context.todayLabel;
  deckLabel.textContent = DECK_LABELS[deckName] || deckName;

  if (!questions.length) {
    indexLabel.textContent = "資料缺失";
    panelTitle.textContent = "題庫未載入";
    questionText.textContent = "目前找不到這一天的題目資料。";
    answerText.textContent = "請確認 data/questions.js 是否存在且已成功載入。";
    setAnswerVisibility(true);
    return;
  }

  const questionIndex = getQuestionIndex(deckName, todayIso, questions.length);
  const question = questions[questionIndex];

  indexLabel.textContent = `${questionIndex + 1} / ${questions.length}`;
  panelTitle.textContent = `${deckName} 今日題目`;
  questionText.textContent = question.question;
  answerText.textContent = question.answer;
  setAnswerVisibility(true);

  toggleAnswerButton.onclick = () => {
    setAnswerVisibility(!answerVisible);
  };

  resetButton.onclick = () => {
    const confirmed = window.confirm(
      `要把 ${deckName} 題庫重設回第 1 題嗎？這只會影響目前這一天的進度。`
    );

    if (!confirmed) {
      return;
    }

    resetCurrentDeck(deckName, todayIso);
    renderWeekdayGame(deckName, context, date);
  };
}

function renderWeekend(context) {
  todayLabel.textContent = context.todayLabel;
  deckLabel.textContent = "週末休息";
  indexLabel.textContent = "--";
  weekdayPanel.classList.add("is-hidden");
  weekendPanel.classList.remove("is-hidden");
}

function startGame() {
  const now = new Date();
  const context = getTaipeiContext(now);
  const weekdayName = context.weekdayName;

  if (!window.BRAIN_QUIZ_DATA) {
    todayLabel.textContent = context.todayLabel;
    deckLabel.textContent = "載入失敗";
    indexLabel.textContent = "--";
    questionText.textContent = "題庫資料尚未載入。";
    answerText.textContent = "請先產生並載入 data/questions.js。";
    setAnswerVisibility(true);
    return;
  }

  if (window.BRAIN_QUIZ_DATA[weekdayName]) {
    weekdayPanel.classList.remove("is-hidden");
    weekendPanel.classList.add("is-hidden");
    renderWeekdayGame(weekdayName, context, now);
    return;
  }

  renderWeekend(context);
}

startGame();
