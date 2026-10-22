"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChefHat,
  ChevronDown,
  Clock3,
  Copy,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Trash2,
  Users,
  Utensils,
  WheatOff,
  X,
} from "lucide-react";
import { DAYS, type Day, type Plan, type Recipe } from "@/lib/types";
import {
  formatAmount,
  recipeScale,
  readStoredPlan,
  shoppingList,
  STORAGE_KEY,
} from "@/lib/planner";

function RecipeArt({
  recipe,
  small = false,
}: {
  recipe: Recipe;
  small?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`recipe-art ${recipe.color} ${small ? "small" : ""}`}
    >
      <span className="art-orbit" />
      <span className="art-plate">{recipe.emoji}</span>
      <span className="art-herb">✦</span>
      <span className="art-dot" />
    </div>
  );
}
function weekDates() {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  return DAYS.map((_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}
function weekNumber(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(
    ((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
}

export default function Planner({ recipes }: { recipes: Recipe[] }) {
  const [plan, setPlan] = useState<Plan>({});
  const [servings, setServings] = useState(2);
  const [checked, setChecked] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [activeDay, setActiveDay] = useState<Day | null>(null);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [dates, setDates] = useState<Date[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    // Hydrate browser-only persisted data after the server-rendered first paint.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored = readStoredPlan(localStorage.getItem(STORAGE_KEY), recipes);
      if (stored) {
        setPlan(stored.plan);
        setServings(stored.servings);
        setChecked(stored.checked);
      }
    } catch {
      setStorageError(true);
    }
    setDates(weekDates());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [recipes]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ plan, servings, checked }),
      );
    } catch {
      // Surface storage failures from the browser API to the user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(true);
    }
  }, [plan, servings, checked, ready]);
  const modalOpen = Boolean(activeDay || library || detail || confirmClear);
  useEffect(() => {
    if (modalOpen) dialog.current?.showModal();
    else dialog.current?.close();
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const items = useMemo(
    () => shoppingList(plan, recipes, servings),
    [plan, recipes, servings],
  );
  const groups = [...new Set(items.map((item) => item.category))];
  const planned = DAYS.filter((day) =>
    recipes.some((recipe) => recipe.id === plan[day]),
  ).length;
  const completed = items.filter((item) => checked.includes(item.key)).length;
  const categories = [
    "Alle",
    ...new Set(recipes.map((recipe) => recipe.category)),
  ];
  const filtered = recipes.filter(
    (recipe) =>
      (category === "Alle" || recipe.category === category) &&
      `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(" ")}`
        .toLocaleLowerCase("nb")
        .includes(query.toLocaleLowerCase("nb")),
  );
  const isExample = recipes.some((recipe) => !recipe.source.url);
  const matpratCount = recipes.filter(
    (recipe) => recipe.source.name === "Matprat",
  ).length;
  const featured = [...recipes]
    .sort(
      (a, b) => Number(Boolean(b.source.url)) - Number(Boolean(a.source.url)),
    )
    .slice(0, 4);
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };
  const close = () => {
    setActiveDay(null);
    setLibrary(false);
    setDetail(null);
    setConfirmClear(false);
    setQuery("");
    setCategory("Alle");
  };
  const openPicker = (day: Day) => {
    setActiveDay(day);
    setQuery("");
    setCategory("Alle");
  };
  const select = (recipe: Recipe) => {
    if (!activeDay) {
      setDetail(recipe);
      return;
    }
    setPlan((current) => ({ ...current, [activeDay]: recipe.id }));
    setChecked([]);
    notify(`${recipe.title} er lagt til på ${activeDay.toLowerCase()}.`);
    close();
  };
  const fillWeek = () => {
    const pool = [...recipes].sort(() => Math.random() - 0.5);
    if (!pool.length) return;
    const next = { ...plan };
    let i = 0;
    for (const day of DAYS)
      if (!next[day]) next[day] = pool[i++ % pool.length].id;
    setPlan(next);
    setChecked([]);
    notify("De ledige dagene er fylt med gode forslag!");
  };
  const copyList = async () => {
    const text = [
      "Handleliste · Middag",
      `${servings} personer`,
      ...groups.flatMap((group) => [
        "",
        group,
        ...items
          .filter((item) => item.category === group)
          .map(
            (item) =>
              `${checked.includes(item.key) ? "☑" : "☐"} ${item.name} ${formatAmount(item.amount, item.unit)}`,
          ),
      ]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("Handlelisten er kopiert.");
    } catch {
      notify(
        "Kunne ikke kopiere. Tillat tilgang til utklippstavlen i nettleseren.",
      );
    }
  };

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="brand" aria-label="Middag, hjem">
            <span className="brand-icon">
              <Utensils size={21} strokeWidth={2.2} />
            </span>
            middag<span className="brand-period">.</span>
          </a>
          <nav aria-label="Hovedmeny">
            <a className="nav-link active" href="#ukeplan">
              <span>Ukeplan</span>
            </a>
            <button className="nav-link" onClick={() => setLibrary(true)}>
              Oppskrifter <span className="nav-count">{recipes.length}</span>
            </button>
          </nav>
          <span className="header-note">
            <Sprout size={16} /> Litt planlegging. Mer matglede.
          </span>
        </div>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">
              <span /> EN GOD UKE STARTER HER
            </div>
            <h1 id="page-title">
              Hva blir det til <span>middag?</span>
            </h1>
            <p>Samle ukens favoritter. Vi ordner handlelisten.</p>
          </div>
          <div className="intro-stamp">
            <WheatOff size={22} />
            <div>
              <strong>Helt glutenfritt</strong>
              <span>Gode middager for alle</span>
            </div>
          </div>
        </section>

        <section
          id="ukeplan"
          className="week-section"
          aria-labelledby="week-title"
        >
          <div className="section-heading">
            <div className="week-label">
              <h2 id="week-title">Din ukeplan</h2>
              <span className="week-chip">
                {dates.length ? `Uke ${weekNumber(dates[0])}` : "Denne uken"}
              </span>
              <span className="date-range">
                {dates.length
                  ? `${dates[0].toLocaleDateString("nb-NO", { day: "numeric", month: "short" })} – ${dates[6].toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`
                  : ""}
              </span>
            </div>
            <div className="week-actions">
              <button
                className="text-button clear-plan"
                disabled={!planned}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={15} /> Tøm planen
              </button>
              <button
                className="button button-dark"
                onClick={fillWeek}
                disabled={!ready || planned === 7 || !recipes.length}
              >
                <Shuffle size={16} /> Fyll ledige dager
              </button>
            </div>
          </div>
          <div className="week-grid">
            {DAYS.map((day, i) => {
              const recipe = recipes.find((r) => r.id === plan[day]);
              const today =
                dates[i]?.toDateString() === new Date().toDateString();
              return (
                <article
                  key={day}
                  className={`day-card ${recipe ? "has-recipe" : ""} ${today ? "today" : ""}`}
                >
                  <div className="day-label">
                    <span>{day}</span>
                    {today ? (
                      <span className="today-tag">I dag</span>
                    ) : (
                      <span className="day-date">{dates[i]?.getDate()}</span>
                    )}
                  </div>
                  {recipe ? (
                    <>
                      <button
                        className="day-meal"
                        onClick={() => setDetail(recipe)}
                        aria-label={`Se oppskrift: ${recipe.title}`}
                      >
                        <RecipeArt recipe={recipe} small />
                        <h3>{recipe.title}</h3>
                        <span className="meal-time">
                          <Clock3 size={12} />{" "}
                          {recipe.minutes
                            ? `${recipe.minutes} min`
                            : "Se oppskrift"}
                        </span>
                      </button>
                      <button
                        className="change-meal"
                        onClick={() => openPicker(day)}
                      >
                        <Shuffle size={12} /> Bytt rett
                      </button>
                    </>
                  ) : (
                    <button
                      className="add-meal"
                      disabled={!ready}
                      onClick={() => openPicker(day)}
                      aria-label={`Velg middag for ${day.toLowerCase()}`}
                    >
                      <span className="add-circle">
                        <Plus size={21} strokeWidth={1.5} />
                      </span>
                      <span>Velg middag</span>
                      <span className="add-hint">Noe godt venter</span>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <div className="plan-footnote">
            <span>
              <span className="progress-dots" aria-hidden="true">
                {DAYS.map((day) => (
                  <i key={day} className={plan[day] ? "filled" : ""} />
                ))}
              </span>
              {planned} av 7 middager planlagt
            </span>
            <span className={storageError ? "storage-warning" : ""}>
              {storageError ? (
                "Nettleseren tillater ikke lagring. Planen beholdes bare mens siden er åpen."
              ) : (
                <>
                  <Check size={13} /> Lagres automatisk på denne enheten
                </>
              )}
            </span>
          </div>
        </section>

        <div className="lower-grid">
          <section
            id="handleliste"
            className="shopping-panel"
            aria-labelledby="shopping-title"
          >
            <div className="shopping-header">
              <div className="heading-with-icon">
                <span className="basket-icon">
                  <ShoppingBasket size={21} />
                </span>
                <div>
                  <h2 id="shopping-title">Handlelisten din</h2>
                  <p>
                    {planned
                      ? `Alt du trenger til ${planned} gode middager`
                      : "Fra ukeplan til handlenett, helt automatisk"}
                  </p>
                </div>
              </div>
              <button
                className="icon-button"
                title="Kopier handleliste"
                aria-label="Kopier handleliste"
                onClick={copyList}
                disabled={!items.length}
              >
                <Copy size={17} />
              </button>
            </div>
            <div className="shopping-toolbar">
              <span>
                <Users size={15} /> Antall personer
              </span>
              <div className="stepper">
                <button
                  aria-label="Færre personer"
                  disabled={servings <= 1}
                  onClick={() => {
                    setServings((v) => v - 1);
                    setChecked([]);
                  }}
                >
                  <Minus size={13} />
                </button>
                <span aria-live="polite">{servings}</span>
                <button
                  aria-label="Flere personer"
                  disabled={servings >= 12}
                  onClick={() => {
                    setServings((v) => v + 1);
                    setChecked([]);
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            {!items.length ? (
              <div className="shopping-empty">
                <div className="empty-basket">
                  <ShoppingBasket size={35} strokeWidth={1.25} />
                  <span>
                    <Leaf size={17} />
                  </span>
                </div>
                <h3>En god middag begynner med en plan</h3>
                <p>
                  Velg en rett i ukeplanen, så dukker
                  <br />
                  ingrediensene opp her.
                </p>
                <a href="#ukeplan" className="empty-link">
                  La oss planlegge <ArrowRight size={15} />
                </a>
              </div>
            ) : (
              <>
                <div className="shopping-progress">
                  <span>
                    {completed} av {items.length} varer i kurven
                  </span>
                  <button
                    onClick={() =>
                      setChecked(
                        completed === items.length
                          ? []
                          : items.map((item) => item.key),
                      )
                    }
                  >
                    <CheckCheck size={14} />
                    {completed === items.length
                      ? "Fjern avkrysninger"
                      : "Merk alle"}
                  </button>
                </div>
                <div className="ingredient-groups">
                  {groups.map((group) => (
                    <div key={group} className="ingredient-group">
                      <h3>{group}</h3>
                      {items
                        .filter((item) => item.category === group)
                        .map((item) => (
                          <label
                            className={`shopping-item ${checked.includes(item.key) ? "checked" : ""}`}
                            key={item.key}
                          >
                            <input
                              type="checkbox"
                              checked={checked.includes(item.key)}
                              onChange={() =>
                                setChecked((current) =>
                                  current.includes(item.key)
                                    ? current.filter((key) => key !== item.key)
                                    : [...current, item.key],
                                )
                              }
                            />
                            <span className="custom-checkbox">
                              <Check size={12} />
                            </span>
                            <span className="ingredient-name">{item.name}</span>
                            <span className="ingredient-amount">
                              {formatAmount(item.amount, item.unit)}
                            </span>
                          </label>
                        ))}
                    </div>
                  ))}
                </div>
                {completed === items.length && (
                  <div className="all-done">
                    <CheckCheck size={17} /> Alt er i hus. God matlaging!
                  </div>
                )}
              </>
            )}
            {DAYS.some(
              (day) => recipes.find((r) => r.id === plan[day])?.batch,
            ) && (
              <p className="batch-note shopping-batch">
                Bakst beregnes som én deig per valgt dag, uavhengig av antall
                personer.
              </p>
            )}
            <div className="shopping-bottom">
              <Leaf size={14} /> Handle det du trenger. Bruk det du har.
            </div>
          </section>
          <aside className="inspiration-column">
            <section className="tip-card">
              <div className="tip-label">
                <Sparkles size={15} /> LITT MIDDAGSINSPIRASJON
              </div>
              <h2>
                Mindre «hva skal vi ha?»
                <br />
                Mer «mmm, så godt».
              </h2>
              <p>
                En liten plan gjør hverdagen lettere. Begynn med en favoritt og
                prøv noe nytt en annen dag.
              </p>
              <button onClick={() => setLibrary(true)}>
                Finn din neste favoritt <ArrowRight size={16} />
              </button>
              <div className="tip-decoration" aria-hidden="true">
                <span>🍋</span>
                <span>🌿</span>
              </div>
            </section>
            <section className="how-card">
              <span className="mini-eyebrow">
                ENKLERE HVERDAG, STEG FOR STEG
              </span>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Velg ukens middager</strong>
                    <p>Favoritter og nye bekjentskaper.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Få en ferdig handleliste</strong>
                    <p>Like ingredienser samles automatisk.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Senk skuldrene</strong>
                    <p>Middagen er allerede planlagt.</p>
                  </div>
                </li>
              </ol>
            </section>
            <div className="data-note">
              <WheatOff size={16} />
              <p>
                Alle rettene er glutenfrie. Sjekk alltid emballasjen på
                ingrediensene du bruker.
                {isExample && (
                  <span>
                    {" "}
                    {matpratCount
                      ? `${matpratCount} oppskrifter er hentet fra Matprat. Resten er egne eksempeloppskrifter.`
                      : "Oppskriftene er egne eksempler, ikke hentet fra Matprat."}
                  </span>
                )}
              </p>
            </div>
          </aside>
        </div>
        <section className="favorites-section">
          <div className="section-heading">
            <div>
              <span className="mini-eyebrow">GODT, ENKELT OG GLUTENFRITT</span>
              <h2>Noe godt å glede seg til</h2>
            </div>
            <button className="text-button" onClick={() => setLibrary(true)}>
              Se alle oppskrifter <ArrowRight size={16} />
            </button>
          </div>
          <div className="favorites-grid">
            {featured.map((recipe) => (
              <button
                className="favorite-card"
                key={recipe.id}
                onClick={() => setDetail(recipe)}
              >
                <RecipeArt recipe={recipe} />
                <div className="favorite-info">
                  <span className="recipe-category">
                    {recipe.category} ·{" "}
                    {recipe.source.url ? "Matprat" : "Eksempel"}
                  </span>
                  <h3>{recipe.title}</h3>
                  <div>
                    <span>
                      <Clock3 size={13} />
                      {recipe.minutes
                        ? `${recipe.minutes} min`
                        : "Tid ikke oppgitt"}
                    </span>
                    <span>
                      <WheatOff size={13} />
                      Glutenfri
                    </span>
                    <span className="favorite-arrow">
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <a href="#" className="brand">
          middag<span className="brand-period">.</span>
        </a>
        <span>Litt enklere hver dag.</span>
        <span>
          Laget for gode hverdager <Sprout size={15} />
        </span>
      </footer>

      <dialog
        ref={dialog}
        className={`recipe-dialog ${confirmClear ? "confirm-dialog" : ""}`}
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-content">
          <button
            className="dialog-close icon-button"
            aria-label="Lukk"
            onClick={close}
          >
            <X size={21} />
          </button>
          {confirmClear ? (
            <>
              <span className="dialog-eyebrow">EN NY START</span>
              <h2 id="dialog-title">Tømme ukeplanen?</h2>
              <p>
                Alle middager og avkrysninger fjernes. Oppskriftene er fortsatt
                her når du trenger dem.
              </p>
              <div className="confirm-actions">
                <button className="button button-light" onClick={close}>
                  Behold planen
                </button>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setPlan({});
                    setChecked([]);
                    close();
                    notify("Ukeplanen er tømt.");
                  }}
                >
                  Tøm ukeplanen
                </button>
              </div>
            </>
          ) : detail ? (
            <>
              <button
                className="text-button back-button"
                onClick={() => {
                  if (activeDay || library) setDetail(null);
                  else close();
                }}
              >
                <ArrowLeft size={15} /> Tilbake
              </button>
              <RecipeArt recipe={detail} />
              <span className="dialog-eyebrow">
                {detail.category} · GLUTENFRI
              </span>
              <h2 id="dialog-title">{detail.title}</h2>
              <p>{detail.description}</p>
              <div className="detail-meta">
                <span>
                  <Clock3 size={16} />
                  {detail.minutes
                    ? `${detail.minutes} minutter`
                    : "Tid ikke oppgitt"}
                </span>
                <span>
                  <Users size={16} />
                  {detail.batch ? "1 deig / omgang" : `${servings} personer`}
                </span>
              </div>
              {detail.batch && (
                <p className="batch-note">
                  {detail.yieldNote}. Mengdene gjelder én deig og justeres ikke
                  etter antall personer.
                </p>
              )}
              <div className="detail-columns">
                <section>
                  <h3>Ingredienser</h3>
                  <ul>
                    {detail.ingredients.map((ingredient, i) => (
                      <li key={i}>
                        <span>{ingredient.name}</span>
                        <strong>
                          {formatAmount(
                            ingredient.amount === null
                              ? null
                              : ingredient.amount *
                                  recipeScale(detail, servings),
                            ingredient.unit,
                          )}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Slik gjør du</h3>
                  <ol>
                    {detail.instructions.map((step, i) => (
                      <li key={i}>
                        <span>{i + 1}</span>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <div className="source-note">
                {detail.source.url ? (
                  <a href={detail.source.url} target="_blank" rel="noreferrer">
                    Originaloppskrift hos {detail.source.name} ↗
                  </a>
                ) : (
                  "Egen eksempeloppskrift · Ikke hentet fra Matprat"
                )}
              </div>
              {activeDay ? (
                <button
                  className="button button-primary detail-select"
                  onClick={() => select(detail)}
                >
                  <Plus size={17} /> Velg til {activeDay.toLowerCase()}
                </button>
              ) : (
                <div className="detail-day-select">
                  <label htmlFor="recipe-day">Legg til i ukeplanen</label>
                  <div>
                    <select
                      id="recipe-day"
                      defaultValue=""
                      onChange={(event) => {
                        const day = event.target.value as Day;
                        if (DAYS.includes(day)) {
                          setPlan((p) => ({ ...p, [day]: detail.id }));
                          setChecked([]);
                          close();
                          notify(`Lagt til på ${day.toLowerCase()}.`);
                        }
                      }}
                    >
                      <option value="" disabled>
                        Velg en dag
                      </option>
                      {DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                          {plan[day] ? " · bytt rett" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="dialog-eyebrow">
                <ChefHat size={15} /> FINN NOE GODT
              </span>
              <h2 id="dialog-title">
                {activeDay
                  ? `Hva frister på ${activeDay.toLowerCase()}?`
                  : "Din neste middagsfavoritt"}
              </h2>
              <p>
                {activeDay
                  ? "Velg en rett, så tar vi oss av handlelisten."
                  : "En samling gode, glutenfrie middager."}
              </p>
              <div className="recipe-search">
                <Search size={18} />
                <input
                  aria-label="Søk i oppskrifter"
                  placeholder="Søk etter rett eller ingrediens …"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <SlidersHorizontal size={17} />
              </div>
              <div className="category-tabs">
                {categories.map((name) => (
                  <button
                    key={name}
                    className={category === name ? "selected" : ""}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="picker-results">
                <span>{filtered.length} oppskrifter</span>
                <span>
                  <WheatOff size={13} /> Alle er glutenfrie
                </span>
              </div>
              <div className="picker-grid">
                {filtered.map((recipe) => (
                  <article className="picker-card" key={recipe.id}>
                    <button
                      className="picker-detail"
                      onClick={() => setDetail(recipe)}
                      aria-label={`Se oppskrift: ${recipe.title}`}
                    >
                      <RecipeArt recipe={recipe} />
                      <span className="recipe-category">
                        {recipe.category} ·{" "}
                        {recipe.source.url ? "Matprat" : "Eksempel"}
                      </span>
                      <h3>{recipe.title}</h3>
                      <span className="meal-time">
                        <Clock3 size={13} />{" "}
                        {recipe.minutes
                          ? `${recipe.minutes} min`
                          : "Tid ikke oppgitt"}
                      </span>
                    </button>
                    <button
                      className="pick-button"
                      onClick={() => select(recipe)}
                    >
                      {activeDay ? (
                        <>
                          <Plus size={15} /> Velg rett
                        </>
                      ) : (
                        <>
                          <BookOpen size={15} /> Se oppskrift
                        </>
                      )}
                    </button>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="no-results">
                  <Search size={28} />
                  <h3>Ingen treff denne gangen</h3>
                  <p>Prøv et annet søkeord eller en annen kategori.</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setQuery("");
                      setCategory("Alle");
                    }}
                  >
                    Vis alle oppskrifter
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </dialog>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        <Check size={17} />
        {toast}
      </div>
    </>
  );
}
