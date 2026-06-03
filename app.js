const STORAGE_KEY = "clases-mama-v1";
const DAYS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const DEFAULT_RATE = 5000;
const DEFAULT_COMBOS = [
  { id: "combo-1", name: "Clase suelta", hours: 1, price: 5000 },
  { id: "combo-4", name: "Combo 4 horas", hours: 4, price: 19000 },
  { id: "combo-8", name: "Combo 8 horas", hours: 8, price: 36000 }
];
if (new URLSearchParams(window.location.search).get("reset") === "1") {
  localStorage.removeItem(STORAGE_KEY);
  window.history.replaceState({}, "", window.location.pathname);
}
const STATUS_META = {
  done: { label: "Vino", chip: "ok", event: "done", balance: true },
  missed: { label: "No vino", chip: "bad", event: "missed", balance: false },
  moved: { label: "Reprogramada", chip: "warn", event: "moved", balance: false }
};

const state = loadState();
let calendarCursor = new Date();
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  fillSelects();
  render();
  registerServiceWorker();
});

function cacheElements() {
  [
    "todayCount",
    "debtTotal",
    "monthTotal",
    "todayDate",
    "todayList",
    "studentList",
    "studentSearch",
    "scheduleList",
    "moneyList",
    "comboList",
    "managePanel",
    "calendarTitle",
    "calendarGrid",
    "prevMonth",
    "nextMonth",
    "toast",
    "studentModal",
    "scheduleModal",
    "classModal",
    "paymentModal",
    "comboModal",
    "studentForm",
    "scheduleForm",
    "classForm",
    "paymentForm",
    "comboForm",
    "exportButton",
    "resetButton"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { students: [], schedules: [], classes: [], payments: [], combos: DEFAULT_COMBOS };
  }

  try {
    const parsed = JSON.parse(raw);
    parsed.students ||= [];
    parsed.schedules ||= [];
    parsed.classes ||= [];
    parsed.payments ||= [];
    parsed.combos ||= DEFAULT_COMBOS;
    return parsed;
  } catch {
    return { students: [], schedules: [], classes: [], payments: [], combos: DEFAULT_COMBOS };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetAllData() {
  const ok = window.confirm("Vaciar alumnos, horarios, pagos y registros? Los combos base quedan disponibles.");
  if (!ok) return;
  state.students = [];
  state.schedules = [];
  state.classes = [];
  state.payments = [];
  state.combos = DEFAULT_COMBOS.map((combo) => ({ ...combo }));
  saveState();
  fillSelects();
  render();
  toast("Datos vaciados");
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.open));
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.jump));
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", closeModals);
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModals();
    });
  });

  els.studentSearch.addEventListener("input", renderStudents);
  els.exportButton.addEventListener("click", exportData);
  els.resetButton.addEventListener("click", resetAllData);
  els.studentForm.addEventListener("submit", saveStudent);
  els.scheduleForm.addEventListener("submit", saveSchedule);
  els.classForm.addEventListener("submit", saveClass);
  els.paymentForm.addEventListener("submit", savePayment);
  els.comboForm.addEventListener("submit", saveCombo);
  els.paymentForm.elements.comboId.addEventListener("change", applyComboToPayment);
  els.prevMonth.addEventListener("click", () => moveCalendar(-1));
  els.nextMonth.addEventListener("click", () => moveCalendar(1));
}

function setView(view) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.id === `view-${view}`);
  });
}

