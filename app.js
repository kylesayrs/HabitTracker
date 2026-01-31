const WEEKS = 26;
const DAYS_PER_WEEK = 7;
const STORAGE_KEY = "habit-tracker-habits";

const habitsEl = document.getElementById("habits");
const habitCountEl = document.getElementById("habitCount");
const todayLabelEl = document.getElementById("todayLabel");
const habitForm = document.getElementById("habitForm");
const habitNameInput = document.getElementById("habitName");

let habitState = loadState();
const selectedDates = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { habits: [] };
    }
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.habits)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      return {
        habits: [
          {
            id: crypto.randomUUID(),
            name: "Habit",
            commits: parsed,
          },
        ],
      };
    }

    return { habits: [] };
  } catch (error) {
    return { habits: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habitState));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function humanDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function commitLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

function buildCalendarDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endWeekStart = new Date(today);
  endWeekStart.setDate(today.getDate() - today.getDay());
  const start = new Date(endWeekStart);
  start.setDate(endWeekStart.getDate() - (WEEKS - 1) * DAYS_PER_WEEK);

  const weeks = [];
  for (let w = 0; w < WEEKS; w += 1) {
    const weekDates = [];
    for (let d = 0; d < DAYS_PER_WEEK; d += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * DAYS_PER_WEEK + d);
      weekDates.push(date);
    }
    weeks.push(weekDates);
  }

  return { weeks, today };
}

function buildDayLabels() {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wrapper = document.createElement("div");
  wrapper.className = "day-labels";
  labels.forEach((label) => {
    const span = document.createElement("span");
    span.className = "day-label";
    span.textContent = label;
    wrapper.appendChild(span);
  });
  return wrapper;
}

function buildMonths(weeks) {
  const wrapper = document.createElement("div");
  wrapper.className = "months";
  let lastMonth = null;

  weeks.forEach((weekDates) => {
    const weekStart = weekDates[0];
    const month = weekStart.getMonth();
    const label = month !== lastMonth
      ? weekStart.toLocaleDateString(undefined, { month: "short" })
      : "";
    const span = document.createElement("span");
    span.className = "month-label";
    span.textContent = label;
    wrapper.appendChild(span);
    lastMonth = month;
  });

  return wrapper;
}

function buildGrid(habit, selectedDate, onSelect) {
  const { weeks, today } = buildCalendarDates();
  const grid = document.createElement("div");
  grid.className = "grid";

  weeks.forEach((weekDates) => {
    const weekEl = document.createElement("div");
    weekEl.className = "week";

    weekDates.forEach((date) => {
      const dayEl = document.createElement("button");
      const dateKey = formatDate(date);
      const count = habit.commits[dateKey] || 0;
      const level = commitLevel(count);
      const isFuture = date > today;
      dayEl.type = "button";
      dayEl.className = `day level-${level}${isFuture ? " future" : ""}`;
      dayEl.dataset.date = dateKey;
      dayEl.dataset.tooltip = isFuture
        ? `${humanDate(date)} - future`
        : `${humanDate(date)} - ${count} commits`;

      if (selectedDate === dateKey) {
        dayEl.classList.add("selected");
      }

      if (!isFuture) {
        dayEl.addEventListener("click", () => onSelect(dateKey));
      }

      weekEl.appendChild(dayEl);
    });

    grid.appendChild(weekEl);
  });

  return { grid, weeks };
}

