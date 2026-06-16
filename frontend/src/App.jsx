import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import Markdown from "react-markdown";
import SwipeCard from "./components/SwipeCard.jsx";
import { VIBES } from "./data.js";
import { suggestDestination, buildTrip, fetchDestinationPhoto } from "./api.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A few rotating lines so the loaders feel alive instead of a static spinner.
const SUGGEST_STEPS = [
  "Reading your travel vibes…",
  "Matching them to the perfect place…",
  "Picking your destination…",
];
const BUILD_STEPS = [
  "Searching the best flights…",
  "Checking the weather forecast…",
  "Hand-picking activities…",
  "Assembling your trip…",
];

export default function App() {
  // Stage machine: vibes -> suggesting -> destination -> building -> trip.
  const [stage, setStage] = useState("vibes");
  const [month, setMonth] = useState("July");

  const [vibeIndex, setVibeIndex] = useState(0);
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [exitDirection, setExitDirection] = useState("right");

  const [destination, setDestination] = useState(null);
  const [destPhoto, setDestPhoto] = useState(null);
  const [rejected, setRejected] = useState([]);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");

  async function askForDestination(nextLikes, nextDislikes, exclude) {
    setStage("suggesting");
    setError("");
    try {
      const result = await suggestDestination({
        likes: nextLikes,
        dislikes: nextDislikes,
        month,
        exclude,
      });
      setDestination(result);
      setStage("destination");
      // Look up a real photo of the place; fall back to a themed image if none.
      setDestPhoto(null);
      fetchDestinationPhoto(result.destination).then(setDestPhoto);
    } catch (err) {
      setError(String(err.message || err));
      setStage("error");
    }
  }

  function handleVibeSwipe(direction) {
    const vibe = VIBES[vibeIndex];
    const nextLikes = direction === "right" ? [...likes, vibe.id] : likes;
    const nextDislikes = direction === "left" ? [...dislikes, vibe.id] : dislikes;
    setExitDirection(direction);
    setLikes(nextLikes);
    setDislikes(nextDislikes);

    const isLast = vibeIndex === VIBES.length - 1;
    if (isLast) {
      askForDestination(nextLikes, nextDislikes, []);
    } else {
      setVibeIndex(vibeIndex + 1);
    }
  }

  function handleDestinationSwipe(direction) {
    setExitDirection(direction);
    if (direction === "left") {
      // Rejected: ask the concierge for a different place.
      const nextRejected = [...rejected, destination.destination];
      setRejected(nextRejected);
      askForDestination(likes, dislikes, nextRejected);
    } else {
      // Confirmed: build the full trip.
      buildConfirmedTrip();
    }
  }

  async function buildConfirmedTrip() {
    setStage("building");
    setError("");
    try {
      const result = await buildTrip({
        destination: destination.destination,
        month,
        likes,
        dislikes,
      });
      setPlan(result.plan);
      setStage("trip");
    } catch (err) {
      setError(String(err.message || err));
      setStage("error");
    }
  }

  function restart() {
    setStage("vibes");
    setVibeIndex(0);
    setLikes([]);
    setDislikes([]);
    setDestination(null);
    setDestPhoto(null);
    setRejected([]);
    setPlan("");
    setError("");
  }

  const progress = stage === "vibes" ? vibeIndex / VIBES.length : 1;

  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden">
      <Aurora />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col">
        <Header
          month={month}
          setMonth={setMonth}
          showMonth={stage === "vibes"}
          progress={progress}
        />

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
          <AnimatePresence mode="wait">
            {stage === "vibes" && (
              <VibeStage
                key="vibes"
                vibeIndex={vibeIndex}
                exitDirection={exitDirection}
                onSwipe={handleVibeSwipe}
                likeCount={likes.length}
              />
            )}

            {stage === "suggesting" && (
              <Loader key="suggesting" steps={SUGGEST_STEPS} />
            )}

            {stage === "destination" && destination && (
              <DestinationStage
                key="destination"
                destination={destination}
                photo={destPhoto}
                likes={likes}
                exitDirection={exitDirection}
                onSwipe={handleDestinationSwipe}
              />
            )}

            {stage === "building" && (
              <Loader
                key="building"
                steps={BUILD_STEPS}
                title={destination?.destination}
              />
            )}

            {stage === "trip" && (
              <TripStage
                key="trip"
                destination={destination}
                photo={destPhoto}
                likes={likes}
                plan={plan}
                onRestart={restart}
              />
            )}

            {stage === "error" && (
              <ErrorStage key="error" message={error} onRetry={restart} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Header({ month, setMonth, showMonth, progress }) {
  return (
    <header className="px-5 pt-6 pb-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="text-2xl">🌍</span>
          <span>
            <span className="bg-gradient-to-r from-sky-400 to-fuchsia-400 bg-clip-text text-transparent">
              Travel
            </span>{" "}
            Concierge
          </span>
        </h1>
        {showMonth && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>Trip in</span>
            <select
              value={month}
              name="month"
              onChange={(e) => setMonth(e.target.value)}
              className="glass rounded-lg px-2 py-1 font-medium text-white outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m} className="bg-slate-800">
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Slim progress bar that fills as the user swipes through the vibes. */}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-400"
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </header>
  );
}

// The shared photo card used by both the vibe and destination stages.
function PhotoCard({ image, accent, emoji, title, subtitle, badge }) {
  return (
    <div
      className="relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[2rem] shadow-2xl"
      style={{ boxShadow: `0 24px 60px -20px ${accent || "#000a"}` }}
    >
      <img
        src={image}
        alt={title}
        draggable="false"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark gradient so text is always readable over the photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

      {badge && (
        <span className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md">
          {badge}
        </span>
      )}

      <div className="relative p-7">
        {emoji && <div className="mb-2 text-6xl drop-shadow-lg">{emoji}</div>}
        <h2 className="text-4xl font-black leading-tight drop-shadow-lg">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-base text-white/90 drop-shadow">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function VibeStage({ vibeIndex, exitDirection, onSwipe, likeCount }) {
  const vibe = VIBES[vibeIndex];
  const next = VIBES[vibeIndex + 1];

  return (
    <motion.div
      className="flex w-full flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="mb-4 text-center text-sm text-slate-300">
        Swipe right on what you love, left on what you don't.
      </p>

      <div className="relative aspect-[3/4] w-full">
        {/* The next card peeks from behind for depth. */}
        {next && (
          <div className="absolute inset-0 scale-[0.94] opacity-50">
            <PhotoCard image={next.image} accent={next.accent} title="" />
          </div>
        )}

        <AnimatePresence custom={exitDirection}>
          <SwipeCard key={vibe.id} onSwipe={onSwipe}>
            <PhotoCard
              image={vibe.image}
              accent={vibe.accent}
              emoji={vibe.emoji}
              title={vibe.label}
              badge={`${vibeIndex + 1} / ${VIBES.length}`}
            />
          </SwipeCard>
        </AnimatePresence>
      </div>

      <ActionButtons
        onNope={() => onSwipe("left")}
        onLike={() => onSwipe("right")}
      />

      <p className="mt-3 h-5 text-sm text-slate-400">
        {likeCount > 0 ? `❤️ ${likeCount} liked` : "\u00A0"}
      </p>
    </motion.div>
  );
}

function DestinationStage({ destination, photo, likes, exitDirection, onSwipe }) {
  return (
    <motion.div
      className="flex w-full flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="mb-4 text-center text-sm text-slate-300">
        ✨ We found a match! Swipe right to go, left for another idea.
      </p>

      <div className="relative aspect-[3/4] w-full">
        <AnimatePresence custom={exitDirection}>
          <SwipeCard key={destination.destination} onSwipe={onSwipe}>
            <PhotoCard
              image={photo || destinationImage(destination.destination, likes)}
              accent="#8b5cf6"
              emoji="📍"
              title={destination.destination}
              subtitle={cleanInline(destination.reason)}
              badge="Your match"
            />
          </SwipeCard>
        </AnimatePresence>
      </div>

      <ActionButtons
        onNope={() => onSwipe("left")}
        onLike={() => onSwipe("right")}
        nopeLabel="Try again"
        likeLabel="Let's go"
      />
    </motion.div>
  );
}

function TripStage({ destination, photo, likes, plan, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex w-full flex-col"
    >
      <div className="relative mb-4 overflow-hidden rounded-3xl shadow-xl">
        <img
          src={photo || destinationImage(destination?.destination, likes)}
          alt={destination?.destination}
          className="h-36 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
        <div className="absolute bottom-0 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            Your trip is ready ✈️
          </p>
          <h2 className="text-2xl font-black drop-shadow">{destination?.destination}</h2>
        </div>
      </div>

      <div className="no-scrollbar max-h-[56vh] overflow-y-auto px-0.5 pb-1">
        <TripPlan plan={plan} />
      </div>

      <button
        onClick={onRestart}
        className="mt-5 rounded-full bg-gradient-to-r from-sky-500 to-fuchsia-500 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
      >
        Plan another trip
      </button>
    </motion.div>
  );
}

// ---- Trip plan: turn the agent's markdown into floating, themed cards ----

// Section keyword -> icon + accent colour + renderer type. Matched against the
// markdown heading text so the layout adapts to whatever the planner returns.
const SECTION_META = [
  { keys: ["flight", "airline"], icon: "✈️", accent: "#0ea5e9", type: "flights" },
  { keys: ["weather", "climate", "forecast", "temperature"], icon: "🌤️", accent: "#f59e0b", type: "weather" },
  { keys: ["activit", "experience", "sightsee", "nightlife"], icon: "🎉", accent: "#d946ef", type: "activities" },
  { keys: ["food", "dining", "restaurant", "cuisine"], icon: "🍽️", accent: "#f43f5e", type: "food" },
  { keys: ["stay", "hotel", "accommodation", "lodging"], icon: "🏨", accent: "#10b981", type: "stay" },
  { keys: ["pack", "advice"], icon: "🎒", accent: "#8b5cf6", type: "tips" },
  { keys: ["budget"], icon: "💶", accent: "#22c55e", type: "budget" },
];

function sectionMeta(title) {
  const t = title.toLowerCase();
  for (const m of SECTION_META) {
    // Match each keyword at a word boundary so "cost" never matches "Costa".
    if (m.keys.some((k) => new RegExp(`\\b${k}`).test(t))) return m;
  }
  return null;
}

function cleanInline(s = "") {
  return s.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

// Split the plan into a title plus a list of sections, keyed off markdown
// headings. Anything before the first section heading becomes the title.
function parsePlan(md = "") {
  const lines = md.replace(/\r/g, "").split("\n");
  let title = "";
  const sections = [];
  let current = null;
  for (const raw of lines) {
    const h = raw.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (h) {
      const text = cleanInline(h[1].replace(/#/g, ""));
      const meta = sectionMeta(text);
      if (!meta && current === null && sections.length === 0 && !title) {
        title = text;
        continue;
      }
      current = {
        title: text,
        meta: meta || { icon: "📌", accent: "#64748b", type: "generic" },
        lines: [],
      };
      sections.push(current);
    } else if (current) {
      current.lines.push(raw);
    } else if (!title && raw.trim()) {
      title = cleanInline(raw);
    }
  }
  if (sections.length === 0) {
    sections.push({
      title: "Your trip",
      meta: { icon: "🧳", accent: "#0ea5e9", type: "generic" },
      lines,
    });
  }
  return { title, sections };
}

function parseList(body) {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => cleanInline(l.replace(/^[-*•]\s+/, "")));
  if (bullets.length) return bullets;
  return lines.filter((l) => !/:$/.test(l)).map(cleanInline);
}

function parseKV(body) {
  return parseList(body)
    .map((item) => {
      const idx = item.indexOf(":");
      if (idx === -1) return { label: "", value: item };
      return { label: item.slice(0, idx).trim(), value: item.slice(idx + 1).trim() };
    })
    .filter((kv) => kv.value);
}

function parseFlights(body) {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const intro = [];
  const flights = [];
  for (const l of lines) {
    const clean = cleanInline(l.replace(/^[-*•]\s+/, ""));
    if (clean.includes("—") && /[€$£]|\d/.test(clean)) {
      const parts = clean.split("—").map((p) => p.trim()).filter(Boolean);
      const name = parts.shift() || "Flight";
      flights.push({ name, chips: parts });
    } else if (clean) {
      intro.push(clean);
    }
  }
  return { intro, flights };
}

function weatherIcon(label = "") {
  const l = label.toLowerCase();
  if (l.includes("high")) return "🌡️";
  if (l.includes("low")) return "🌙";
  if (l.includes("sea") || l.includes("water")) return "🌊";
  if (l.includes("rain") || l.includes("condition") || l.includes("sky")) return "🌦️";
  if (l.includes("pack")) return "🎒";
  if (l.includes("sun") || l.includes("uv")) return "☀️";
  if (l.includes("wind")) return "💨";
  if (l.includes("humid")) return "💧";
  return "📍";
}

function chipStyle(text, accent) {
  const t = text.toLowerCase();
  if (/[€$£]/.test(text)) return { background: `${accent}1f`, color: accent };
  if (t.includes("nonstop") || t.includes("direct")) return { background: "#dcfce7", color: "#15803d" };
  if (t.includes("stop")) return { background: "#fef3c7", color: "#b45309" };
  return { background: "#f1f5f9", color: "#475569" };
}

// Fallback markdown styling for sections without a specialised renderer.
const PLAN_MD = {
  p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-600">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="text-slate-500">{children}</em>,
  ul: ({ children }) => <ul className="space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5">{children}</ol>,
  li: ({ children }) => (
    <li className="flex gap-2 text-slate-600">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      <span>{children}</span>
    </li>
  ),
};

function TripPlan({ plan }) {
  const { title, sections } = useMemo(() => parsePlan(plan), [plan]);
  return (
    <div className="space-y-3">
      {title && (
        <p className="px-2 text-center text-xs font-medium text-slate-400">
          {title}
        </p>
      )}
      {sections.map((section, i) => (
        <SectionCard key={i} section={section} index={i} />
      ))}
    </div>
  );
}

function SectionCard({ section, index }) {
  const { meta } = section;
  const body = section.lines.join("\n").trim();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.09, duration: 0.4 }}
      className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-black/30 ring-1 ring-black/5"
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: `linear-gradient(135deg, ${meta.accent}22, ${meta.accent}08)` }}
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl"
          style={{ background: `${meta.accent}26` }}
        >
          {meta.icon}
        </span>
        <h3
          className="text-sm font-extrabold uppercase tracking-wide"
          style={{ color: meta.accent }}
        >
          {section.title}
        </h3>
      </div>
      <div className="px-5 py-4 text-[15px]">
        <SectionBody section={section} body={body} />
      </div>
    </motion.div>
  );
}

function SectionBody({ section, body }) {
  const { type, accent } = section.meta;

  if (type === "weather") {
    const tiles = parseKV(body);
    if (tiles.length) return <WeatherTiles tiles={tiles} />;
  }
  if (type === "flights") {
    const { intro, flights } = parseFlights(body);
    if (flights.length) return <FlightList intro={intro} flights={flights} accent={accent} />;
  }
  if (type === "activities") {
    const items = parseList(body);
    if (items.length) return <ActivityChips items={items} accent={accent} />;
  }
  return (
    <div className="prose-trip">
      <Markdown components={PLAN_MD}>{body}</Markdown>
    </div>
  );
}

function WeatherTiles({ tiles }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((t, i) => {
        const wide = !t.label || t.value.length > 22;
        return (
          <div
            key={i}
            className={`rounded-2xl bg-slate-50 p-3 ${wide ? "col-span-2" : ""}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="text-sm">{weatherIcon(t.label)}</span>
              <span>{t.label || "Note"}</span>
            </div>
            <div className="mt-1 font-bold text-slate-800">{t.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function FlightList({ intro, flights, accent }) {
  return (
    <div className="space-y-2.5">
      {intro.map((line, i) => (
        <p key={`intro-${i}`} className="text-sm text-slate-500">
          {line}
        </p>
      ))}
      {flights.map((f, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span>✈️</span>
            <span>{f.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.chips.map((c, j) => (
              <span
                key={j}
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={chipStyle(c, accent)}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityChips({ items, accent }) {
  const allShort = items.every((i) => i.length <= 26);
  if (allShort) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span
            key={i}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {it}
          </span>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-slate-600">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
            style={{ background: `${accent}1a`, color: accent }}
          >
            ✓
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionButtons({ onNope, onLike, nopeLabel = "Nope", likeLabel = "Like" }) {
  return (
    <div className="mt-6 flex items-center gap-8">
      <button
        onClick={onNope}
        aria-label={nopeLabel}
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400/50 bg-white/5 text-2xl text-rose-400 shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-rose-500/20 active:scale-95"
      >
        ✕
      </button>
      <button
        onClick={onLike}
        aria-label={likeLabel}
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-white/5 text-2xl text-emerald-400 shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-emerald-500/20 active:scale-95"
      >
        ♥
      </button>
    </div>
  );
}

function Loader({ steps, title }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative h-20 w-20">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-white/10 border-t-sky-400"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-4 border-white/10 border-b-fuchsia-400"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
        />
      </div>

      {title && <p className="text-lg font-bold text-white">{title}</p>}

      <div className="h-6 overflow-hidden">
        <CyclingText steps={steps} />
      </div>
    </motion.div>
  );
}

// Cycles through the loader steps so the wait feels purposeful.
function CyclingText({ steps }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % steps.length);
    }, 1600);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="text-center text-slate-300"
      >
        {steps[index]}
      </motion.p>
    </AnimatePresence>
  );
}

function ErrorStage({ message, onRetry }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-5xl">😕</div>
      <p className="text-slate-200">Something went wrong.</p>
      <p className="max-w-xs text-sm text-slate-400">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-sky-500 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-sky-400 active:scale-95"
      >
        Start over
      </button>
    </motion.div>
  );
}

// Picks a stable scenic photo for a destination from the curated set. Keeps the
// demo reliable with no live image lookups: the same destination always maps to
// the same picture.
const DESTINATION_PICS = [
  "/images/beaches.jpg",
  "/images/cities.jpg",
  "/images/history.jpg",
  "/images/hiking.jpg",
  "/images/food.jpg",
];

function destinationImage(name = "", likes = []) {
  // Prefer a photo that matches the traveller's top vibe, so the fallback always
  // feels relevant (a beach lover gets a beach, not a random city or monument).
  for (const id of likes) {
    const vibe = VIBES.find((v) => v.id === id);
    if (vibe) return vibe.image;
  }
  return DESTINATION_PICS[name.length % DESTINATION_PICS.length];
}
