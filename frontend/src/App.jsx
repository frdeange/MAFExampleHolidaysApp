import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Markdown from "react-markdown";
import SwipeCard from "./components/SwipeCard.jsx";
import { VIBES, DESTINATION_GRADIENT } from "./data.js";
import { suggestDestination, buildTrip } from "./api.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
    setRejected([]);
    setPlan("");
    setError("");
  }

  return (
    <div className="flex h-full flex-col items-center bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Header
        month={month}
        setMonth={setMonth}
        showMonth={stage === "vibes"}
      />

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-8">
        {stage === "vibes" && (
          <VibeStage
            vibeIndex={vibeIndex}
            exitDirection={exitDirection}
            onSwipe={handleVibeSwipe}
          />
        )}

        {stage === "suggesting" && <Loader label="Finding your perfect destination…" />}

        {stage === "destination" && destination && (
          <DestinationStage
            destination={destination}
            exitDirection={exitDirection}
            onSwipe={handleDestinationSwipe}
          />
        )}

        {stage === "building" && (
          <Loader label={`Building your trip to ${destination?.destination}…`} />
        )}

        {stage === "trip" && (
          <TripStage destination={destination} plan={plan} onRestart={restart} />
        )}

        {stage === "error" && <ErrorStage message={error} onRetry={restart} />}
      </main>
    </div>
  );
}

function Header({ month, setMonth, showMonth }) {
  return (
    <header className="flex w-full max-w-md items-center justify-between px-5 pt-6 pb-2">
      <h1 className="text-xl font-bold tracking-tight">
        <span className="text-sky-400">Travel</span> Concierge
      </h1>
      {showMonth && (
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg bg-slate-700 px-2 py-1 text-white outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}

function CardShell({ gradient, children }) {
  return (
    <div
      className="flex h-full w-full flex-col justify-end overflow-hidden rounded-3xl p-7 shadow-2xl"
      style={{ background: gradient }}
    >
      {children}
    </div>
  );
}

function VibeStage({ vibeIndex, exitDirection, onSwipe }) {
  const vibe = VIBES[vibeIndex];
  const next = VIBES[vibeIndex + 1];

  return (
    <>
      <p className="mb-4 text-center text-sm text-slate-300">
        Swipe right on what you love, left on what you don't.
      </p>

      <div className="relative aspect-[3/4] w-full">
        {/* The next card peeks from behind for depth. */}
        {next && (
          <div className="absolute inset-0 scale-95 opacity-60">
            <CardShell gradient={next.gradient}>
              <div />
            </CardShell>
          </div>
        )}

        <AnimatePresence>
          <SwipeCard key={vibe.id} onSwipe={onSwipe} exitDirection={exitDirection}>
            <CardShell gradient={vibe.gradient}>
              <div className="mb-auto text-7xl drop-shadow-lg">{vibe.emoji}</div>
              <h2 className="text-4xl font-black drop-shadow">{vibe.label}</h2>
            </CardShell>
          </SwipeCard>
        </AnimatePresence>
      </div>

      <SwipeHints />
    </>
  );
}

function DestinationStage({ destination, exitDirection, onSwipe }) {
  return (
    <>
      <p className="mb-4 text-center text-sm text-slate-300">
        We found a match! Swipe right to go, left for another idea.
      </p>

      <div className="relative aspect-[3/4] w-full">
        <AnimatePresence>
          <SwipeCard
            key={destination.destination}
            onSwipe={onSwipe}
            exitDirection={exitDirection}
          >
            <CardShell gradient={DESTINATION_GRADIENT}>
              <div className="mb-auto text-7xl drop-shadow-lg">📍</div>
              <h2 className="text-4xl font-black leading-tight drop-shadow">
                {destination.destination}
              </h2>
              {destination.reason && (
                <p className="mt-3 text-base text-white/90 drop-shadow">
                  {destination.reason}
                </p>
              )}
            </CardShell>
          </SwipeCard>
        </AnimatePresence>
      </div>

      <SwipeHints likeLabel="Let's go" nopeLabel="Try again" />
    </>
  );
}

function TripStage({ destination, plan, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col"
    >
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-5 text-center shadow-lg">
        <div className="text-4xl">✈️</div>
        <h2 className="mt-1 text-2xl font-black">{destination?.destination}</h2>
        <p className="text-sm text-white/80">Your trip is ready</p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-white px-6 py-5 text-slate-800 shadow-lg">
        <div className="prose-trip">
          <Markdown>{plan}</Markdown>
        </div>
      </div>

      <button
        onClick={onRestart}
        className="mt-5 rounded-full bg-sky-500 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-sky-400"
      >
        Plan another trip
      </button>
    </motion.div>
  );
}

function Loader({ label }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        className="h-14 w-14 rounded-full border-4 border-slate-600 border-t-sky-400"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      <p className="text-center text-slate-300">{label}</p>
    </div>
  );
}

function ErrorStage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-5xl">😕</div>
      <p className="text-slate-300">Something went wrong.</p>
      <p className="text-sm text-slate-500">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-sky-500 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-sky-400"
      >
        Start over
      </button>
    </div>
  );
}

function SwipeHints({ likeLabel = "Like", nopeLabel = "Nope" }) {
  return (
    <div className="mt-6 flex w-full items-center justify-between px-2 text-sm font-semibold">
      <span className="text-rose-400">← {nopeLabel}</span>
      <span className="text-emerald-400">{likeLabel} →</span>
    </div>
  );
}
