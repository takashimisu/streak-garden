// Загрузка привычек
let habits = JSON.parse(localStorage.getItem('habits')) || [];
let today = new Date().toISOString().split('T')[0];

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const DAY_ACC = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// 0 = понедельник ... 6 = воскресенье
function mondayBasedDay(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

let selectedDayOfWeek = mondayBasedDay();
let viewDay = mondayBasedDay();
const todayDayOfWeek = mondayBasedDay();

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function weekStartISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - mondayBasedDay(d));
  return toISODate(d);
}

function currentWeekDates() {
  const start = new Date(weekStartISO() + 'T12:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

let completedWeeks = JSON.parse(localStorage.getItem('completedWeeks')) || [];

function isWeekComplete(dates) {
  return dates.every((iso) => {
    const { done, total } = dayProgress(iso);
    return total > 0 && done === total;
  });
}

// Only the current week can be added or removed; past completed weeks stay forever
function syncCompletedWeeks() {
  const key = weekStartISO();
  const complete = isWeekComplete(currentWeekDates());
  const has = completedWeeks.includes(key);
  if (complete && !has) completedWeeks.push(key);
  if (!complete && has) completedWeeks = completedWeeks.filter((w) => w !== key);
  localStorage.setItem('completedWeeks', JSON.stringify(completedWeeks));
}

// +1 for each fully completed day, reset at the first past day with an unfinished task,
// days with no tasks keep the value. Today counts only once it is complete.
function dayStreak() {
  if (!habits.length) return 0;
  const earliest = habits.map((h) => normalizeHabit(h).createdAt).sort()[0];
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00');
  for (let guard = 0; guard < 3660; guard++) {
    const iso = toISODate(cursor);
    if (iso < earliest) break;
    const { done, total } = dayProgress(iso);
    if (total > 0) {
      if (done === total) streak++;
      else if (iso !== today) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function weeklyStreak() {
  return completedWeeks.length * 7;
}

function allDoneDates() {
  const set = new Set();
  habits.forEach((h) => (h.history || []).forEach((d) => set.add(d)));
  return set;
}

function normalizeHabit(habit) {
  if (typeof habit.dayOfWeek !== 'number') {
    habit.dayOfWeek = todayDayOfWeek;
  }
  if (!habit.createdAt) {
    const hist = (habit.history || []).slice().sort();
    habit.createdAt = hist.length && hist[0] < today ? hist[0] : today;
  }
  return habit;
}

habits = habits.map(normalizeHabit);

// Текущая серия дней подряд до сегодня (не максимум за всё время)
function calculateStreak(history) {
  if (!history || !history.length) return 0;
  const set = new Set(history);
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  if (!set.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (set.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function overallCurrentStreak() {
  const set = allDoneDates();
  if (!set.size) return 0;
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!set.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function totalCompletions() {
  return habits.reduce((sum, h) => sum + (h.history ? h.history.length : 0), 0);
}

function dayProgress(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dow = mondayBasedDay(d);
  const scheduled = habits.filter((h) => normalizeHabit(h).dayOfWeek === dow && h.createdAt <= iso);
  const done = scheduled.filter((h) => (h.history || []).includes(iso)).length;
  return { done, total: scheduled.length };
}

function updateHeatmap() {
  const heatmap = document.getElementById('heatmap');
  const firstRender = heatmap.children.length !== 7;
  if (firstRender) {
    heatmap.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.style.setProperty('--fill', '0%');
      heatmap.appendChild(cell);
    }
  }
  const cells = heatmap.children;
  const apply = () => {
    const week = currentWeekDates();
    for (let i = 0; i < 7; i++) {
      const iso = week[i];
      const { done, total } = dayProgress(iso);
      const ratio = total ? done / total : 0;
      const cell = cells[i];
      const wasFull = cell.classList.contains('active');
      cell.classList.toggle('active', ratio >= 1);
      if (!firstRender && ratio >= 1 && !wasFull) {
        cell.classList.remove('pulse');
        void cell.offsetWidth;
        cell.classList.add('pulse');
        clearTimeout(cell._pulseTimer);
        cell._pulseTimer = setTimeout(() => cell.classList.remove('pulse'), 2200);
      }
      if (ratio < 1) cell.classList.remove('pulse');
      cell.classList.toggle('empty', ratio <= 0);
      const newFill = `${Math.round(ratio * 100)}%`;
      if (!firstRender && cell.style.getPropertyValue('--fill') !== newFill) {
        Water.trigger(cell);
      }
      cell.style.setProperty('--fill', newFill);
      cell.title = `${iso}: ${done}/${total}`;
    }
  };
  if (firstRender) {
    requestAnimationFrame(() => requestAnimationFrame(apply));
  } else {
    apply();
  }
}

function updateStats() {
  const streak = dayStreak();
  const total = totalCompletions();
  document.getElementById('stats-text').textContent =
    `Текущая серия: ${streak} · Всего выполнений: ${total}`;
}

function viewDateISO() {
  return currentWeekDates()[viewDay];
}

function isHabitDayToday(habit) {
  return normalizeHabit(habit).dayOfWeek === todayDayOfWeek;
}

// Рендер карточек
function renderHabits() {
  const list = document.getElementById('habit-list');
  list.innerHTML = '';
  const visible = habits
    .map((habit, index) => ({ habit: normalizeHabit(habit), index }))
    .filter(({ habit }) => habit.dayOfWeek === viewDay)
    .sort((a, b) => (a.habit.time || '99:99').localeCompare(b.habit.time || '99:99'));

  if (!visible.length) {
    list.innerHTML = `<p class="empty-day">Привычек ${DAY_ACC[viewDay]} нет</p>`;
    return;
  }

  visible.forEach(({ habit, index }) => {
    const card = document.createElement('div');
    card.className = 'habit-card';
    const targetDate = viewDateISO();
    const isDone = habit.history?.includes(targetDate);
    const streak = calculateStreak(habit.history || []);
    const canCheck = targetDate <= today && habit.createdAt <= targetDate;
    const dayLabel = DAY_NAMES[habit.dayOfWeek] || DAY_SHORT[habit.dayOfWeek];
    const checkText = targetDate === today ? 'Сегодня сделано' : `Сделано ${DAY_ACC[viewDay]}`;
    const lockedText = targetDate > today
      ? `Отметить можно ${DAY_ACC[viewDay]}`
      : 'Привычки ещё не было в этот день';

    card.innerHTML = `
      <button class="delete-habit" title="Удалить" aria-label="Удалить привычку" onclick="deleteHabit(${index})">&times;</button>
      <h3 class="habit-name">${habit.name}</h3>
      <div class="habit-day">${dayLabel}${habit.time ? ` · ${habit.time}` : ''}</div>
      <div class="streak status ${isDone ? 'status-done' : 'status-todo'}">
        <span class="status-icon">${isDone ? '✓' : '✕'}</span>
        <span class="status-text">${isDone ? 'выполнено' : 'не выполнено'}</span>
      </div>
      ${canCheck ? `
      <label class="check-label">
        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleHabit(${index})">
        ${checkText}
      </label>` : `
      <p class="check-unavailable">${lockedText}</p>
      `}
    `;
    list.appendChild(card);

    const streakEl = card.querySelector('.streak');
    if (canCheck && isDone && streakEl && !streakEl.classList.contains('grow')) {
      streakEl.classList.add('grow');
      setTimeout(() => streakEl.classList.remove('grow'), 700);
    }
  });
}

function deleteHabit(index) {
  const habit = habits[index];
  if (!habit) return;
  if (!confirm(`Удалить привычку «${habit.name}»?`)) return;
  habits.splice(index, 1);
  saveAndRender();
}

// Toggle и сохранение
function toggleHabit(index) {
  const habit = habits[index];
  const date = viewDateISO();
  if (habit.dayOfWeek !== viewDay || date > today || habit.createdAt > date) return;
  if (!habit.history) habit.history = [];
  if (habit.history.includes(date)) {
    habit.history = habit.history.filter((d) => d !== date);
  } else {
    habit.history.push(date);
  }
  saveAndRender();
}

// Сохранение
function saveAndRender() {
  localStorage.setItem('habits', JSON.stringify(habits));
  syncCompletedWeeks();
  renderHabits();
  updateHeatmap();
  updateStats();
}

const modal = document.getElementById('modal');
const dayPicker = document.getElementById('day-picker');

function syncDayPickerUI() {
  dayPicker.querySelectorAll('.day-option').forEach((btn) => {
    btn.classList.toggle('selected', Number(btn.dataset.day) === selectedDayOfWeek);
  });
}

dayPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.day-option');
  if (!btn) return;
  selectedDayOfWeek = Number(btn.dataset.day);
  syncDayPickerUI();
});

function openModal() {
  selectedDayOfWeek = viewDay;
  syncDayPickerUI();
  modal.style.display = 'flex';
  document.getElementById('habit-name').focus();
}

function closeModal() {
  modal.style.display = 'none';
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-time').value = '09:00';
  selectedDayOfWeek = viewDay;
  syncDayPickerUI();
}

const dayFilter = document.getElementById('day-filter');

function syncDayFilterUI() {
  dayFilter.querySelectorAll('.day-option').forEach((btn) => {
    btn.classList.toggle('selected', Number(btn.dataset.day) === viewDay);
    btn.classList.toggle('is-today', Number(btn.dataset.day) === todayDayOfWeek);
  });
}

dayFilter.addEventListener('click', (e) => {
  const btn = e.target.closest('.day-option');
  if (!btn) return;
  viewDay = Number(btn.dataset.day);
  syncDayFilterUI();
  renderHabits();
});

document.getElementById('add-habit').onclick = openModal;
document.getElementById('close-modal').onclick = closeModal;

document.getElementById('save-habit').onclick = () => {
  const name = document.getElementById('habit-name').value.trim();
  if (name) {
    const time = document.getElementById('habit-time').value || '';
    habits.push({ name, dayOfWeek: selectedDayOfWeek, time, createdAt: today, history: [] });
    viewDay = selectedDayOfWeek;
    syncDayFilterUI();
    saveAndRender();
    closeModal();
  }
};

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
});

const themeBtn = document.getElementById('toggle-theme');
function applyThemeIcon() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.textContent = dark ? '☀️' : '🌙';
}

themeBtn.onclick = () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  if (root.dataset.theme === 'light') delete root.dataset.theme;
  applyThemeIcon();
};

applyThemeIcon();
syncDayPickerUI();
syncDayFilterUI();
saveAndRender();
