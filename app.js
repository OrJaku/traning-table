/* ============================================================
   Dziennik treningu — logika aplikacji
   ============================================================ */

// ============================================================
// 1. Stałe i pamięć (localStorage)
// ============================================================
const STORAGE_KEY  = 'workout-journal-v1';
const LAST_EX_KEY  = 'workout-last-exercise';

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
};

const save = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));


// ============================================================
// 2. Pomocnicze — daty, formatowanie, polska gramatyka
// ============================================================
const todayKey = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
};

const formatShortDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const pluralize = (n) => {
  if (n === 1) return 'wpis';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'wpisy';
  return 'wpisów';
};

const seriaWord = (n) => {
  const num = parseInt(n);
  if (isNaN(num)) return n;
  if (num === 1) return '1 seria';
  if (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) return `${num} serie`;
  return `${num} serii`;
};

const sumReps = (entries) =>
  entries.reduce((total, entry) => {
    const reps = parseInt(entry.reps, 10);
    return Number.isNaN(reps) ? total : total + reps;
  }, 0);

function parseDateDDMMYYYY(s) {
  const m = String(s).trim().match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = d.padStart(2,'0'), mm = mo.padStart(2,'0');
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
  return `${y}-${mm}-${dd}`;
}

function clampEntryDate(iso) {
  const date = String(iso || '').trim();
  const today = todayKey();
  if (!date) return today;
  return date > today ? today : date;
}

function shiftDate(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}


// ============================================================
// 3. Renderowanie wpisów i widoku
// ============================================================
const HISTORY_PAGE_SIZE = 25;
let editingKey = null; // format: "day:idx" — który wpis jest aktualnie edytowany
let historyPage = 0;
let historyView = 'chart';

const entryHTML = (e, day, idx) => {
  const isToday = day === todayKey();
  const isEditing = editingKey === `${day}:${idx}`;

  if (isEditing) {
    return `
      <div class="entry editing">
        <div class="entry-name">${escapeHtml(e.name)}</div>
        <div class="edit-reps-control">
          <button class="step-btn edit-step-btn" type="button" data-delta="-5" aria-label="Odejmij 5">-</button>
          <input class="edit-input" type="text" inputmode="numeric"
                 value="${escapeHtml(e.reps)}" data-day="${day}" data-idx="${idx}"
                 aria-label="Liczba powtórzeń">
          <button class="step-btn edit-step-btn" type="button" data-delta="5" aria-label="Dodaj 5">+</button>
        </div>
        <div class="edit-actions">
          <button class="edit-cancel" type="button">Anuluj</button>
          <button class="edit-save" type="button" data-day="${day}" data-idx="${idx}">Zapisz</button>
        </div>
      </div>
    `;
  }

  const stats = [];
  if (e.sets) stats.push(seriaWord(e.sets));
  if (e.reps) stats.push(`${e.reps} powt.`);
  if (e.weight) stats.push(`${e.weight} kg`);

  return `
    <div class="entry">
      <div class="entry-actions">
        ${isToday ? `<button class="entry-action edit" data-day="${day}" data-idx="${idx}" aria-label="Edytuj">✎</button>` : ''}
        <button class="entry-action delete" data-day="${day}" data-idx="${idx}" aria-label="Usuń">×</button>
      </div>
      <div class="entry-name">${escapeHtml(e.name)}</div>
      ${stats.length ? `<div class="entry-stats">${stats.join(' · ')}</div>` : ''}
      ${e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : ''}
    </div>
  `;
};

function render() {
  const data = load();
  const today = todayKey();
  const todayEntries = data[today] || [];

  document.getElementById('today-date').textContent = formatDate(today);

  // Lista dzisiejszych wpisów
  const todayList = document.getElementById('today-list');
  todayList.innerHTML = todayEntries.length === 0
    ? '<div class="empty">Jeszcze nic dzisiaj.</div>'
    : todayEntries.map((e, i) => entryHTML(e, today, i)).join('');

  const otherDays = Object.keys(data)
    .filter(day => day < today)
    .sort()
    .reverse();
  renderHistoryList(data, otherDays);
  renderHistoryChart(data, today);
  updateHistoryView();

  attachEntryEventHandlers();
  attachHistoryPaginationHandlers(Math.max(1, Math.ceil(otherDays.length / HISTORY_PAGE_SIZE)));
  attachHistoryViewHandlers();
}