function openModal(type, payload = {}) {
  closeModals();
  fillSelects();

  if (type === "student") {
    els.studentForm.reset();
    if (payload.studentId) {
      const student = findStudent(payload.studentId);
      els.studentForm.elements.id.value = student.id;
      els.studentForm.elements.name.value = student.name;
      els.studentForm.elements.rate.value = student.rate || DEFAULT_RATE;
      els.studentForm.elements.notes.value = student.notes || "";
    } else {
      els.studentForm.elements.rate.value = DEFAULT_RATE;
    }
    showModal(els.studentModal);
  }

  if (type === "schedule") {
    els.scheduleForm.reset();
    els.scheduleForm.elements.day.value = new Date().getDay();
    els.scheduleForm.elements.duration.value = 1;
    if (payload.studentId) els.scheduleForm.elements.studentId.value = payload.studentId;
    showModal(els.scheduleModal);
  }

  if (type === "class") {
    els.classForm.reset();
    els.classForm.elements.date.value = payload.date || todayISO();
    els.classForm.elements.hours.value = payload.hours || 1;
    els.classForm.elements.status.value = payload.status || "done";
    if (payload.movedDate) els.classForm.elements.movedDate.value = payload.movedDate;
    if (payload.movedTime) els.classForm.elements.movedTime.value = payload.movedTime;
    if (payload.studentId) els.classForm.elements.studentId.value = payload.studentId;
    showModal(els.classModal);
  }

  if (type === "payment") {
    els.paymentForm.reset();
    els.paymentForm.elements.date.value = todayISO();
    els.paymentForm.elements.hours.value = 1;
    els.paymentForm.elements.amount.value = DEFAULT_RATE;
    els.paymentForm.elements.comboId.value = "combo-1";
    if (payload.studentId) els.paymentForm.elements.studentId.value = payload.studentId;
    showModal(els.paymentModal);
  }

  if (type === "combo") {
    els.comboForm.reset();
    if (payload.comboId) {
      const combo = state.combos.find((item) => item.id === payload.comboId);
      if (combo) {
        els.comboForm.elements.id.value = combo.id;
        els.comboForm.elements.name.value = combo.name;
        els.comboForm.elements.hours.value = combo.hours;
        els.comboForm.elements.price.value = combo.price;
      }
    }
    showModal(els.comboModal);
  }
}

function showModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
}

function fillSelects() {
  const studentOptions = state.students
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((student) => `<option value="${student.id}">${escapeHTML(student.name)}</option>`)
    .join("");

  document.querySelectorAll('select[name="studentId"]').forEach((select) => {
    select.innerHTML = studentOptions || '<option value="">Primero carga un alumno</option>';
  });

  const comboOptions = [
    '<option value="">Personalizado</option>',
    ...state.combos
      .sort((a, b) => a.hours - b.hours)
      .map((combo) => `<option value="${combo.id}">${escapeHTML(combo.name)} - ${formatHours(combo.hours)} - ${money(combo.price)}</option>`)
  ].join("");

  document.querySelectorAll('select[name="comboId"]').forEach((select) => {
    select.innerHTML = comboOptions;
  });

  const dayOptions = DAYS.map((day, index) => `<option value="${index}">${day}</option>`).join("");
  document.querySelectorAll('select[name="day"]').forEach((select) => {
    select.innerHTML = dayOptions;
  });
}

function saveStudent(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get("id") || crypto.randomUUID();
  const student = {
    id,
    name: clean(form.get("name")),
    rate: Number(form.get("rate")) || DEFAULT_RATE,
    notes: clean(form.get("notes"))
  };

  const index = state.students.findIndex((item) => item.id === id);
  if (index >= 0) state.students[index] = student;
  else state.students.push(student);

  saveState();
  closeModals();
  fillSelects();
  render();
  toast("Alumno guardado");
}

function saveSchedule(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.schedules.push({
    id: crypto.randomUUID(),
    studentId: form.get("studentId"),
    day: Number(form.get("day")),
    time: form.get("time"),
    duration: Number(form.get("duration")) || 1
  });
  saveState();
  closeModals();
  render();
  toast("Horario guardado");
}

function saveClass(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.classes.push({
    id: crypto.randomUUID(),
    studentId: form.get("studentId"),
    date: form.get("date"),
    hours: Number(form.get("hours")) || 1,
    status: form.get("status"),
    movedDate: form.get("movedDate") || "",
    movedTime: form.get("movedTime") || "",
    notes: clean(form.get("notes"))
  });
  saveState();
  closeModals();
  render();
  toast("Clase registrada");
}

