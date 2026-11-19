(function () {
  const KEY = "slowka-b2c1-v1";          // postępy
  const CKEY = "slowka-b2c1-custom-v1";  // własne słówka
  const $ = (id) => document.getElementById(id);

  function read(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  let progress = read(KEY, {});   // { "słowo": "known" | "unknown" }
  let custom = read(CKEY, []);    // [[en, pl], ...]
  let queue = [], current = null, flipped = false, editing = -1;

  const allWords = () => WORDS.concat(custom);

  /* ---------- nauka ---------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue() {
    const mode = $("mode").value;
    queue = shuffle(allWords().filter((w) => {
      const s = progress[w[0]];
      if (mode === "unknown") return s === "unknown";
      if (mode === "todo") return s !== "known";
      return true;
    }));
    next();
  }

  function next() { current = queue.shift() || null; flipped = false; render(); }

  function renderStats() {
    const list = allWords();
    const known = list.filter((w) => progress[w[0]] === "known").length;
    const unknown = list.filter((w) => progress[w[0]] === "unknown").length;
    $("stats").textContent = "Znam: " + known + " · Nie znam: " + unknown + " · Nowe: " + (list.length - known - unknown);
  }

  function render() {
    renderStats();
    $("card").classList.toggle("back", flipped);
    $("yes").disabled = $("no").disabled = !current;
    if (!current) {
      $("lang").textContent = "";
      $("text").textContent = "Koniec talii";
      $("hint").textContent = "Zmień tryb powtarzania, dodaj słówka lub wyzeruj postępy.";
      return;
    }
    $("lang").textContent = flipped ? "polski" : "angielski";
    $("text").textContent = flipped ? current[1] : current[0];
    $("hint").textContent = flipped ? "" : "Kliknij, aby zobaczyć tłumaczenie";
  }

  function flip() { if (current) { flipped = !flipped; render(); } }

  function answer(isKnown) {
    if (!current) return;
    progress[current[0]] = isKnown ? "known" : "unknown";
    write(KEY, progress);
    if (!isKnown) queue.splice(Math.min(4, queue.length), 0, current);
    next();
  }

  /* ---------- własne słówka ---------- */
  function msg(t) { $("msg").textContent = t; }

  function isDup(en, except) {
    const k = en.trim().toLowerCase();
    return WORDS.some((w) => w[0].toLowerCase() === k) ||
      custom.some((w, i) => i !== except && w[0].toLowerCase() === k);
  }

  function resetForm() {
    editing = -1;
    $("en").value = $("pl").value = "";
    $("save").textContent = "Dodaj słówko";
    $("cancel").hidden = true;
  }

  function renderList() {
    $("count").textContent = "Moje słówka (" + custom.length + ")";
    const ul = $("list");
    ul.textContent = "";
    if (!custom.length) {
      const p = document.createElement("li");
      p.className = "empty";
      p.textContent = "Nie dodano jeszcze żadnych słówek. Dodaj pierwsze powyżej lub zaimportuj plik CSV.";
      ul.appendChild(p);
      return;
    }
    custom.forEach((w, i) => {
      const li = document.createElement("li");
      const box = document.createElement("div");
      box.className = "w";
      const b = document.createElement("b"); b.textContent = w[0];
      const s = document.createElement("span"); s.textContent = w[1];
      box.append(b, s);
      const ed = document.createElement("button");
      ed.className = "mini"; ed.textContent = "Edytuj";
      ed.onclick = () => {
        editing = i; $("en").value = w[0]; $("pl").value = w[1];
        $("save").textContent = "Zapisz zmiany"; $("cancel").hidden = false;
        $("en").focus(); msg("");
      };
      const del = document.createElement("button");
      del.className = "mini"; del.textContent = "Usuń";
      del.onclick = () => {
        if (!confirm("Usunąć słówko „" + w[0] + "”?")) return;
        delete progress[w[0]];
        custom.splice(i, 1);
        write(KEY, progress); write(CKEY, custom);
        if (editing === i) resetForm();
        renderList(); renderStats(); msg("Usunięto.");
      };
      li.append(box, ed, del);
      ul.appendChild(li);
    });
  }

  $("add").addEventListener("submit", (e) => {
    e.preventDefault();
    const en = $("en").value.trim(), pl = $("pl").value.trim();
    if (!en || !pl) return;
    if (isDup(en, editing)) { msg("Takie słówko już jest na liście."); return; }
    if (editing >= 0) {
      const old = custom[editing][0];
      if (old !== en) { delete progress[old]; write(KEY, progress); }
      custom[editing] = [en, pl];
      msg("Zapisano zmiany.");
    } else {
      custom.unshift([en, pl]);
      msg("Dodano: " + en);
    }
    write(CKEY, custom);
    resetForm(); renderList(); renderStats();
    $("en").focus();
  });
  $("cancel").onclick = () => { resetForm(); msg(""); };

  /* ---------- CSV i kopia zapasowa ---------- */
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csvField = (s) => /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;

  function parseLine(line, d) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  }

  function importCSV(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) { msg("Plik jest pusty."); return; }
    const d = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    let added = 0, skipped = 0;
    lines.forEach((line, i) => {
      const [en, pl] = parseLine(line, d);
      if (i === 0 && /^(angielski|english|en)$/i.test(en || "")) return;
      if (!en || !pl || isDup(en, -1)) { skipped++; return; }
      custom.push([en, pl]); added++;
    });
    write(CKEY, custom);
    renderList(); renderStats();
    msg("Zaimportowano: " + added + ". Pominięto (puste lub duplikaty): " + skipped + ".");
  }

  function importBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { msg("To nie jest poprawna kopia zapasowa."); return; }
    if (!data || typeof data.progress !== "object" || !Array.isArray(data.custom)) {
      msg("To nie jest poprawna kopia zapasowa."); return;
    }
    if (!confirm("Przywrócenie zastąpi obecne postępy i własne słówka. Kontynuować?")) return;
    progress = data.progress;
    custom = data.custom.filter((w) => Array.isArray(w) && w.length >= 2).map((w) => [String(w[0]), String(w[1])]);
    write(KEY, progress); write(CKEY, custom);
    resetForm(); renderList(); renderStats();
    msg("Przywrócono kopię zapasową.");
  }

  let onFile = null;
  function pick(accept, handler) { onFile = handler; $("file").accept = accept; $("file").value = ""; $("file").click(); }
  $("file").addEventListener("change", () => {
    const f = $("file").files[0];
    if (!f || !onFile) return;
    const r = new FileReader();
    r.onload = () => onFile(String(r.result));
    r.readAsText(f, "utf-8");
  });

  $("exp-csv").onclick = () => {
    if (!custom.length) { msg("Najpierw dodaj własne słówka."); return; }
    const rows = ["angielski;polski"].concat(custom.map((w) => csvField(w[0]) + ";" + csvField(w[1])));
    download("moje-slowka.csv", "\uFEFF" + rows.join("\r\n"), "text/csv;charset=utf-8");
  };
  $("imp-csv").onclick = () => pick(".csv,.txt,text/csv", importCSV);
  $("exp-bak").onclick = () => download("slowka-kopia.json", JSON.stringify({ progress, custom }), "application/json");
  $("imp-bak").onclick = () => pick(".json,application/json", importBackup);

  /* ---------- zakładki, klawisze, reset ---------- */
  function show(view) {
    $("view-learn").hidden = view !== "learn";
    $("view-words").hidden = view !== "words";
    $("tab-learn").classList.toggle("on", view === "learn");
    $("tab-words").classList.toggle("on", view === "words");
    if (view === "learn") buildQueue(); else { renderList(); msg(""); }
  }
  $("tab-learn").onclick = () => show("learn");
  $("tab-words").onclick = () => show("words");

  $("card").addEventListener("click", flip);
  $("yes").addEventListener("click", () => answer(true));
  $("no").addEventListener("click", () => answer(false));
  $("mode").addEventListener("change", buildQueue);
  $("reset").addEventListener("click", () => {
    if (confirm("Na pewno wyzerować cały postęp? Własne słówka zostaną.")) {
      progress = {}; write(KEY, progress);
      show($("view-learn").hidden ? "words" : "learn");
    }
  });

  document.addEventListener("keydown", (e) => {
    if ($("view-learn").hidden || /^(SELECT|INPUT)$/.test(e.target.tagName)) return;
    if (e.key === " ") { e.preventDefault(); flip(); }
    else if (e.key === "ArrowRight") answer(true);
    else if (e.key === "ArrowLeft") answer(false);
  });

  buildQueue();
})();