function renderHistoryList(data, otherDays) {
  const totalHistoryPages = Math.max(1, Math.ceil(otherDays.length / HISTORY_PAGE_SIZE));
  historyPage = Math.min(historyPage, totalHistoryPages - 1);
  const pageStart = historyPage * HISTORY_PAGE_SIZE;
  const visibleDays = otherDays.slice(pageStart, pageStart + HISTORY_PAGE_SIZE);
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = otherDays.length === 0
    ? '<div class="empty">Brak wcześniejszych wpisów.</div>'
    : visibleDays.map(day => {
        const entries = data[day];
        const repsTotal = sumReps(entries);
        return `
          <div class="day-group">
            <div class="day-header" data-day="${day}">
              <span class="day-header-date">${formatDate(day)}</span>
              <span class="day-summary">
                <span class="reps-total">${repsTotal ? `${repsTotal}` : ''}</span>
                <span class="count">${entries.length} ${pluralize(entries.length)}</span>
              </span>
            </div>
            <div class="day-content" data-day-content="${day}">
              <div style="height:8px"></div>
              ${entries.map((e, i) => entryHTML(e, day, i)).join('')}
            </div>
          </div>
        `;
      }).join('');

  const historyPagination = document.getElementById('history-pagination');
  historyPagination.className = 'history-pagination';
  historyPagination.innerHTML = otherDays.length <= HISTORY_PAGE_SIZE
    ? ''
    : `
        <button class="ghost" id="history-prev-btn" type="button" ${historyPage === 0 ? 'disabled' : ''}>Poprzednie 25</button>
        <div class="history-page-info">Strona ${historyPage + 1} z ${totalHistoryPages}</div>
        <button class="ghost" id="history-next-btn" type="button" ${historyPage >= totalHistoryPages - 1 ? 'disabled' : ''}>Następne 25</button>
      `;
}

function renderHistoryChart(data, today) {
  const points = [];
  for (let i = 14; i >= 0; i--) {
    const day = shiftDate(today, -i);
    points.push({
      day,
      total: sumReps(data[day] || [])
    });
  }

  const maxTotal = Math.max(...points.map(point => point.total), 1);
  const chartHeight = 180;
  const bottomY = 190;
  const stepX = 22;
  const startX = 26;

  const bars = points.map((point, index) => {
    const height = Math.round((point.total / maxTotal) * chartHeight);
    const x = startX + index * stepX;
    const y = bottomY - height;
    const isToday = point.day === today;
    const label = isToday ? 'dziś' : (index % 2 === 0 ? formatShortDate(point.day) : '');
    const barClasses = ['chart-bar'];
    if (isToday) barClasses.push('today');
    if (point.total === 0) barClasses.push('zero');
    return `
      <rect class="${barClasses.join(' ')}" x="${x}" y="${y}" width="14" height="${height || 2}" rx="4"></rect>
      ${point.total > 0 ? `<text class="chart-value" x="${x + 7}" y="${Math.max(14, y - 6)}" text-anchor="middle">${point.total}</text>` : ''}
      ${label ? `<text class="chart-label ${isToday ? 'today' : ''}" x="${x + 7}" y="214" text-anchor="middle">${label}</text>` : ''}
    `;
  }).join('');

  const historyChart = document.getElementById('history-chart');
  historyChart.innerHTML = `
    <p class="chart-caption">Suma powtórzeń z ostatnich 15 dni, łącznie z dzisiaj.</p>
    <svg class="chart-svg" viewBox="0 0 360 220" role="img" aria-label="Wykres liczby powtórzeń z ostatnich 15 dni">
      <line class="chart-grid" x1="18" y1="${bottomY}" x2="350" y2="${bottomY}"></line>
      <line class="chart-grid" x1="18" y1="10" x2="18" y2="${bottomY}"></line>
      ${bars}
    </svg>
  `;
}