function savePayment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.payments.push({
    id: crypto.randomUUID(),
    studentId: form.get("studentId"),
    date: form.get("date"),
    hours: Number(form.get("hours")) || 0,
    amount: Number(form.get("amount")) || 0,
    method: form.get("method"),
    notes: clean(form.get("notes"))
  });
  saveState();
  closeModals();
  render();
  toast("Pago guardado");
}

function saveCombo(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get("id") || crypto.randomUUID();
  const combo = {
    id,
    name: clean(form.get("name")),
    hours: Number(form.get("hours")) || 1,
    price: Number(form.get("price")) || 0
  };
  const index = state.combos.findIndex((item) => item.id === id);
  if (index >= 0) state.combos[index] = combo;
  else state.combos.push(combo);
  saveState();
  closeModals();
  fillSelects();
  render();
  toast("Combo guardado");
}

function applyComboToPayment() {
  const combo = state.combos.find((item) => item.id === els.paymentForm.elements.comboId.value);
  if (!combo) return;
  els.paymentForm.elements.hours.value = combo.hours;
  els.paymentForm.elements.amount.value = combo.price;
}

function render() {
  renderSummary();
  renderToday();
  renderStudents();
  renderSchedule();
  renderCalendar();
  renderCombos();
  renderMoney();
  renderManage();
}

function renderSummary() {
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const todaySchedules = state.schedules.filter((item) => item.day === new Date().getDay()).length;
  const todayClasses = state.classes.filter((item) => item.date === today).length;
  const monthTotal = state.payments
    .filter((payment) => payment.date.slice(0, 7) === currentMonth)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const debtTotal = state.students.reduce((sum, student) => {
    const balance = getStudentBalance(student.id);
    return sum + Math.max(0, -balance * getStudentRate(student.id));
  }, 0);

  els.todayCount.textContent = todaySchedules + todayClasses;
  els.debtTotal.textContent = money(debtTotal);
  els.monthTotal.textContent = money(monthTotal);
  els.todayDate.textContent = formatLongDate(today);
}

function renderToday() {
  const day = new Date().getDay();
  const today = todayISO();
  const schedules = state.schedules
    .filter((item) => item.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));
  const classes = state.classes
    .filter((item) => item.date === today)
    .sort((a, b) => findStudent(a.studentId).name.localeCompare(findStudent(b.studentId).name));

  const scheduleHTML = schedules.map((item) => {
    const student = findStudent(item.studentId);
    const balance = getStudentBalance(item.studentId);
    const projected = roundHalf(balance - item.duration);
    const existing = state.classes.find((record) => record.date === today && record.studentId === item.studentId);
    const balanceClass = balance <= 0 ? "bad" : balance <= 1 ? "warn" : "ok";
    return `
      <article class="card">
        <div class="card-head">
          <div class="card-title">
            <strong>${escapeHTML(student.name)}</strong>
            <span class="meta">${item.time} - ${item.duration} h</span>
          </div>
          <span class="chip ${balanceClass}">${formatHours(balance)}</span>
        </div>
        <div class="chip-row">
          ${balance <= 0 ? `<span class="chip bad">Sin horas disponibles</span>` : `<span class="chip ${projected <= 0 ? "warn" : "ok"}">Si viene quedan ${formatHours(projected)}</span>`}
          ${existing ? `<span class="chip ${STATUS_META[existing.status]?.chip || ""}">Registrado: ${statusText(existing.status)}</span>` : ""}
          ${existing && !STATUS_META[existing.status]?.balance ? `<span class="chip ok">No descuenta horas</span>` : ""}
          ${existing?.movedDate ? `<span class="chip warn">Movida a ${formatShortDate(existing.movedDate)}${existing.movedTime ? ` ${existing.movedTime}` : ""}</span>` : ""}
        </div>
        <p class="hint">Este es el horario habitual de hoy. Marca asistencia solo cuando sepas que paso con esta clase.</p>
        <div class="card-actions">
          <button type="button" data-quick-class="${item.studentId}" data-hours="${item.duration}">Vino</button>
          <button type="button" data-quick-status="missed" data-student="${item.studentId}" data-hours="${item.duration}">No vino</button>
          <button type="button" data-quick-status="moved" data-student="${item.studentId}" data-hours="${item.duration}">Reprogramada</button>
          <button type="button" data-open-move="${item.studentId}" data-hours="${item.duration}">Cambiar dia/hora</button>
          <button type="button" data-open-payment="${item.studentId}">Pago</button>
        </div>
      </article>
    `;
  }).join("");

  const classHTML = classes.map((item) => {
    const student = findStudent(item.studentId);
    return `
      <article class="card">
        <div class="card-head">
          <div class="card-title">
            <strong>${escapeHTML(student.name)}</strong>
            <span class="meta">${statusText(item.status)} - ${formatHours(item.hours)} registradas</span>
          </div>
          <span class="chip ${STATUS_META[item.status]?.chip || ""}">${statusText(item.status)}</span>
        </div>
        <div class="chip-row">
          ${STATUS_META[item.status]?.balance ? `<span class="chip warn">Descuenta ${formatHours(item.hours)}</span>` : `<span class="chip ok">No descuenta horas</span>`}
          ${item.movedDate ? `<span class="chip warn">Movida a ${formatShortDate(item.movedDate)}${item.movedTime ? ` ${item.movedTime}` : ""}</span>` : ""}
        </div>
        ${item.notes ? `<p class="meta">${escapeHTML(item.notes)}</p>` : ""}
        <p class="hint">Este es un registro real de asistencia. Sirve para saber que paso ese dia y calcular horas.</p>
        <div class="card-actions">
          <button class="danger-button" type="button" data-delete-class="${item.id}">Borrar registro</button>
        </div>
      </article>
    `;
  }).join("");

  els.todayList.innerHTML = scheduleHTML + classHTML || empty("No hay clases para hoy. Carga horarios fijos en Agenda o registra una clase suelta desde el boton superior.");
  bindDynamicActions(els.todayList);
}

