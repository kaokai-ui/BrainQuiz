const TAIPEI_TIME_ZONE = "Asia/Taipei";
const DECK_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DECK_LABELS = {
  Monday: "Monday 題庫",
  Tuesday: "Tuesday 題庫",
  Wednesday: "Wednesday 題庫",
  Thursday: "Thursday 題庫",
  Friday: "Friday 題庫",
};
const DECK_BASE_DATES = {
  Monday: "2026-05-11",
  Tuesday: "2026-05-12",
  Wednesday: "2026-05-13",
  Thursday: "2026-05-14",
  Friday: "2026-05-15",
};

const todayLabel = document.getElementById("todayLabel");
const deckLabel = document.getElementById("deckLabel");
const indexLabel = document.getElementById("indexLabel");
const panelTitle = document.getElementById("panelTitle");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const toggleAnswerButton = document.getElementById("toggleAnswerButton");
const progressButton = document.getElementById("progressButton");
const weekdayPanel = document.getElementById("weekdayPanel");
const weekendPanel = document.getElementById("weekendPanel");
const progressPanel = document.getElementById("progressPanel");
const progressDeckSelect = document.getElementById("progressDeckSelect");
const progressFilterSelect = document.getElementById("progressFilterSelect");
const progressDeckLabel = document.getElementById("progressDeckLabel");
const progressUsedCount = document.getElementById("progressUsedCount");
const progressRemainingCount = document.getElementById("progressRemainingCount");
const progressCurrentCount = document.getElementById("progressCurrentCount");
const progressHint = document.getElementById("progressHint");
const progressList = document.getElementById("progressList");

let answerVisible = true;
let latestContext = null;

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

function isoToUtcDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(fromIso, toIso) {
  return Math.floor((isoToUtcDate(toIso) - isoToUtcDate(fromIso)) / 86400000);
}

function getDeckProgress(deckName, todayIso, totalQuestions) {
  const baseDate = DECK_BASE_DATES[deckName];
  const diffDays = daysBetween(baseDate, todayIso);

  if (diffDays < 0) {
    return {
      baseDate,
      firstCycleUsedCount: 0,
      totalOccurrences: 0,
      remainingCount: totalQuestions,
      currentIndex: null,
      currentNumber: null,
    };
  }

  const totalOccurrences = Math.floor(diffDays / 7) + 1;
  const firstCycleUsedCount = Math.min(totalOccurrences, totalQuestions);
  const currentIndex = (totalOccurrences - 1) % totalQuestions;

  return {
    baseDate,
    firstCycleUsedCount,
    totalOccurrences,
    remainingCount: totalQuestions - firstCycleUsedCount,
    currentIndex,
    currentNumber: currentIndex + 1,
  };
}

function setAnswerVisibility(visible) {
  answerVisible = visible;
  answerText.classList.toggle("is-concealed", !visible);
  toggleAnswerButton.textContent = visible ? "隱藏答案" : "顯示答案";
}

function getQuestionPreview(questionTextValue) {
  const firstLine = (questionTextValue || "").split("\n").find((line) => line.trim()) || "";
  return firstLine.length > 34 ? `${firstLine.slice(0, 34)}...` : firstLine;
}

function populateProgressDeckOptions() {
  progressDeckSelect.innerHTML = "";

  for (const deckName of DECK_ORDER) {
    const option = document.createElement("option");
    option.value = deckName;
    option.textContent = DECK_LABELS[deckName];
    progressDeckSelect.append(option);
  }
}

