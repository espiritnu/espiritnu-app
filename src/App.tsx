import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  linkWithPopup,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// --- FIX: ADDED TYPE DEFINITIONS ---
// This tells TypeScript the "shape" of our data objects.

type Whisper = {
  id: string;
  whisperType: string;
  title: string;
  prompt: string;
  emotion: string;
  expansion: string;
  randomSeed: number;
};

type Reflection = {
  id: string;
  createdAt: Timestamp;
  whisperTitle: string;
  whisperPrompt: string;
  whisperEmotion: string;
  whisperType: string;
  entry: string;
  date?: string; // This property is added later, so it's optional
};

type ProgressionStage = {
  id: string;
  name: string;
  icon: string;
  meaning: string;
  criteria: {
    minReflections: number;
    minMoods: number;
    minStreakDays: number;
    minDeepWrites: number;
  };
  rewards: {
    badge: string;
    message: string;
    visual: {
      fireflies: number;
      glowIntensity: number;
    };
  };
};

type Stats = {
  totalReflections: number;
  uniqueMoods: number;
  deepWrites: number;
  longestStreak: number;
};
// --- END OF FIX ---

// THEME: tokens and styles
const GlobalStyles = () => (
  <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;700&display=swap');
      body { font-family: 'Inter', sans-serif; }
      .font-lora { font-family: 'Lora', serif; }

      :root{
        --color-bg:#212F26;
        --color-surface:rgba(255,255,255,0.06);
        --color-surface-border:rgba(255,255,255,0.20);
        --color-text:#E0EAE3;
        --color-text-muted:#C0CAC4;
        --color-text-subtle:#A0A7A3;
        --color-accent:#76A68A;
        --color-accent-ink:#212F26;
        --color-glow:#8BA72D;
        --shadow-soft:0 10px 30px rgba(0,0,0,0.25);
      }

      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      .animate-fadeIn{ animation:fadeIn .5s ease-in-out }

      @keyframes fadeOut { from{opacity:1} to{opacity:0} }
      .animate-fadeOut{ animation:fadeOut .5s ease-in-out forwards }

      @keyframes scaleIn { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
      .animate-scaleIn{ animation:scaleIn .5s ease-in-out }

      @keyframes glowPulse {
        0%   { box-shadow:0 0 0px var(--color-glow); }
        50%  { box-shadow:0 0 22px var(--color-glow); }
        100% { box-shadow:0 0 0px var(--color-glow); }
      }

      @keyframes fireflyFloat {
        0%   { transform:translate3d(0,0,0) scale(.9);   opacity:.0; }
        10%  { opacity:.85; }
        50%  { transform:translate3d(20px,-30px,0) scale(1); }
        80%  { opacity:.6; }
        100% { transform:translate3d(-10px,-60px,0) scale(.95); opacity:.0; }
      }
      @keyframes fireflyTwinkle {
        0%,100% { filter:drop-shadow(0 0 0px var(--color-glow)); }
        50%     { filter:drop-shadow(0 0 10px var(--color-glow)); }
      }

      @media (prefers-reduced-motion: reduce){
        .animate-fadeIn,.animate-scaleIn{ animation:none }
        .glow-cta{ animation:none }
        .firefly{ animation:none }
      }
  `}</style>
);

// --- SVG ICONS ---
const WriteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mr-2"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const ViewIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mr-2"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mr-2"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const HeartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const GoogleIcon = () => (
  <svg
    className="mr-2"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25C22.56 11.42 22.49 10.62 22.36 9.84H12V14.48H18.06C17.72 16.03 16.84 17.33 15.53 18.23V21.09H19.5C21.46 19.23 22.56 16.03 22.56 12.25Z"
      fill="#4285F4"
    />
    <path
      d="M12 23C14.97 23 17.45 22.02 19.5 20.3L15.53 17.43C14.53 18.1 13.34 18.52 12 18.52C9.43 18.52 7.23 16.81 6.4 14.48H2.27V17.34C4.26 20.77 7.83 23 12 23Z"
      fill="#34A853"
    />
    <path
      d="M6.4 14.48C6.14 13.72 6 12.88 6 12C6 11.12 6.14 10.28 6.4 9.52V6.66H2.27C1.48 8.24 1 10.06 1 12C1 13.94 1.48 15.76 2.27 17.34L6.4 14.48Z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.48C13.48 5.48 14.77 5.99 15.82 6.98L19.57 3.23C17.45 1.23 14.97 0 12 0C7.83 0 4.26 2.23 2.27 5.66L6.4 8.52C7.23 6.19 9.43 4.48 12 4.48V5.48Z"
      fill="#EA4335"
    />
  </svg>
);

type FireflyType = {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

// --- DECORATIVE COMPONENTS ---
function FirefliesLayer({ baseCount = 12, additionalCount = 0 }) {
  const [flies, setFlies] = useState<FireflyType[]>([]);
  const totalCount = baseCount + additionalCount;

  useEffect(() => {
    const arr: FireflyType[] = Array.from({ length: totalCount }).map(
      (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 6 + Math.random() * 8,
        delay: Math.random() * (6 + additionalCount / 5),
        opacity: 0.6 + Math.random() * 0.4,
      })
    );
    setFlies(arr);
  }, [totalCount]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {flies.map((f) => (
        <span
          key={f.id}
          className="firefly"
          style={{
            position: "absolute",
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            background:
              "radial-gradient(circle, var(--color-glow) 20%, rgba(139,167,45,0.0) 70%)",
            borderRadius: "9999px",
            opacity: f.opacity,
            animation: `fireflyFloat ${f.duration}s ease-in-out ${
              f.delay
            }s infinite alternate, fireflyTwinkle ${Math.max(
              2,
              f.duration * 0.5
            )}s ease-in-out ${f.delay / 2}s infinite`,
            transform: "translate3d(0,0,0)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </div>
  );
}

// WHISPERS: embedded CSV & PROGRESSION: data
const WHISPERS: Whisper[] = [
  {
    id: "326",
    whisperType: "Sad",
    title: "Let Me Be",
    prompt: "What part of you just wants to be left alone and felt?",
    emotion: "Sad",
    expansion: "It's okay to retreat and feel fully-this moment is for you.",
    randomSeed: 0.145,
  },
  {
    id: "325",
    whisperType: "Sad",
    title: "Words Unsaid",
    prompt:
      "What do you wish you could say to someone, even if they'll never hear it?",
    emotion: "Sad",
    expansion: "Writing or speaking your truth can bring unexpected peace.",
    randomSeed: 0.939,
  },
  {
    id: "324",
    whisperType: "Sad",
    title: "Rainy Days",
    prompt: "What emotional weather are you moving through right now?",
    emotion: "Sad",
    expansion: "Sadness, like weather, passes-let it move through you.",
    randomSeed: 0.828,
  },
  {
    id: "323",
    whisperType: "Sad",
    title: "Held",
    prompt: "What does it look like to emotionally hold yourself today?",
    emotion: "Sad",
    expansion: "You deserve your own gentleness-wrap yourself in warmth.",
    randomSeed: 0.717,
  },
  {
    id: "317",
    whisperType: "Reflective",
    title: "Converse",
    prompt: "What would your younger self say to you today?",
    emotion: "Reflective",
    expansion: "Let your inner child speak-their wisdom is timeless.",
    randomSeed: 0.145,
  },
  {
    id: "316",
    whisperType: "Reflective",
    title: "Unlearn",
    prompt: "What belief is it time to let go of?",
    emotion: "Reflective",
    expansion: "Letting go of old beliefs makes space for new growth.",
    randomSeed: 0.939,
  },
  {
    id: "315",
    whisperType: "Reflective",
    title: "Life Review",
    prompt: "When have you felt most alive?",
    emotion: "Reflective",
    expansion: "Revisit moments of vitality-they hold clues to your purpose.",
    randomSeed: 0.828,
  },
  {
    id: "314",
    whisperType: "Reflective",
    title: "Rearview",
    prompt: "What have you overcome that you once thought impossible?",
    emotion: "Reflective",
    expansion: "Acknowledge your resilience-you are stronger than you know.",
    randomSeed: 0.717,
  },
  {
    id: "308",
    whisperType: "Openhearted",
    title: "Gift",
    prompt: "What is one gift you can offer the world today?",
    emotion: "Openhearted",
    expansion: "Your unique presence is a gift-share it freely.",
    randomSeed: 0.234,
  },
  {
    id: "307",
    whisperType: "Openhearted",
    title: "Love Letter",
    prompt: "What do you love about yourself in this moment?",
    emotion: "Openhearted",
    expansion: "Self-love is the foundation for all other love-write it down.",
    randomSeed: 0.145,
  },
  {
    id: "306",
    whisperType: "Openhearted",
    title: "Open Up",
    prompt: "What are you ready to be open to?",
    emotion: "Openhearted",
    expansion: "Open your heart to new possibilities and watch them unfold.",
    randomSeed: 0.939,
  },
  {
    id: "305",
    whisperType: "Openhearted",
    title: "Connection",
    prompt: "What makes you feel connected to something greater?",
    emotion: "Openhearted",
    expansion: "Connection reminds us we are part of a larger whole.",
    randomSeed: 0.828,
  },
  {
    id: "299",
    whisperType: "Hopeful",
    title: "New Day",
    prompt: "What is one small thing you can look forward to today?",
    emotion: "Hopeful",
    expansion: "Hope can be found in the smallest moments of joy.",
    randomSeed: 0.345,
  },
  {
    id: "298",
    whisperType: "Hopeful",
    title: "Look Ahead",
    prompt: "What is a future you are excited to create?",
    emotion: "Hopeful",
    expansion: "Your vision for the future can illuminate your path today.",
    randomSeed: 0.234,
  },
  {
    id: "297",
    whisperType: "Hopeful",
    title: "The Possible",
    prompt: "What feels possible for you today?",
    emotion: "Hopeful",
    expansion: "Even a glimmer of possibility can light up the darkest days.",
    randomSeed: 0.145,
  },
  {
    id: "296",
    whisperType: "Hopeful",
    title: "Silver Lining",
    prompt: "What is one good thing that has come from a hard time?",
    emotion: "Hopeful",
    expansion: "Hardship can reveal unexpected strengths and blessings.",
    randomSeed: 0.939,
  },
  {
    id: "289",
    whisperType: "Frustrated",
    title: "Let Go",
    prompt: "What's one thing you're holding onto too tightly?",
    emotion: "Frustrated",
    expansion: "Release your grip and notice the space that opens up.",
    randomSeed: 0.464,
  },
  {
    id: "288",
    whisperType: "Frustrated",
    title: "Patience",
    prompt: "What would it feel like to be patient with this situation?",
    emotion: "Frustrated",
    expansion: "Patience creates a space for solutions to emerge.",
    randomSeed: 0.345,
  },
  {
    id: "287",
    whisperType: "Frustrated",
    title: "Reframe",
    prompt: "How can you look at this situation differently?",
    emotion: "Frustrated",
    expansion: "A shift in perspective can unlock a new path forward.",
    randomSeed: 0.234,
  },
  {
    id: "286",
    whisperType: "Frustrated",
    title: "Express",
    prompt: "What does this frustration need to say?",
    emotion: "Frustrated",
    expansion: "Give your frustration a voice-write it, speak it, move it.",
    randomSeed: 0.145,
  },
  {
    id: "281",
    whisperType: "Empowered",
    title: "Power Pose",
    prompt: "How can you embody your strength right now?",
    emotion: "Empowered",
    expansion: "Stand tall, breathe deep-feel your power from within.",
    randomSeed: 0.575,
  },
  {
    id: "280",
    whisperType: "Empowered",
    title: "Activate",
    prompt: "What is one step you can take toward your goal?",
    emotion: "Empowered",
    expansion: "Small steps create powerful momentum.",
    randomSeed: 0.464,
  },
  {
    id: "279",
    whisperType: "Empowered",
    title: "Affirm",
    prompt: "What is one true, positive thing you can say about yourself?",
    emotion: "Empowered",
    expansion: "Your words have power-use them to build yourself up.",
    randomSeed: 0.345,
  },
  {
    id: "278",
    whisperType: "Empowered",
    title: "Next Chapter",
    prompt: "What story are you ready to write?",
    emotion: "Empowered",
    expansion: "You are the author of your own life-begin the next chapter.",
    randomSeed: 0.234,
  },
  {
    id: "270",
    whisperType: "Detached",
    title: "Soften",
    prompt: "Where can you soften your body and your mind?",
    emotion: "Detached",
    expansion: "Softening allows you to move with more ease and grace.",
    randomSeed: 0.898,
  },
  {
    id: "269",
    whisperType: "Detached",
    title: "Flow",
    prompt: "What would it be like to flow with what's happening?",
    emotion: "Detached",
    expansion: "Resistance creates tension; flow creates ease.",
    randomSeed: 0.686,
  },
  {
    id: "268",
    whisperType: "Detached",
    title: "Witness",
    prompt: "Can you observe your thoughts without judgment?",
    emotion: "Detached",
    expansion: "You are the sky, not the clouds-watch them pass.",
    randomSeed: 0.575,
  },
  {
    id: "267",
    whisperType: "Detached",
    title: "Release",
    prompt: "What are you ready to release control over?",
    emotion: "Detached",
    expansion: "True power lies in knowing what to let go of.",
    randomSeed: 0.464,
  },
  {
    id: "260",
    whisperType: "Anxious",
    title: "Pause",
    prompt: "What happens when you pause and take one deep breath?",
    emotion: "Anxious",
    expansion: "One conscious breath can create a moment of calm.",
    randomSeed: 0.898,
  },
  {
    id: "259",
    whisperType: "Anxious",
    title: "Present Moment",
    prompt: "What are three things you can see, hear, or feel right now?",
    emotion: "Anxious",
    expansion: "Ground yourself in the present to soothe an anxious mind.",
    randomSeed: 0.939,
  },
  {
    id: "254",
    whisperType: "Anxious",
    title: "Forward Motion",
    prompt: "What is one small step you can take to move forward?",
    emotion: "Anxious",
    expansion:
      "Action, no matter how small, can dissolve tension and move you forward.",
    randomSeed: 0.828,
  },
  {
    id: "253",
    whisperType: "Anxious",
    title: "Inner Voice",
    prompt: "What is your anxious mind trying to protect you from?",
    emotion: "Anxious",
    expansion:
      "Anxiety often masks deep care-listen to its message with compassion.",
    randomSeed: 0.797,
  },
  {
    id: "252",
    whisperType: "Anxious",
    title: "Recenter",
    prompt: "What brings you back to yourself when you feel scattered?",
    emotion: "Anxious",
    expansion: "Recentering is a return to your inner calm and core.",
    randomSeed: 0.686,
  },
  {
    id: "251",
    whisperType: "Anxious",
    title: "Safety Check",
    prompt: "What does safety look like for you right now?",
    emotion: "Anxious",
    expansion:
      "Reassure your nervous system-its okay to feel safe in your body.",
    randomSeed: 0.575,
  },
  {
    id: "250",
    whisperType: "Anxious",
    title: "Self Control",
    prompt: "What can you control in this moment, no matter how small?",
    emotion: "Anxious",
    expansion: "Even the smallest sense of control can help ease anxiety.",
    randomSeed: 0.464,
  },
];
const PROGRESSION_STAGES: ProgressionStage[] = [
  {
    id: "spark",
    name: "Spark",
    icon: "✨",
    meaning: "Your first glow appears in the forest.",
    criteria: {
      minReflections: 1,
      minMoods: 1,
      minStreakDays: 0,
      minDeepWrites: 0,
    },
    rewards: {
      badge: "Spark of Presence",
      message: "A single spark now glows in your forest.",
      visual: { fireflies: 2, glowIntensity: 1 },
    },
  },
  {
    id: "glimmer",
    name: "Glimmer",
    icon: "💫",
    meaning: "A gentle, steady light begins to form.",
    criteria: {
      minReflections: 3,
      minMoods: 2,
      minStreakDays: 0,
      minDeepWrites: 0,
    },
    rewards: {
      badge: "Glimmer of Awareness",
      message: "Your spark brightens into a steady glimmer.",
      visual: { fireflies: 4, glowIntensity: 1.5 },
    },
  },
  {
    id: "lantern",
    name: "Lantern",
    icon: "🏮",
    meaning: "Your light becomes a small beacon for the path.",
    criteria: {
      minReflections: 7,
      minMoods: 3,
      minStreakDays: 0,
      minDeepWrites: 1,
    },
    rewards: {
      badge: "Lantern of Insight",
      message: "Your light is now a lantern, guiding your steps.",
      visual: { fireflies: 6, glowIntensity: 2 },
    },
  },
  {
    id: "beacon",
    name: "Beacon",
    icon: "🌟",
    meaning: "Your consistency illuminates the way forward.",
    criteria: {
      minReflections: 15,
      minMoods: 4,
      minStreakDays: 3,
      minDeepWrites: 3,
    },
    rewards: {
      badge: "Beacon of Clarity",
      message: "Your lantern brightens, becoming a beacon.",
      visual: { fireflies: 9, glowIntensity: 2.5 },
    },
  },
  {
    id: "grove",
    name: "Grove",
    icon: "🌳",
    meaning: "You have cultivated a sanctuary of light.",
    criteria: {
      minReflections: 30,
      minMoods: 5,
      minStreakDays: 7,
      minDeepWrites: 7,
    },
    rewards: {
      badge: "Grove of Reflection",
      message: "A grove of light now thrives in your forest.",
      visual: { fireflies: 13, glowIntensity: 3.5 },
    },
  },
  {
    id: "canopy",
    name: "Canopy",
    icon: "🌌",
    meaning: "Your glow now reaches the highest branches.",
    criteria: {
      minReflections: 60,
      minMoods: 7,
      minStreakDays: 7,
      minDeepWrites: 15,
    },
    rewards: {
      badge: "Canopy of Wisdom",
      message: "Your light reaches the canopy, vast and bright.",
      visual: { fireflies: 18, glowIntensity: 4 },
    },
  },
  {
    id: "constellation",
    name: "Constellation",
    icon: "🌠",
    meaning: "Your inner light mirrors the stars above.",
    criteria: {
      minReflections: 100,
      minMoods: 8,
      minStreakDays: 14,
      minDeepWrites: 25,
    },
    rewards: {
      badge: "Constellation of Being",
      message: "Your forest glows, a constellation of inner peace.",
      visual: { fireflies: 24, glowIntensity: 5 },
    },
  },
];
const STRINGS = {
  onboarding: [
    {
      title: "Welcome to Espiritnu",
      body: "A quiet space to meet your emotions. Fireflies guide you inward—one whisper at a time.",
    },
    {
      title: "Receive a Whisper",
      body: "For each mood, a unique whisper appears. Let its gentle question nudge your reflection.",
    },
    {
      title: "Your Glow Grows",
      body: "As you reflect with care, your inner forest brightens in stages, revealing a calmer path.",
    },
  ],
  toastStageUnlock: "${stageName} — a new glow joins your path.",
  toastReflectionSaved: "Reflection saved. Your forest deepens.",
  toastAccountLinked: "Your progress is now secure.",
  nudgeSoftStreak: "A quiet moment awaits in your forest.",
  releaseAffirmation: "Releasing to welcome a new whisper.",
  emptySaved: "Your saved reflections will appear here as your glow grows.",
};

// WHISPERS & PROGRESSION: Logic
function getShownSet(mood: string): Set<string> {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(`espiritnu_shown_${mood}`) || "[]")
    );
  } catch {
    return new Set();
  }
}
function addToShownSet(mood: string, id: string) {
  const s = getShownSet(mood);
  s.add(id);
  localStorage.setItem(`espiritnu_shown_${mood}`, JSON.stringify([...s]));
}
function resetShownSet(mood: string) {
  localStorage.removeItem(`espiritnu_shown_${mood}`);
}
const MOOD_INDEX: Map<string, Whisper[]> = (() => {
  const e = new Map<string, Whisper[]>();
  for (const t of WHISPERS) {
    const o = (t.emotion || "").toLowerCase();
    if (!e.has(o)) e.set(o, []);
    e.get(o)?.push(t);
  }
  for (const t of e.values()) {
    // AFTER
    t.sort((e: Whisper, t: Whisper) => e.randomSeed - t.randomSeed);
  }
  return e;
})();
function getWhispersByMood(mood: string): Whisper[] {
  return MOOD_INDEX.get((mood || "").toLowerCase()) || [];
}
function pickNextWhisper(list: Whisper[], mood: string): Whisper | null {
  if (!list || 0 === list.length) return null;
  const t = getShownSet(mood);
  const o = list.filter((e) => !t.has(e.id));
  if (0 === o.length) {
    resetShownSet(mood);
    return list[Math.floor(Math.random() * list.length)];
  }
  const n = Math.floor(Math.random() * o.length);
  return o[n];
}
function calculateProgressionStats(reflections: Reflection[]): Stats {
  const totalReflections = reflections.length;
  const uniqueMoods = new Set(reflections.map((r) => r.whisperEmotion)).size;
  const deepWrites = reflections.filter(
    (r) => (r.entry || "").length > 180
  ).length;
  let longestStreak = 0;
  if (reflections.length > 0) {
    const dates = reflections
      .filter((r) => r.createdAt && typeof r.createdAt.toDate === "function")
      .map((r) => r.createdAt.toDate())
      .sort((a, b) => a.getTime() - b.getTime())
      .map((d) => d.toISOString().split("T")[0]);
    const uniqueDates = Array.from(new Set(dates));
    if (uniqueDates.length > 0) {
      let currentStreak = 1;
      longestStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const d1 = new Date(uniqueDates[i - 1]);
        const d2 = new Date(uniqueDates[i]);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1e3 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      }
    }
  }
  return { totalReflections, uniqueMoods, deepWrites, longestStreak };
}
function determineCurrentStage(stats: Stats): ProgressionStage {
  for (let i = PROGRESSION_STAGES.length - 1; i >= 0; i--) {
    const stage = PROGRESSION_STAGES[i];
    if (
      stats.totalReflections >= stage.criteria.minReflections &&
      stats.uniqueMoods >= stage.criteria.minMoods &&
      stats.longestStreak >= stage.criteria.minStreakDays &&
      stats.deepWrites >= stage.criteria.minDeepWrites
    )
      return stage;
  }
  return PROGRESSION_STAGES[0];
}

// --- UI COMPONENTS ---
const Toast = ({
  message,
  show,
  onDismiss,
}: {
  message: string;
  show: boolean;
  onDismiss: () => void;
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  return show ? (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] text-[var(--color-text)] px-6 py-3 rounded-full shadow-[var(--shadow-soft)] border border-[var(--color-surface-border)] animate-fadeIn">
      {message}
    </div>
  ) : null;
};

const ProgressionBadge = ({ stage }: { stage: ProgressionStage }) => (
  <div className="absolute top-6 left-6 flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-surface-border)] px-3 py-1.5 rounded-full text-sm animate-fadeIn">
    <span className="text-lg">{stage.icon}</span>
    <span className="font-semibold text-[var(--color-text)]">{stage.name}</span>
  </div>
);

const LinkAccountPrompt = ({ onLink }: { onLink: () => void }) => (
  <div className={`${CARD_SURFACE} max-w-none text-center mb-8 animate-fadeIn`}>
    <h3 className="text-xl font-lora font-bold text-[var(--color-text)] mb-2">
      Secure Your Progress
    </h3>
    <p className="text-base text-[var(--color-text-muted)] mb-6">
      Link an account to save your reflections permanently and access them on
      any device.
    </p>
    <button
      onClick={onLink}
      className={`${BTN_SECONDARY} py-3.5 flex items-center justify-center`}
    >
      <GoogleIcon /> Sign in with Google
    </button>
  </div>
);

// --- SCREENS ---
const AboutScreen = ({
  setCurrentScreen,
}: {
  setCurrentScreen: (screen: string) => void;
}) => {
  const DONATION_URL = "https://buymeacoffee.com/espiritnu";

  return (
    <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center animate-fadeIn">
      <div className={`${CARD_SURFACE} relative`}>
        <h2 className="text-3xl font-lora font-bold text-[var(--color-text)] mb-6">
          About Espiritnu
        </h2>

        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-4">
          Hi, I'm Emilie. I created Espiritnu from a simple belief: in a world
          that’s always asking for our attention, we all deserve a quiet space
          to simply be with our emotions.
        </p>

        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8">
          As a one-person project, my promise is to keep this a true
          sanctuary—always ad-free, private, and calm. If you find a moment of
          peace here, your support helps cover the costs to keep this space
          running and allows its journey to continue.
        </p>

        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_PRIMARY} flex items-center justify-center`}
        >
          ☕ Buy Me a Coffee
        </a>
      </div>

      <div className="mt-8 w-full max-w-sm">
        <button
          onClick={() => setCurrentScreen("MoodSelection")}
          className={BTN_SECONDARY}
        >
          Back to Moods
        </button>
      </div>
    </div>
  );
};

const OnboardingScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [slide, setSlide] = useState(0);
  const content = STRINGS.onboarding;

  const handleNext = () => {
    if (slide < content.length - 1) {
      setSlide(slide + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="w-full h-full p-6 flex flex-col justify-center items-center text-center animate-fadeIn">
      <div className={`${CARD_SURFACE} flex flex-col items-center`}>
        <h2 className="text-3xl font-lora font-bold text-[var(--color-text)] mb-4">
          {content[slide].title}
        </h2>
        <p className="text-lg text-[var(--color-text-muted)] leading-relaxed mb-8 h-20">
          {content[slide].body}
        </p>
        <div className="flex gap-2 mb-8">
          {content.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === slide
                  ? "bg-[var(--color-text)]"
                  : "bg-[var(--color-surface-border)]"
              }`}
            />
          ))}
        </div>
        <button onClick={handleNext} className={BTN_PRIMARY}>
          {slide < content.length - 1 ? "Next" : "Let's Begin"}
        </button>
      </div>
    </div>
  );
};

const LoginScreen = ({ auth }: { auth: any }) => {
  const handleLogin = async () => {
    if (!auth) return;
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Login failed", e);
    }
  };
  return (
    <div className="w-full h-full p-6 flex flex-col justify-center items-center text-center animate-fadeIn">
      <h1 className="text-5xl font-lora font-bold text-[var(--color-text)] mb-4">
        Espiritnu
      </h1>
      <p className="text-xl text-[var(--color-text-subtle)] mb-10">
        Your space for emotional clarity.
      </p>
      <GlowCTA onClick={handleLogin} className="max-w-sm">
        Begin Your Journey
      </GlowCTA>
    </div>
  );
};

const MoodSelectionScreen = ({
  setCurrentScreen,
  setSelectedMood,
  auth,
  currentStage,
}: {
  setCurrentScreen: (screen: string) => void;
  setSelectedMood: (mood: string) => void;
  auth: any;
  currentStage: ProgressionStage;
}) => {
  const moods = [
    "Anxious",
    "Frustrated",
    "Sad",
    "Hopeful",
    "Reflective",
    "Empowered",
    "Detached",
    "Openhearted",
  ];
  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    setCurrentScreen("WhisperReveal");
  };
  return (
    <div className="w-full h-full p-6 flex flex-col items-center animate-fadeIn">
      <ProgressionBadge stage={currentStage} />

      <button
        onClick={() => setCurrentScreen("About")}
        className="absolute top-6 right-6 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
        aria-label="About Espiritnu"
      >
        <HeartIcon />
      </button>

      <div className="flex-grow flex flex-col justify-center items-center">
        <h1 className="text-4xl font-lora font-bold text-[var(--color-text)] text-center mb-2">
          Espiritnu
        </h1>
        <p className="text-lg text-[var(--color-text-subtle)] text-center mb-8">
          How are you feeling in this moment?
        </p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => handleMoodSelect(mood)}
              className="bg-[var(--color-surface)] border border-[var(--color-surface-border)] backdrop-blur-lg rounded-2xl py-6 text-[var(--color-text)] text-base font-semibold hover:bg-white/15 transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-glow)]"
            >
              {mood}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => setCurrentScreen("SavedReflections")}
          className={`${BTN_PRIMARY} flex items-center justify-center`}
        >
          <ViewIcon /> View Saved Reflections
        </button>
        <button
          onClick={() => signOut(auth)}
          className={`${BTN_SECONDARY} flex items-center justify-center py-3.5`}
        >
          <LogoutIcon /> Logout
        </button>
      </div>
    </div>
  );
};

const WhisperRevealScreen = ({
  setCurrentScreen,
  mood,
  setSelectedWhisper,
}: {
  setCurrentScreen: (screen: string) => void;
  mood: string;
  setSelectedWhisper: (whisper: Whisper | null) => void;
}) => {
  const [whisper, setWhisper] = useState<Whisper | null>(null);
  const [showExpansion, setShowExpansion] = useState(false);
  const loadWhisper = () => {
    setShowExpansion(false);
    const list = getWhispersByMood(mood);
    const w = pickNextWhisper(list, mood);
    setWhisper(w);
  };
  useEffect(() => {
    loadWhisper();
  }, [mood]);
  const handleJournal = () => {
    setSelectedWhisper(whisper);
    setCurrentScreen("Journaling");
  };
  const handleRelease = () => {
    if (whisper) addToShownSet(mood, whisper.id);
    loadWhisper();
  };
  return (
    <div className="w-full h-full p-6 flex flex-col justify-center items-center animate-fadeIn">
      <p className="text-[var(--color-text-subtle)] text-lg font-medium mb-4">
        {mood}
      </p>
      {(() => {
        if (!whisper)
          return (
            <p className="text-lg text-[var(--color-text-muted)] text-center">
              No whispers for this mood yet.
            </p>
          );
        return (
          <div className={`${CARD_SURFACE} mb-8 animate-scaleIn`}>
            <h2 className="text-3xl font-lora font-bold text-[var(--color-text)] text-center mb-5">
              {whisper.title}
            </h2>
            <p className="text-lg text-[var(--color-text-muted)] text-center leading-relaxed mb-5">
              {whisper.prompt}
            </p>
            {whisper.expansion && (
              <>
                <button
                  onClick={() => setShowExpansion(!showExpansion)}
                  className="w-full text-[var(--color-accent)] font-bold text-center hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-glow)] rounded"
                >
                  {showExpansion ? "Show Less" : "Read More"}
                </button>
                {showExpansion && (
                  <p className="text-base text-[var(--color-text-subtle)] text-center leading-relaxed mt-4 animate-fadeIn">
                    {whisper.expansion}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}
      <div className="w-full max-w-sm space-y-4">
        <GlowCTA
          onClick={handleJournal}
          disabled={!whisper}
          className="max-w-sm flex items-center justify-center"
        >
          <WriteIcon /> Write a Reflection
        </GlowCTA>
        <button onClick={handleRelease} className={`${BTN_SECONDARY} max-w-sm`}>
          Release Whisper
        </button>
      </div>
    </div>
  );
};

const JournalingScreen = ({
  setCurrentScreen,
  whisper,
  db,
  user,
  mood,
  onSave,
}: {
  setCurrentScreen: (screen: string) => void;
  whisper: Whisper | null;
  db: any;
  user: User | null;
  mood: string;
  onSave: () => void;
}) => {
  const [entry, setEntry] = useState("");
  const saveReflection = async () => {
    if (entry.trim() === "" || !user || !whisper) return;
    try {
      await addDoc(collection(db, "users", user.uid, "reflections"), {
        createdAt: serverTimestamp(),
        whisperTitle: whisper.title,
        whisperPrompt: whisper.prompt,
        whisperEmotion: whisper.emotion || mood,
        whisperType: whisper.whisperType || null,
        entry: entry,
      });
      onSave();
      setCurrentScreen("SavedReflections");
    } catch (e) {
      console.error("Error saving reflection: ", e);
    }
  };
  return (
    <div className="w-full h-full p-6 flex flex-col items-center animate-fadeIn">
      <h2 className="text-2xl font-lora text-[var(--color-text)] text-center mb-2">
        Reflection on "{whisper?.title}"
      </h2>
      <p className="text-base text-[var(--color-text-subtle)] text-center mb-6">
        {whisper?.prompt}
      </p>
      <textarea
        className="w-full max-w-md h-72 bg-[var(--color-surface)] border border-[var(--color-surface-border)] backdrop-blur-lg rounded-2xl p-5 text-[var(--color-text)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] mb-8 shadow-lg"
        placeholder="Let your thoughts flow here..."
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
      />
      <div className="w-full max-w-md space-y-4">
        <button onClick={saveReflection} className={`${BTN_PRIMARY} max-w-md`}>
          Save Reflection
        </button>
        <button
          onClick={() => setCurrentScreen("WhisperReveal")}
          className={`${BTN_SECONDARY} max-w-md`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const SavedReflectionsScreen = ({
  reflections,
  setCurrentScreen,
  isAnonymous,
  onLinkAccount,
}: {
  reflections: Reflection[];
  setCurrentScreen: (screen: string) => void;
  isAnonymous: boolean;
  onLinkAccount: () => void;
}) => {
  return (
    <div className="w-full h-full flex flex-col">
      <h1 className="text-4xl font-lora font-bold text-[var(--color-text)] text-center my-8">
        Saved Reflections
      </h1>
      <div className="flex-grow overflow-y-auto px-6 pb-6">
        {isAnonymous && <LinkAccountPrompt onLink={onLinkAccount} />}
        {reflections.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-lg text-[var(--color-text-subtle)] text-center">
              {STRINGS.emptySaved}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reflections.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--color-surface)] border border-[var(--color-surface-border)] backdrop-blur-lg rounded-lg p-5 border-l-4 border-[var(--color-accent)] shadow-lg"
              >
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[var(--color-text-subtle)] mb-1">
                    {item.date}
                  </p>
                  {item.whisperType && (
                    <p className="text-xs text-[var(--color-text-subtle)] bg-[var(--color-surface)] px-2 py-0.5 rounded">
                      {item.whisperType}
                    </p>
                  )}
                </div>
                <h3 className="text-lg font-bold font-lora text-[var(--color-text)] mb-1">
                  {item.whisperTitle}
                </h3>
                <p className="text-base italic text-[var(--color-text-subtle)] mb-3">
                  "{item.whisperPrompt}"
                </p>
                <p className="text-base text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                  {item.entry}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 pb-8 pt-4">
        <button
          onClick={() => setCurrentScreen("MoodSelection")}
          className={`${BTN_SECONDARY} w-full max-w-md mx-auto`}
        >
          Back to Moods
        </button>
      </div>
    </div>
  );
};

// --- APP CONTAINER & NAVIGATION ---
// CORRECTED FIREBASE CONFIGURATION (Final Deployment Version)
const firebaseConfig = {
  apiKey: "AIzaSyCwmD9eLNGGjBUtTeq3cu946WiD35myVxc",
  authDomain: "espritnu.com", // <--- THIS IS THE CRITICAL CHANGE
  projectId: "espiritnu-470c7",
  storageBucket: "espiritnu-470c7.appspot.com", // FINAL CONFIGURATION 10/18/2025
  messagingSenderId: "923716152651",
  appId: "1:923716152651:web:f5f83543627b6babc34cce",
  measurementId: "G-CLHZ4KS5GK",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// THEME: helpers
// ...Your theme helpers and the main App component follow this block.

const BTN_PRIMARY =
  "w-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] py-4 rounded-full font-bold text-base hover:opacity-90 transition-opacity shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-glow)] glow-cta disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "w-full bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[var(--color-text-subtle)] py-4 rounded-full font-semibold text-base hover:bg-white/15 hover:text-[var(--color-text)] transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-glow)] disabled:opacity-50 disabled:cursor-not-allowed";
const CARD_SURFACE =
  "bg-[var(--color-surface)] border border-[var(--color-surface-border)] backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm shadow-[var(--shadow-soft)]";
function GlowCTA({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  return (
    <button
      {...props}
      className={`${BTN_PRIMARY} animate-[glowPulse_2.8s_ease-in-out_infinite] ${className}`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("Login");
  const [selectedMood, setSelectedMood] = useState("");
  const [selectedWhisper, setSelectedWhisper] = useState<Whisper | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [currentStage, setCurrentStage] = useState<ProgressionStage>(
    PROGRESSION_STAGES[0]
  );
  const [toast, setToast] = useState({ show: false, message: "" });
  const [hasOnboarded, setHasOnboarded] = useState(
    () => localStorage.getItem("espiritnu_has_onboarded") === "true"
  );
  const prevStageId = useRef(currentStage.id);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        if (hasOnboarded) {
          setCurrentScreen("MoodSelection");
        } else {
          setCurrentScreen("Onboarding");
        }
      } else {
        setCurrentScreen("Login");
      }
    });
    return () => unsubscribe();
  }, [hasOnboarded]);

  useEffect(() => {
    if (!user) {
      setReflections([]);
      return;
    }
    const q = query(
      collection(db, "users", user.uid, "reflections"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reflectionsData = snapshot.docs.map((doc) => {
        const data = doc.data() as Reflection;
        return {
          ...data,
          id: doc.id,
          date: data.createdAt?.toDate().toLocaleDateString() || "Just now",
        };
      });
      setReflections(reflectionsData);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const stats = calculateProgressionStats(reflections);
    const newStage = determineCurrentStage(stats);

    if (newStage && newStage.id !== prevStageId.current) {
      setCurrentStage(newStage);
      showToast(
        STRINGS.toastStageUnlock.replace("${stageName}", newStage.name)
      );
      prevStageId.current = newStage.id;
    } else if (reflections.length === 0) {
      setCurrentStage(PROGRESSION_STAGES[0]);
      prevStageId.current = PROGRESSION_STAGES[0].id;
    }
  }, [reflections]);

  const showToast = (message: string) => setToast({ show: true, message });

  const handleOnboardingFinish = () => {
    localStorage.setItem("espiritnu_has_onboarded", "true");
    setHasOnboarded(true);
    setCurrentScreen("Login");
  };

  const handleLinkAccount = async () => {
    if (!auth.currentUser) return;
    const provider = new GoogleAuthProvider();
    try {
      await linkWithPopup(auth.currentUser, provider);
      showToast(STRINGS.toastAccountLinked);
    } catch (error) {
      console.error("Error linking account:", error);
    }
  };

  const renderContent = () => {
    if (!isAuthReady)
      return (
        <div className="flex h-full w-full items-center justify-center text-[var(--color-text)] font-lora text-xl">
          Connecting...
        </div>
      );

    if (!hasOnboarded && !user)
      return <OnboardingScreen onFinish={handleOnboardingFinish} />;

    if (!user) return <LoginScreen auth={auth} />;

    switch (currentScreen) {
      case "About":
        return <AboutScreen setCurrentScreen={setCurrentScreen} />;

      case "MoodSelection":
        return (
          <MoodSelectionScreen
            setCurrentScreen={setCurrentScreen}
            setSelectedMood={setSelectedMood}
            auth={auth}
            currentStage={currentStage}
          />
        );
      case "WhisperReveal":
        return (
          <WhisperRevealScreen
            setCurrentScreen={setCurrentScreen}
            mood={selectedMood}
            setSelectedWhisper={setSelectedWhisper}
          />
        );
      case "Journaling":
        return (
          <JournalingScreen
            setCurrentScreen={setCurrentScreen}
            whisper={selectedWhisper}
            db={db}
            user={user}
            mood={selectedMood}
            onSave={() => showToast(STRINGS.toastReflectionSaved)}
          />
        );
      case "SavedReflections":
        return (
          <SavedReflectionsScreen
            reflections={reflections}
            setCurrentScreen={setCurrentScreen}
            isAnonymous={user.isAnonymous}
            onLinkAccount={handleLinkAccount}
          />
        );
      default:
        return (
          <MoodSelectionScreen
            setCurrentScreen={setCurrentScreen}
            setSelectedMood={setSelectedMood}
            auth={auth}
            currentStage={currentStage}
          />
        );
    }
  };

  const visualRewards = currentStage.rewards.visual;

  return (
    <main className="w-screen h-screen relative flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]">
      <GlobalStyles />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(900px 700px at 78% 20%, rgba(139,167,45,${
              0.1 * visualRewards.glowIntensity
            }), transparent 60%),
            radial-gradient(700px 600px at 22% 80%, rgba(139,167,45,${
              0.07 * visualRewards.glowIntensity
            }), transparent 60%),
            radial-gradient(1000px 1000px at 50% 50%, rgba(255,255,255,0.04), transparent 70%)
          `,
        }}
      />
      <FirefliesLayer additionalCount={visualRewards.fireflies} />
      <div className="relative w-full h-full md:w-[400px] md:h-[800px] md:rounded-3xl md:shadow-2xl md:overflow-hidden">
        <div className="w-full h-full overflow-y-auto">{renderContent()}</div>
        <Toast
          message={toast.message}
          show={toast.show}
          onDismiss={() => setToast({ show: false, message: "" })}
        />
      </div>
    </main>
  );
}