function updateHistoryView() {
  const listView = document.getElementById('history-list-view');
  const chartView = document.getElementById('history-chart-view');
  const tabs = document.querySelectorAll('.history-tab');

  listView.classList.toggle('hidden', historyView !== 'list');
  chartView.classList.toggle('hidden', historyView !== 'chart');

  tabs.forEach(tab => {
    const isActive = tab.dataset.view === historyView;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
}


// ============================================================
// 4. Event handlery dla wpisów (delete, edit, save, cancel)
// ============================================================
function attachEntryEventHandlers() {
  // Usuń wpis
  document.querySelectorAll('.entry-action.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day, idx = parseInt(btn.dataset.idx);
      if (day < todayKey() && !window.confirm(`Usunąć historyczny wpis z dnia ${formatDate(day)}?`)) {
        return;
      }
      const data = load();
      if (data[day]) {
        data[day].splice(idx, 1);
        if (data[day].length === 0) delete data[day];
        save(data);
        render();
      }
    });
  });

  // Włącz tryb edycji
  document.querySelectorAll('.entry-action.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editingKey = `${btn.dataset.day}:${btn.dataset.idx}`;
      render();
      const input = document.querySelector('.edit-input');
      if (input) { input.focus(); input.select(); }
    });
  });

  // Zapisz edycję
  document.querySelectorAll('.edit-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day, idx = parseInt(btn.dataset.idx);
      const input = document.querySelector('.edit-input');
      const newReps = input ? input.value.trim() : '';
      if (newReps) {
        const data = load();
        if (data[day] && data[day][idx]) {
          data[day][idx].reps = newReps;
          save(data);
        }
      }
      editingKey = null;
      render();
    });
  });

  // Anuluj edycję
  document.querySelectorAll('.edit-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      editingKey = null;
      render();
    });
  });

  // Skróty klawiszowe w polu edycji
  document.querySelectorAll('.edit-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = document.querySelector('.edit-save');
        if (saveBtn) saveBtn.click();
      } else if (e.key === 'Escape') {
        editingKey = null;
        render();
      }
    });
  });

  document.querySelectorAll('.edit-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('.edit-input');
      const delta = parseInt(btn.dataset.delta, 10);
      const currentValue = parseInt(input.value, 10);
      const safeValue = Number.isNaN(currentValue) ? 0 : currentValue;
      input.value = Math.max(0, safeValue + delta);
      input.focus();
    });
  });

  // Rozwijanie dni w historii
  document.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => {
      const day = h.dataset.day;
      document.querySelector(`[data-day-content="${day}"]`).classList.toggle('open');
    });
  });
}

function attachHistoryPaginationHandlers(totalHistoryPages) {
  const prevBtn = document.getElementById('history-prev-btn');
  const nextBtn = document.getElementById('history-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (historyPage > 0) {
        historyPage--;
        render();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (historyPage < totalHistoryPages - 1) {
        historyPage++;
        render();
      }
    });
  }
}

function attachHistoryViewHandlers() {
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.onclick = () => {
      historyView = tab.dataset.view;
      updateHistoryView();
    };
  });
}


// ============================================================
// 5. Przełącznik ćwiczenia (pamięta ostatni wybór)
// ============================================================
const entryDateInput = document.getElementById('entry-date');
const datePickerWrap = document.getElementById('date-picker-wrap');
const toggleDateBtn = document.getElementById('toggle-date-btn');
const selectedDateLabel = document.getElementById('selected-date-label');
const customExerciseWrap = document.getElementById('custom-exercise-wrap');
const customExerciseInput = document.getElementById('custom-exercise-input');
const repsInput = document.getElementById('reps-input');
const repsMinusBtn = document.getElementById('reps-minus-btn');
const repsPlusBtn = document.getElementById('reps-plus-btn');
const segBtns = document.querySelectorAll('.seg-btn');
let selectedExercise = localStorage.getItem(LAST_EX_KEY) || 'Pompki';

function updateSelectedDateLabel() {
  const selectedDate = clampEntryDate(entryDateInput.value);
  entryDateInput.value = selectedDate;
  selectedDateLabel.textContent = selectedDate === todayKey()
    ? 'Data wpisu: dzisiaj'
    : `Data wpisu: ${formatDate(selectedDate)}`;
}