function renderProgressPanel(context, preferredDeckName) {
  const deckName = preferredDeckName || progressDeckSelect.value || DECK_ORDER[0];
  const questions = window.BRAIN_QUIZ_DATA?.[deckName] || [];
  const filter = progressFilterSelect.value || "all";
  const progress = getDeckProgress(deckName, context.isoDate, questions.length);

  progressDeckSelect.value = deckName;
  progressDeckLabel.textContent = DECK_LABELS[deckName];
  progressUsedCount.textContent = `${progress.firstCycleUsedCount} 題`;
  progressRemainingCount.textContent = `${progress.remainingCount} 題`;
  progressCurrentCount.textContent = progress.currentNumber
    ? `第 ${progress.currentNumber} 題`
    : "尚未開始";

  progressHint.textContent =
    `固定基準日：${progress.baseDate}，所有裝置都用台北日期推算相同題號。`;

  progressList.innerHTML = "";

  for (let index = 0; index < questions.length; index += 1) {
    const isUsed = index < progress.firstCycleUsedCount;
    const isCurrent = progress.currentIndex === index;
    const statusKey = isUsed ? "used" : "upcoming";

    if (filter === "used" && !isUsed) {
      continue;
    }

    if (filter === "upcoming" && isUsed) {
      continue;
    }

    const item = document.createElement("li");
    item.className = `progress-item${isCurrent ? " is-current" : ""}`;

    const number = document.createElement("span");
    number.className = "progress-number";
    number.textContent = `#${index + 1}`;

    const badge = document.createElement("span");
    badge.className = `progress-badge progress-badge-${statusKey}`;
    badge.textContent = isCurrent ? "本輪題目" : isUsed ? "已出過" : "未出題";

    const preview = document.createElement("span");
    preview.className = "progress-preview";
    preview.textContent = getQuestionPreview(questions[index].question);

    item.append(number, badge, preview);
    progressList.append(item);
  }
}

function toggleProgressPanel(context, preferredDeckName) {
  const willShow = progressPanel.classList.contains("is-hidden");
  progressPanel.classList.toggle("is-hidden", !willShow);
  progressButton.textContent = willShow ? "收起出題進度" : "查看出題進度";

  if (willShow) {
    renderProgressPanel(context, preferredDeckName);
  }
}

function renderWeekdayGame(deckName, context) {
  const questions = window.BRAIN_QUIZ_DATA?.[deckName] || [];

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

  const progress = getDeckProgress(deckName, context.isoDate, questions.length);
  const questionIndex = progress.currentIndex ?? 0;
  const question = questions[questionIndex];

  indexLabel.textContent = `${questionIndex + 1} / ${questions.length}`;
  panelTitle.textContent = `${deckName} 今日題目`;
  questionText.textContent = question.question;
  answerText.textContent = question.answer;
  setAnswerVisibility(true);

  toggleAnswerButton.onclick = () => {
    setAnswerVisibility(!answerVisible);
  };

  progressButton.onclick = () => {
    toggleProgressPanel(context, deckName);
  };
}

function renderWeekend(context) {
  todayLabel.textContent = context.todayLabel;
  deckLabel.textContent = "週末休息";
  indexLabel.textContent = "--";
  weekdayPanel.classList.add("is-hidden");
  weekendPanel.classList.remove("is-hidden");

  progressButton.onclick = () => {
    toggleProgressPanel(context, DECK_ORDER[0]);
  };
}

function bindProgressControls() {
  progressDeckSelect.onchange = () => {
    if (latestContext) {
      renderProgressPanel(latestContext, progressDeckSelect.value);
    }
  };

  progressFilterSelect.onchange = () => {
    if (latestContext) {
      renderProgressPanel(latestContext, progressDeckSelect.value);
    }
  };
}

function startGame() {
  const now = new Date();
  const context = getTaipeiContext(now);
  const weekdayName = context.weekdayName;
  latestContext = context;

  populateProgressDeckOptions();
  bindProgressControls();

  if (!window.BRAIN_QUIZ_DATA) {
    todayLabel.textContent = context.todayLabel;
    deckLabel.textContent = "載入失敗";
    indexLabel.textContent = "--";
    questionText.textContent = "題庫資料尚未載入。";
    answerText.textContent = "請先產生並載入 data/questions.js。";
    setAnswerVisibility(true);
    progressButton.onclick = () => {
      toggleProgressPanel(context, DECK_ORDER[0]);
    };
    return;
  }

  if (window.BRAIN_QUIZ_DATA[weekdayName]) {
    weekdayPanel.classList.remove("is-hidden");
    weekendPanel.classList.add("is-hidden");
    renderWeekdayGame(weekdayName, context);
    return;
  }

  renderWeekend(context);
}

startGame();
