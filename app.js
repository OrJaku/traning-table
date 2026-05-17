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

function parseDateDDMMYYYY(s) {
  const m = String(s).trim().match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = d.padStart(2,'0'), mm = mo.padStart(2,'0');
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
  return `${y}-${mm}-${dd}`;
}


// ============================================================
// 3. Renderowanie wpisów i widoku
// ============================================================
let editingKey = null; // format: "day:idx" — który wpis jest aktualnie edytowany

const entryHTML = (e, day, idx) => {
  const isToday = day === todayKey();
  const isEditing = editingKey === `${day}:${idx}`;

  if (isEditing) {
    return `
      <div class="entry editing">
        <div class="entry-name">${escapeHtml(e.name)}</div>
        <input class="edit-input" type="text" inputmode="numeric"
               value="${escapeHtml(e.reps)}" data-day="${day}" data-idx="${idx}"
               aria-label="Liczba powtórzeń">
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

  // Historia (poprzednie dni, rozwijane)
  const otherDays = Object.keys(data)
    .filter(day => day < today)
    .sort()
    .reverse();
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = otherDays.length === 0
    ? '<div class="empty">Brak wcześniejszych wpisów.</div>'
    : otherDays.map(day => {
        const entries = data[day];
        return `
          <div class="day-group">
            <div class="day-header" data-day="${day}">
              <span class="day-header-date">${formatDate(day)}</span>
              <span class="count">${entries.length} ${pluralize(entries.length)}</span>
            </div>
            <div class="day-content" data-day-content="${day}">
              <div style="height:8px"></div>
              ${entries.map((e, i) => entryHTML(e, day, i)).join('')}
            </div>
          </div>
        `;
      }).join('');

  attachEntryEventHandlers();
}


// ============================================================
// 4. Event handlery dla wpisów (delete, edit, save, cancel)
// ============================================================
function attachEntryEventHandlers() {
  // Usuń wpis
  document.querySelectorAll('.entry-action.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day, idx = parseInt(btn.dataset.idx);
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

  // Rozwijanie dni w historii
  document.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => {
      const day = h.dataset.day;
      document.querySelector(`[data-day-content="${day}"]`).classList.toggle('open');
    });
  });
}


// ============================================================
// 5. Przełącznik ćwiczenia (pamięta ostatni wybór)
// ============================================================
const customExerciseInput = document.querySelector('[name="customExercise"]');
const segBtns = document.querySelectorAll('.seg-btn');
let selectedExercise = localStorage.getItem(LAST_EX_KEY) || 'Pompki';

function updateSegmented() {
  const hasCustomExercise = customExerciseInput.value.trim() !== '';
  segBtns.forEach(b => {
    const isActive = !hasCustomExercise && b.dataset.ex === selectedExercise;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', isActive);
  });
}

segBtns.forEach(b => {
  b.addEventListener('click', () => {
    selectedExercise = b.dataset.ex;
    localStorage.setItem(LAST_EX_KEY, selectedExercise);
    customExerciseInput.value = '';
    updateSegmented();
  });
});

customExerciseInput.addEventListener('input', updateSegmented);


// ============================================================
// 6. Formularz — dodawanie nowych wpisów
// ============================================================
document.getElementById('exercise-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const customExercise = (fd.get('customExercise') || '').trim();
  const reps = (fd.get('reps') || '').trim();
  const exerciseName = customExercise || selectedExercise;
  if (!reps || !exerciseName) return;

  const entry = {
    name: exerciseName,
    sets: '',
    reps: reps,
    weight: '',
    notes: '',
    time: new Date().toISOString()
  };

  const data = load();
  const day = todayKey();
  if (!data[day]) data[day] = [];
  data[day].push(entry);
  save(data);

  e.target.reset();
  updateSegmented();
  render();
  document.querySelector('[name="reps"]').focus();
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
updateSegmented();
render();