function renderStudents() {
  const query = clean(els.studentSearch.value).toLowerCase();
  const students = state.students
    .filter((student) => `${student.name} ${student.notes}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  els.studentList.innerHTML = students.map((student) => {
    const balance = getStudentBalance(student.id);
    const debt = Math.max(0, -balance * getStudentRate(student.id));
    const lastClass = state.classes
      .filter((item) => item.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const studentSchedules = getStudentSchedules(student.id);
    const recentRecords = getStudentRecords(student.id).slice(0, 5);

    return `
      <article class="card">
        <div class="card-head">
          <div class="card-title">
            <strong>${escapeHTML(student.name)}</strong>
            <span class="meta">${student.notes ? escapeHTML(student.notes) : "Sin notas"}</span>
          </div>
          <span class="chip ${balance < 0 ? "bad" : balance <= 1 ? "warn" : "ok"}">${formatHours(balance)}</span>
        </div>
        <div class="chip-row">
          <span class="chip">Hora ${money(getStudentRate(student.id))}</span>
          <span class="chip ${debt ? "bad" : "ok"}">${debt ? `Debe ${money(debt)}` : "Al dia"}</span>
          <span class="chip ${balance <= 0 ? "bad" : balance <= 1 ? "warn" : "ok"}">${balance <= 0 ? "Necesita cargar horas" : `Le quedan ${formatHours(balance)}`}</span>
          <span class="chip">${lastClass ? `Ultima ${formatShortDate(lastClass.date)}` : "Sin clases"}</span>
        </div>
        <div class="chip-row">
          ${studentSchedules.length ? studentSchedules.map((item) => `<span class="chip">${DAYS[item.day]} ${item.time} - ${formatHours(item.duration)}</span>`).join("") : '<span class="chip warn">Sin horario fijo</span>'}
        </div>
        ${student.notes ? `<p class="meta">${escapeHTML(student.notes)}</p>` : ""}
        <p class="hint">Esta ficha resume al alumno: saldo de horas, horarios habituales y ultimos movimientos.</p>
        ${recentRecords.length ? `
          <div class="mini-history">
            <strong>Ultimos registros</strong>
            ${recentRecords.map((record) => `
              <div class="mini-history-row">
                <span>${formatShortDate(record.date)} - ${statusText(record.status)} - ${STATUS_META[record.status]?.balance ? formatHours(record.hours) : "no descuenta"}${record.movedDate ? ` - movida a ${formatShortDate(record.movedDate)}${record.movedTime ? ` ${record.movedTime}` : ""}` : ""}</span>
                <button class="danger-button" type="button" data-delete-class="${record.id}">Borrar</button>
              </div>
            `).join("")}
          </div>
        ` : ""}
        <div class="card-actions">
          <button type="button" data-open-class="${student.id}">Clase</button>
          <button type="button" data-open-payment="${student.id}">Pago</button>
          <button type="button" data-open-schedule="${student.id}">Horario</button>
          <button type="button" data-edit-student="${student.id}">Editar</button>
          <button class="danger-button" type="button" data-delete-student="${student.id}">Eliminar</button>
        </div>
      </article>
    `;
  }).join("") || empty("Todavia no hay alumnos cargados. Empieza con Nuevo alumno, despues agrega horarios y pagos.");

  bindDynamicActions(els.studentList);
}

function renderSchedule() {
  els.scheduleList.innerHTML = DAYS.map((day, index) => {
    const items = state.schedules
      .filter((item) => item.day === index)
      .sort((a, b) => a.time.localeCompare(b.time));

    return `
      <section class="day-block">
        <h3>${day}</h3>
        <div class="stack">
          ${items.map((item) => {
            const student = findStudent(item.studentId);
            return `
              <div class="schedule-item">
                <div>
                  <strong>${escapeHTML(student.name)}</strong>
                  <div class="meta">${item.time} - ${item.duration} h</div>
                  <div class="hint">Horario fijo semanal. Si cambia solo una clase, usa Reprogramada desde Hoy.</div>
                </div>
                <button class="danger-button" type="button" data-delete-schedule="${item.id}">Borrar</button>
              </div>
            `;
          }).join("") || `<p class="empty">Sin horarios. Agrega el dia y hora habitual de cada alumno.</p>`}
        </div>
      </section>
    `;
  }).join("");
  bindDynamicActions(els.scheduleList);
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  const today = todayISO();
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(firstDay);
  els.calendarTitle.textContent = monthLabel;

  const weekdayHTML = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");

  const daysHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = toISO(date);
    const isCurrentMonth = date.getMonth() === month;
    const recurring = state.schedules
      .filter((item) => item.day === date.getDay())
      .map((item) => ({ type: "fixed", label: `${item.time} ${findStudent(item.studentId).name}` }));
    const registered = state.classes
      .filter((item) => item.date === iso)
      .map((item) => ({ type: STATUS_META[item.status]?.event || "done", label: `${statusText(item.status)} ${findStudent(item.studentId).name}` }));
    const movedHere = state.classes
      .filter((item) => item.movedDate === iso)
      .map((item) => ({ type: "moved", label: `${item.movedTime || ""} ${findStudent(item.studentId).name}`.trim() }));
    const events = [...recurring, ...registered, ...movedHere].slice(0, 3);

    return `
      <div class="calendar-day ${isCurrentMonth ? "" : "is-muted"} ${iso === today ? "is-today" : ""}">
        <span class="calendar-number">${date.getDate()}</span>
        ${events.map((event) => `<span class="calendar-event ${event.type}">${escapeHTML(event.label)}</span>`).join("")}
      </div>
    `;
  }).join("");

  els.calendarGrid.innerHTML = weekdayHTML + daysHTML;
}

function renderCombos() {
  els.comboList.innerHTML = state.combos
    .sort((a, b) => a.hours - b.hours)
    .map((combo) => `
      <article class="combo-card">
        <strong>${escapeHTML(combo.name)}</strong>
        <span class="meta">${formatHours(combo.hours)} - ${money(combo.price)}</span>
        <small>Al elegirlo en un pago completa horas y precio automaticamente.</small>
        <button type="button" data-edit-combo="${combo.id}">Editar</button>
        <button class="danger-button" type="button" data-delete-combo="${combo.id}">Borrar</button>
      </article>
    `).join("");
  bindDynamicActions(els.comboList);
}

function renderMoney() {
  const debts = state.students
    .map((student) => {
      const balance = getStudentBalance(student.id);
      const debt = Math.max(0, -balance * getStudentRate(student.id));
      return { student, balance, debt };
    })
    .filter((item) => item.debt > 0 || item.balance <= 1)
    .sort((a, b) => b.debt - a.debt);

  const recentPayments = state.payments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const debtsHTML = debts.map(({ student, balance, debt }) => `
    <article class="card">
      <div class="card-head">
        <div class="card-title">
          <strong>${escapeHTML(student.name)}</strong>
          <span class="meta">${balance < 0 ? "Horas pasadas de paquete" : "Quedan pocas horas"}</span>
        </div>
        <span class="chip ${debt ? "bad" : "warn"}">${debt ? money(debt) : formatHours(balance)}</span>
      </div>
      <div class="card-actions">
        <button type="button" data-open-payment="${student.id}">Cargar pago</button>
      </div>
      <p class="hint">Avisa cuando quedan pocas horas o cuando ya esta usando clases por encima de lo pago.</p>
    </article>
  `).join("");

  const paymentsHTML = recentPayments.map((payment) => {
    const student = findStudent(payment.studentId);
    return `
      <article class="card">
        <div class="card-head">
          <div class="card-title">
            <strong>${escapeHTML(student.name)}</strong>
            <span class="meta">${formatShortDate(payment.date)} - ${methodText(payment.method)}</span>
          </div>
          <span class="chip ok">${money(payment.amount)}</span>
        </div>
        <div class="chip-row">
          <span class="chip">${formatHours(payment.hours)} cargadas</span>
          ${payment.notes ? `<span class="chip">${escapeHTML(payment.notes)}</span>` : ""}
        </div>
        <p class="hint">Este pago suma horas disponibles al alumno. Borrarlo resta esas horas del saldo.</p>
        <div class="card-actions">
          <button class="danger-button" type="button" data-delete-payment="${payment.id}">Borrar pago</button>
        </div>
      </article>
    `;
  }).join("");

  els.moneyList.innerHTML = `
    ${debtsHTML || empty("No hay alertas. Cuando un alumno tenga pocas horas o deba, aparece aca.")}
    <h2 style="margin: 8px 0 0;">Pagos recientes</h2>
    ${paymentsHTML || empty("Todavia no hay pagos cargados. Usa Pago / paquete para sumar horas.")}
  `;
  bindDynamicActions(els.moneyList);
}

function renderManage() {
  const studentsHTML = state.students
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((student) => `
      <div class="manage-row">
        <div>
          <strong>${escapeHTML(student.name)}</strong>
          <span>${formatHours(getStudentBalance(student.id))} disponibles - Hora ${money(getStudentRate(student.id))}</span>
        </div>
        <div class="row-actions">
          <button type="button" data-edit-student="${student.id}">Editar</button>
          <button class="danger-button" type="button" data-delete-student="${student.id}">Eliminar</button>
        </div>
      </div>
    `).join("") || empty("Sin alumnos. Carga el primero desde Nuevo alumno.");

  const schedulesHTML = state.schedules
    .slice()
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .map((item) => `
      <div class="manage-row">
        <div>
          <strong>${escapeHTML(findStudent(item.studentId).name)}</strong>
          <span>${DAYS[item.day]} ${item.time} - ${formatHours(item.duration)}</span>
        </div>
        <div class="row-actions">
          <button class="danger-button" type="button" data-delete-schedule="${item.id}">Eliminar</button>
        </div>
      </div>
    `).join("") || empty("Sin horarios fijos.");

  const recordsHTML = state.classes
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((record) => `
      <div class="manage-row">
        <div>
          <strong>${escapeHTML(findStudent(record.studentId).name)}</strong>
          <span>${formatShortDate(record.date)} - ${statusText(record.status)} - ${STATUS_META[record.status]?.balance ? formatHours(record.hours) : "no descuenta"}${record.movedDate ? ` - movida a ${formatShortDate(record.movedDate)}` : ""}</span>
        </div>
        <div class="row-actions">
          <button class="danger-button" type="button" data-delete-class="${record.id}">Eliminar</button>
        </div>
      </div>
    `).join("") || empty("Sin registros de asistencia.");

  const paymentsHTML = state.payments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((payment) => `
      <div class="manage-row">
        <div>
          <strong>${escapeHTML(findStudent(payment.studentId).name)}</strong>
          <span>${formatShortDate(payment.date)} - ${money(payment.amount)} - ${formatHours(payment.hours)}</span>
        </div>
        <div class="row-actions">
          <button class="danger-button" type="button" data-delete-payment="${payment.id}">Eliminar</button>
        </div>
      </div>
    `).join("") || empty("Sin pagos cargados.");

  const combosHTML = state.combos
    .slice()
    .sort((a, b) => a.hours - b.hours)
    .map((combo) => `
      <div class="manage-row">
        <div>
          <strong>${escapeHTML(combo.name)}</strong>
          <span>${formatHours(combo.hours)} - ${money(combo.price)}</span>
        </div>
        <div class="row-actions">
          <button type="button" data-edit-combo="${combo.id}">Editar</button>
          <button class="danger-button" type="button" data-delete-combo="${combo.id}">Eliminar</button>
        </div>
      </div>
    `).join("") || empty("Sin combos.");

  els.managePanel.innerHTML = `
    ${manageSection("Alumnos", "Editar datos del alumno o eliminarlo junto con sus pagos, horarios y registros.", studentsHTML)}
    ${manageSection("Horarios", "Horarios habituales de la semana.", schedulesHTML)}
    ${manageSection("Registros", "Asistencias reales: vino, no vino o reprogramada.", recordsHTML)}
    ${manageSection("Pagos", "Pagos y paquetes cargados.", paymentsHTML)}
    ${manageSection("Combos", "Paquetes de horas disponibles para cargar pagos rapido.", combosHTML)}
  `;
  bindDynamicActions(els.managePanel);
}

function manageSection(title, helper, content) {
  return `
    <section class="manage-section">
      <div class="manage-head">
        <div>
          <h3>${title}</h3>
          <p>${helper}</p>
        </div>
      </div>
      <div class="manage-list">${content}</div>
    </section>
  `;
}

function bindDynamicActions(root) {
  root.querySelectorAll("[data-quick-class]").forEach((button) => {
    button.addEventListener("click", () => {
      upsertTodayRecord(button.dataset.quickClass, "done", Number(button.dataset.hours) || 1);
      saveState();
      render();
      toast("Asistencia registrada: vino");
    });
  });

  root.querySelectorAll("[data-quick-status]").forEach((button) => {
    button.addEventListener("click", () => {
      upsertTodayRecord(button.dataset.student, button.dataset.quickStatus, Number(button.dataset.hours) || 1);
      saveState();
      render();
      toast(`Asistencia registrada: ${statusText(button.dataset.quickStatus).toLowerCase()}`);
    });
  });

  root.querySelectorAll("[data-open-class]").forEach((button) => {
    button.addEventListener("click", () => openModal("class", { studentId: button.dataset.openClass }));
  });

  root.querySelectorAll("[data-open-payment]").forEach((button) => {
    button.addEventListener("click", () => openModal("payment", { studentId: button.dataset.openPayment }));
  });

  root.querySelectorAll("[data-open-schedule]").forEach((button) => {
    button.addEventListener("click", () => openModal("schedule", { studentId: button.dataset.openSchedule }));
  });

  root.querySelectorAll("[data-open-move]").forEach((button) => {
    button.addEventListener("click", () => openModal("class", {
      studentId: button.dataset.openMove,
      hours: Number(button.dataset.hours) || 1,
      status: "moved"
    }));
  });

  root.querySelectorAll("[data-edit-student]").forEach((button) => {
    button.addEventListener("click", () => openModal("student", { studentId: button.dataset.editStudent }));
  });

  root.querySelectorAll("[data-edit-combo]").forEach((button) => {
    button.addEventListener("click", () => openModal("combo", { comboId: button.dataset.editCombo }));
  });

  root.querySelectorAll("[data-delete-schedule]").forEach((button) => {
    button.addEventListener("click", () => {
      state.schedules = state.schedules.filter((item) => item.id !== button.dataset.deleteSchedule);
      saveState();
      render();
      toast("Horario eliminado");
    });
  });

  root.querySelectorAll("[data-delete-combo]").forEach((button) => {
    button.addEventListener("click", () => {
      state.combos = state.combos.filter((item) => item.id !== button.dataset.deleteCombo);
      saveState();
      fillSelects();
      render();
      toast("Combo eliminado");
    });
  });

  root.querySelectorAll("[data-delete-class]").forEach((button) => {
    button.addEventListener("click", () => {
      state.classes = state.classes.filter((item) => item.id !== button.dataset.deleteClass);
      saveState();
      render();
      toast("Registro eliminado");
    });
  });

  root.querySelectorAll("[data-delete-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.payments = state.payments.filter((item) => item.id !== button.dataset.deletePayment);
      saveState();
      render();
      toast("Pago eliminado");
    });
  });

  root.querySelectorAll("[data-delete-student]").forEach((button) => {
    button.addEventListener("click", () => {
      const student = findStudent(button.dataset.deleteStudent);
      const ok = window.confirm(`Eliminar a ${student.name} tambien borra sus horarios, pagos y registros. Esta accion no se puede deshacer.`);
      if (!ok) return;
      state.students = state.students.filter((item) => item.id !== button.dataset.deleteStudent);
      state.schedules = state.schedules.filter((item) => item.studentId !== button.dataset.deleteStudent);
      state.classes = state.classes.filter((item) => item.studentId !== button.dataset.deleteStudent);
      state.payments = state.payments.filter((item) => item.studentId !== button.dataset.deleteStudent);
      saveState();
      fillSelects();
      render();
      toast("Alumno eliminado");
    });
  });
}

function upsertTodayRecord(studentId, status, hours) {
  const existing = state.classes.find((record) => record.date === todayISO() && record.studentId === studentId);
  const payload = {
    studentId,
    date: todayISO(),
    hours,
    status,
    movedDate: "",
    movedTime: "",
    notes: ""
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.classes.push({ id: crypto.randomUUID(), ...payload });
  }
}

function getStudentSchedules(studentId) {
  return state.schedules
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

function getStudentRecords(studentId) {
  return state.classes
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function findStudent(id) {
  return state.students.find((student) => student.id === id) || {
    id,
    name: "Alumno eliminado",
    rate: DEFAULT_RATE,
    notes: ""
  };
}

function getStudentRate(studentId) {
  return Number(findStudent(studentId).rate) || DEFAULT_RATE;
}

function getStudentBalance(studentId) {
  const paidHours = state.payments
    .filter((payment) => payment.studentId === studentId)
    .reduce((sum, payment) => sum + Number(payment.hours || 0), 0);
  const usedHours = state.classes
    .filter((item) => item.studentId === studentId && STATUS_META[item.status]?.balance)
    .reduce((sum, item) => sum + Number(item.hours || 0), 0);
  return roundHalf(paidHours - usedHours);
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clases-mama-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Datos exportados");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function toISO(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function moveCalendar(direction) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + direction, 1);
  renderCalendar();
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(parseISODate(value));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parseISODate(value));
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatHours(value) {
  const rounded = roundHalf(value);
  return `${rounded} h`;
}

function methodText(value) {
  return value === "cash" ? "Efectivo" : "Transferencia";
}

function statusText(value) {
  return STATUS_META[value]?.label || "Vino";
}

function roundHalf(value) {
  return Math.round((Number(value) || 0) * 2) / 2;
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHTML(value) {
  return clean(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function empty(text) {
  return `<p class="empty">${escapeHTML(text)}</p>`;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}