function renderHabit(habit, isOpen) {
  const wrapper = document.createElement("article");
  wrapper.className = "habit";
  if (isOpen) {
    wrapper.classList.add("open");
  }

  const header = document.createElement("button");
  header.type = "button";
  header.className = "habit-header";
  header.innerHTML = `
    <span>${habit.name}</span>
    <div class="habit-meta">
      <span>Entries ${Object.keys(habit.commits).length}</span>
    </div>
  `;

  const content = document.createElement("div");
  content.className = "habit-content";

  const controls = document.createElement("div");
  controls.className = "habit-controls";
  controls.innerHTML = `
    <button data-change="-1" class="btn ghost">-1</button>
    <button data-change="1" class="btn">+1</button>
    <button data-change="3" class="btn">+3</button>
    <button data-change="5" class="btn">+5</button>
    <button data-clear="true" class="btn ghost">Clear</button>
    <div class="habit-summary">
      <div>Selected <span class="selected-date">None</span></div>
      <div>Commits <span class="selected-count">0</span></div>
    </div>
  `;

  const chart = document.createElement("div");
  chart.className = "chart habit-chart";
  chart.innerHTML = `
    <div class="chart-header">
      <div class="legend">
        <span>Less</span>
        <div class="legend-squares">
          <span class="level level-0"></span>
          <span class="level level-1"></span>
          <span class="level level-2"></span>
          <span class="level level-3"></span>
          <span class="level level-4"></span>
        </div>
        <span>More</span>
      </div>
    </div>
  `;

  const selectedDateEl = controls.querySelector(".selected-date");
  const selectedCountEl = controls.querySelector(".selected-count");

  function updateSummary() {
    const selectedDate = selectedDates[habit.id];
    if (!selectedDate) {
      selectedDateEl.textContent = "None";
      selectedCountEl.textContent = "0";
      return;
    }

    const date = new Date(`${selectedDate}T00:00:00`);
    const count = habit.commits[selectedDate] || 0;
    selectedDateEl.textContent = humanDate(date);
    selectedCountEl.textContent = count.toString();
  }

  function selectDate(dateKey) {
    selectedDates[habit.id] = dateKey;
    renderHabits(habit.id);
  }

  function changeCommits(delta) {
    const selectedDate = selectedDates[habit.id];
    if (!selectedDate) return;
    const current = habit.commits[selectedDate] || 0;
    const next = Math.max(0, current + delta);
    habit.commits[selectedDate] = next;
    saveState();
    renderHabits(habit.id);
  }

  function clearDay() {
    const selectedDate = selectedDates[habit.id];
    if (!selectedDate) return;
    habit.commits[selectedDate] = 0;
    saveState();
    renderHabits(habit.id);
  }

  controls.querySelectorAll("button[data-change]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.change || 0);
      changeCommits(delta);
    });
  });

  controls.querySelector("button[data-clear]").addEventListener("click", clearDay);

  const { grid, weeks } = buildGrid(habit, selectedDates[habit.id], selectDate);
  const months = buildMonths(weeks);
  const labels = buildDayLabels();
  const chartBody = document.createElement("div");
  chartBody.className = "chart-body";
  chartBody.appendChild(labels);
  chartBody.appendChild(grid);

  chart.appendChild(months);
  chart.appendChild(chartBody);

  content.appendChild(controls);
  content.appendChild(chart);

  header.addEventListener("click", () => {
    const isOpen = wrapper.classList.contains("open");
    document.querySelectorAll(".habit").forEach((node) => {
      node.classList.remove("open");
    });
    if (!isOpen) {
      wrapper.classList.add("open");
    }
  });

  wrapper.appendChild(header);
  wrapper.appendChild(content);

  updateSummary();

  return wrapper;
}

function renderHabits(openHabitId = null) {
  habitsEl.innerHTML = "";

  if (!habitState.habits.length) {
    const empty = document.createElement("div");
    empty.className = "habit empty";
    empty.innerHTML = `
      <div class="habit-header">
        <span>Add your first habit to get started.</span>
      </div>
    `;
    habitsEl.appendChild(empty);
    habitCountEl.textContent = "0";
    return;
  }

  const resolvedOpenId = openHabitId || habitState.habits[0].id;

  habitState.habits.forEach((habit) => {
    const habitEl = renderHabit(habit, habit.id === resolvedOpenId);
    habitsEl.appendChild(habitEl);
  });

  habitCountEl.textContent = habitState.habits.length.toString();
}

function addHabit(name) {
  habitState.habits.unshift({
    id: crypto.randomUUID(),
    name,
    commits: {},
  });
  saveState();
  habitNameInput.value = "";
  renderHabits(habitState.habits[0].id);
}

function bindEvents() {
  habitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = habitNameInput.value.trim();
    if (!name) return;
    addHabit(name);
  });
}

function init() {
  todayLabelEl.textContent = humanDate(new Date());
  bindEvents();
  renderHabits();
}

init();
