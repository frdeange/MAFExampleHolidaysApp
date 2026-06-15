import { motion, useMotionValue, useTransform } from "motion/react";

// A single draggable card. The user drags it left or right; releasing past a
// threshold flings it off-screen and reports the direction via onSwipe. The
// action buttons in App reuse the same onSwipe, and the exit animation provides
// the fling for both.
//
// Two layers, on purpose:
//  - The OUTER layer owns the exit fling (x via the `exit` variant). It has no
//    controlled motion value, so framer can freely animate it off-screen in the
//    swiped direction — for both drag releases and the action buttons. The exit
//    variant is a FUNCTION that reads the direction from AnimatePresence's
//    `custom` prop, which is forwarded to the leaving card at exit time. This is
//    what keeps the fling in sync with the swipe (a plain prop would lag one
//    card behind, because AnimatePresence renders the leaving card with its
//    previous props).
//  - The INNER layer owns the live drag feedback (a controlled motion value for
//    x/rotate plus the like/nope badges). Keeping these separate avoids the bug
//    where the drag snap-back-to-center fought the exit and dragged the card the
//    wrong way.
//
// "like" / "nope" badges fade in as the card is dragged, just like a dating app.
export default function SwipeCard({ children, onSwipe, drag = true }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-16, 16]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0]);

  function handleDragEnd(_event, info) {
    const threshold = 110;
    if (info.offset.x > threshold) {
      onSwipe("right");
    } else if (info.offset.x < -threshold) {
      onSwipe("left");
    }
  }

  return (
    <motion.div
      className="absolute inset-0"
      variants={{
        initial: { scale: 0.92, opacity: 0, y: 20 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: (direction) => ({
          x: direction === "left" ? -700 : 700,
          opacity: 0,
          rotate: direction === "left" ? -22 : 22,
          transition: { duration: 0.32 },
        }),
      }}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ x, rotate }}
        drag={drag ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 1.015 }}
      >
        {children}

        {drag && (
          <>
            <motion.div
              className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-2xl border-4 border-emerald-400 px-4 py-1 text-3xl font-black uppercase tracking-wider text-emerald-400 shadow-lg"
              style={{ opacity: likeOpacity }}
            >
              Like
            </motion.div>
            <motion.div
              className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-2xl border-4 border-rose-500 px-4 py-1 text-3xl font-black uppercase tracking-wider text-rose-500 shadow-lg"
              style={{ opacity: nopeOpacity }}
            >
              Nope
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