function updateSegmented() {
  const isCustomExercise = selectedExercise === 'Inne';
  customExerciseWrap.classList.toggle('hidden', !isCustomExercise);
  customExerciseInput.required = isCustomExercise;
  repsInput.required = !isCustomExercise;
  segBtns.forEach(b => {
    const isActive = b.dataset.ex === selectedExercise;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', isActive);
  });
}

function adjustReps(delta) {
  const currentValue = parseInt(repsInput.value, 10);
  const safeValue = Number.isNaN(currentValue) ? 0 : currentValue;
  repsInput.value = Math.max(0, safeValue + delta);
  repsInput.focus();
}

segBtns.forEach(b => {
  b.addEventListener('click', () => {
    selectedExercise = b.dataset.ex;
    localStorage.setItem(LAST_EX_KEY, selectedExercise);
    updateSegmented();
    if (selectedExercise === 'Inne') customExerciseInput.focus();
  });
});

toggleDateBtn.addEventListener('click', () => {
  datePickerWrap.classList.toggle('hidden');
});

entryDateInput.addEventListener('input', updateSelectedDateLabel);
repsMinusBtn.addEventListener('click', () => adjustReps(-5));
repsPlusBtn.addEventListener('click', () => adjustReps(5));


// ============================================================
// 6. Formularz — dodawanie nowych wpisów
// ============================================================
document.getElementById('exercise-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const entryDate = clampEntryDate(fd.get('entryDate'));
  const customExercise = (fd.get('customExercise') || '').trim();
  const reps = (fd.get('reps') || '').trim();
  const exerciseName = selectedExercise === 'Inne' ? customExercise : selectedExercise;
  if (!exerciseName || (selectedExercise !== 'Inne' && !reps)) return;

  const entry = {
    name: exerciseName,
    sets: '',
    reps: reps,
    weight: '',
    notes: '',
    time: new Date().toISOString()
  };

  const data = load();
  const day = entryDate;
  if (!data[day]) data[day] = [];
  data[day].push(entry);
  save(data);

  e.target.reset();
  entryDateInput.value = todayKey();
  entryDateInput.max = todayKey();
  updateSelectedDateLabel();
  if (selectedExercise !== 'Inne') customExerciseInput.value = '';
  updateSegmented();
  render();
  if (selectedExercise === 'Inne') customExerciseInput.focus();
  else repsInput.focus();
});


// ============================================================
// 7. Eksport danych do JSON (backup)
// ============================================================
document.getElementById('export-btn').addEventListener('click', () => {
  const data = load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trening-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});


// ============================================================
// 8. Import CSV
// ============================================================
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = (text.split(/\r?\n/)[0] || '');
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const delim = semis > commas ? ';' : ',';

  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i+1] === '\n') i++;
        row.push(cell);
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = []; cell = '';
      } else cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some(v => v.trim() !== '')) rows.push(row);
  }
  return rows;
}

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { alert('Plik wygląda na pusty.'); return; }

    const headers = rows[0].map(h => h.trim());
    const data = load();
    let added = 0, skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const day = parseDateDDMMYYYY(cells[0] || '');
      if (!day) { skipped++; continue; }
      if (!data[day]) data[day] = [];

      for (let j = 1; j < headers.length; j++) {
        const value = (cells[j] || '').trim();
        if (!value) continue;
        const header = headers[j];
        const isExtra = /dodatk/i.test(header);
        const entry = isExtra
          ? { name: value,  sets: '', reps: '',    weight: '', notes: 'z importu', time: new Date(day + 'T12:00:00').toISOString() }
          : { name: header, sets: '', reps: value, weight: '', notes: '',           time: new Date(day + 'T12:00:00').toISOString() };
        data[day].push(entry);
        added++;
      }
    }

    save(data);
    render();
    alert(`Zaimportowano ${added} ${added === 1 ? 'wpis' : 'wpisów'}.` +
          (skipped ? ` Pominięto ${skipped} wierszy z błędną datą.` : ''));
  } catch (err) {
    alert('Błąd importu: ' + err.message);
  } finally {
    e.target.value = '';
  }
});


// ============================================================
// 9. Inicjalizacja
// ============================================================
entryDateInput.value = todayKey();
entryDateInput.max = todayKey();
updateSelectedDateLabel();
updateSegmented();
render();
