import { useState, useEffect } from "react";
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

function DestinationStage({ destination, photo, exitDirection, onSwipe }) {
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
              image={photo || destinationImage(destination.destination)}
              accent="#8b5cf6"
              emoji="📍"
              title={destination.destination}
              subtitle={destination.reason}
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

function TripStage({ destination, photo, plan, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex w-full flex-col"
    >
      <div className="relative mb-4 overflow-hidden rounded-3xl shadow-xl">
        <img
          src={photo || destinationImage(destination?.destination)}
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

      <div className="no-scrollbar max-h-[52vh] overflow-y-auto rounded-3xl bg-white px-6 py-5 text-slate-800 shadow-xl">
        <div className="prose-trip">
          <Markdown>{plan}</Markdown>
        </div>
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

function destinationImage(name = "") {
  return DESTINATION_PICS[name.length % DESTINATION_PICS.length];
}
