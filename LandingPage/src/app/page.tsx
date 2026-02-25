"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, useScroll, useTransform, AnimatePresence, useInView } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { MODULES, FEATURES, DEMO_CONVERSATIONS } from "@/lib/data";

// ============================================
// BOOT SEQUENCE — Full-screen loading animation
// ============================================

const BOOT_LINES = [
  { text: "> NEXUS CORE v3.8.0", delay: 0 },
  { text: "> Initializing subsystems...", delay: 200 },
  { text: "> Loading 39 modules...", delay: 500 },
  { text: "> Mapping 370 command routes...", delay: 900 },
  { text: "> Connecting to Discord API...", delay: 1300 },
  { text: "> Shard 0 — ONLINE", delay: 1700, color: "var(--hud-green)" },
  { text: "> All systems nominal.", delay: 2000, color: "var(--hud-green)" },
  { text: "> NEXUS READY.", delay: 2400, color: "var(--hud-cyan)" },
];

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(i + 1);
        setProgress(((i + 1) / BOOT_LINES.length) * 100);
      }, line.delay);
    });
    setTimeout(onComplete, 3200);
  }, [onComplete]);

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] bg-[var(--hud-bg)] flex items-center justify-center"
    >
      <div className="w-full max-w-lg px-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block text-5xl font-black neon-text font-mono tracking-widest">
            NEXUS
          </div>
        </div>

        {/* Terminal output */}
        <div className="terminal p-4 mb-6 min-h-[220px]">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-mono text-xs leading-6"
              style={{ color: line.color || "var(--hud-dim)" }}
            >
              {line.text}
            </motion.div>
          ))}
          {visibleLines < BOOT_LINES.length && (
            <span className="inline-block w-2 h-4 bg-[var(--hud-cyan)] animate-typing-blink" />
          )}
        </div>

        {/* Progress bar */}
        <div className="xp-bar">
          <motion.div
            className="xp-bar-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-[var(--hud-dim)]">
          <span>SYSTEM BOOT</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// 3D HERO SCENE — Holographic Core
// ============================================

function HoloCore() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);

  useFrame((state: { clock: THREE.Clock }) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    ringRef.current.rotation.x = t * 0.5;
    ringRef.current.rotation.z = t * 0.2;
    ring2Ref.current.rotation.y = t * 0.4;
    ring2Ref.current.rotation.z = -t * 0.3;
  });

  return (
    <group>
      {/* Central icosahedron */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[1.2, 1]} />
          <MeshDistortMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={0.4}
            roughness={0.2}
            metalness={0.8}
            wireframe
            distort={0.2}
            speed={2}
          />
        </mesh>
      </Float>

      {/* Orbital ring 1 */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2, 0.01, 16, 100]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.3} />
      </mesh>

      {/* Orbital ring 2 */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.5, 0.008, 16, 100]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.2} />
      </mesh>

      {/* Orbiting particles */}
      {Array.from({ length: 40 }).map((_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const radius = 2 + Math.random() * 1.5;
        const y = (Math.random() - 0.5) * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#00f0ff" : i % 3 === 1 ? "#a855f7" : "#ffffff"} />
          </mesh>
        );
      })}

      {/* Ambient light */}
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#00f0ff" />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#a855f7" />
    </group>
  );
}

function HeroScene() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <Suspense fallback={null}>
          <HoloCore />
        </Suspense>
      </Canvas>
    </div>
  );
}

// ============================================
// HUD OVERLAY ELEMENTS
// ============================================

function HudCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const styles: Record<string, string> = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2",
  };
  return <div className={`absolute w-6 h-6 border-[var(--hud-cyan)] ${styles[position]}`} />;
}

function HudFrame({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={`relative ${className}`}>
      <HudCorner position="tl" />
      <HudCorner position="tr" />
      <HudCorner position="bl" />
      <HudCorner position="br" />
      {label && (
        <div className="absolute -top-3 left-8 px-2 bg-[var(--hud-bg)] text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-[0.2em]">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function DataReadout({ label, value, color = "var(--hud-cyan)" }: { label: string; value: string; color?: string }) {
  return (
    <div className="font-mono text-[11px]">
      <span className="text-[var(--hud-dim)] uppercase tracking-wider">{label}</span>
      <div className="text-lg font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

// ============================================
// HERO SECTION
// ============================================

function Hero() {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden hex-grid">
      {/* 3D Scene */}
      <HeroScene />

      {/* Radial fade */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_30%,var(--hud-bg)_70%)] pointer-events-none" />

      {/* HUD Overlay */}
      <div className="relative z-10 text-center max-w-4xl px-6">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded border border-[var(--hud-border)] bg-[var(--hud-bg-panel)] backdrop-blur mb-8 font-mono text-xs"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--hud-green)] shadow-[0_0_8px_var(--hud-green)]" />
          <span className="text-[var(--hud-green)]">SYSTEM ONLINE</span>
          <span className="text-[var(--hud-dim)]">&bull;</span>
          <span className="text-[var(--hud-dim)]">39 MODULES ACTIVE</span>
          <span className="text-[var(--hud-dim)]">&bull;</span>
          <span className="text-[var(--hud-dim)]">370 COMMANDS LOADED</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight mb-6"
        >
          <span className="glitch-text-hover neon-text font-mono">NEXUS</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xl text-[var(--hud-dim)] font-mono mb-2"
        >
          [ THE ALL-IN-ONE DISCORD BOT ]
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-base text-[var(--hud-dim)] max-w-xl mx-auto mb-10"
        >
          39 modules. 370+ commands. One bot to rule them all. Stop juggling 10 bots &mdash; deploy Nexus.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a href={INVITE_URL} className="group relative px-8 py-3.5 font-mono font-bold text-black bg-[var(--hud-cyan)] rounded hover:shadow-[0_0_30px_var(--hud-cyan-glow)] transition-all flex items-center gap-3 justify-center">
            <span className="absolute inset-0 rounded bg-[var(--hud-cyan)] animate-pulse-ring opacity-0 group-hover:opacity-100" />
            <span className="relative z-10 flex items-center gap-3">
              ADD TO DISCORD
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </span>
          </a>
          <a href={DASHBOARD_URL} className="px-8 py-3.5 font-mono font-bold border border-[var(--hud-purple)] text-[var(--hud-purple)] rounded hover:bg-[rgba(168,85,247,0.1)] transition-all text-center">
            OPEN DASHBOARD
          </a>
          <a href="#terminal" className="px-8 py-3.5 font-mono font-bold border border-[var(--hud-border)] text-[var(--hud-dim)] rounded hover:text-white hover:border-[var(--hud-cyan)] transition-all text-center">
            TRY COMMANDS
          </a>
        </motion.div>
      </div>

      {/* Bottom HUD readouts */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between z-10">
        <div className="flex gap-8">
          <DataReadout label="modules" value="39" />
          <DataReadout label="commands" value="370" />
        </div>
        <div className="flex gap-8">
          <DataReadout label="uptime" value="99.9%" color="var(--hud-green)" />
          <DataReadout label="latency" value="42ms" color="var(--hud-green)" />
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--hud-dim)] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-[var(--hud-cyan)] to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ============================================
// STATS HUD BAR
// ============================================

function AnimatedStat({ value, label, suffix = "", color = "var(--hud-cyan)" }: { value: number; label: string; suffix?: string; color?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const dur = 2000;
    const steps = 60;
    const inc = value / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= value) { setCount(value); clearInterval(t); }
      else setCount(Math.floor(cur));
    }, dur / steps);
    return () => clearInterval(t);
  }, [inView, value]);

  const pct = Math.min((count / value) * 100, 100);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-black font-mono" style={{ color }}>
        {value % 1 !== 0 ? count.toFixed(1) : count}{suffix}
      </div>
      <div className="xp-bar mt-2 mb-1">
        <div className="xp-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] font-mono text-[var(--hud-dim)] uppercase tracking-widest">{label}</div>
    </div>
  );
}

function StatsHud() {
  return (
    <section className="relative py-16 scan-line-container">
      <div className="max-w-5xl mx-auto px-6">
        <HudFrame label="SYSTEM TELEMETRY" className="p-8 border border-[var(--hud-border)] bg-[var(--hud-bg-panel)] backdrop-blur">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <AnimatedStat value={39} label="Modules" />
            <AnimatedStat value={370} label="Commands" suffix="+" />
            <AnimatedStat value={150} label="Features" suffix="+" color="var(--hud-purple)" />
            <AnimatedStat value={99.9} label="Uptime" suffix="%" color="var(--hud-green)" />
          </div>
        </HudFrame>
      </div>
    </section>
  );
}

// ============================================
// FEATURE SHOWCASE — Achievement-style scroll reveal
// ============================================

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isEven ? -60 : 60 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.1 }}
      className={`grid md:grid-cols-2 gap-8 items-center ${!isEven ? "md:direction-rtl" : ""}`}
    >
      {/* Text side */}
      <div className={!isEven ? "md:order-2 md:text-left" : ""} style={{ direction: "ltr" }}>
        {/* Achievement unlock header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl neon-box" style={{ borderColor: feature.color, boxShadow: `0 0 15px ${feature.color}40` }}>
            {feature.demoType === "moderation" ? "\u{1F6E1}\uFE0F" : feature.demoType === "leveling" ? "\u2B50" : feature.demoType === "music" ? "\u{1F3B5}" : feature.demoType === "economy" ? "\u{1F4B0}" : "\u{1F3AB}"}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: feature.color }}>
              ACTIVE MODULE
            </div>
            <div className="text-xl font-bold">{feature.title}</div>
          </div>
        </div>

        <p className="text-[var(--hud-dim)] text-sm leading-relaxed mb-6">{feature.description}</p>

        <div className="grid grid-cols-2 gap-2">
          {feature.highlights.map((h) => (
            <div key={h} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-1 h-1 rounded-full" style={{ background: feature.color, boxShadow: `0 0 6px ${feature.color}` }} />
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Demo side */}
      <div className={!isEven ? "md:order-1" : ""} style={{ direction: "ltr" }}>
        <FeatureDemo demoType={feature.demoType} color={feature.color} />
      </div>
    </motion.div>
  );
}

function FeatureDemo({ demoType, color }: { demoType: string; color: string }) {
  const conv = DEMO_CONVERSATIONS.find((c) => c.id === demoType);
  if (!conv) return null;

  return (
    <HudFrame className="p-4 border border-[var(--hud-border)] bg-[rgba(0,5,15,0.9)]">
      <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--hud-dim)] mb-3 pb-2 border-b border-[var(--hud-border)]">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[var(--hud-cyan)]">#</span> general
      </div>
      {conv.messages.map((msg, i) => (
        <div key={i} className="flex gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: msg.avatar }}>
            {msg.author[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: msg.isBot ? "var(--hud-cyan)" : "#fff" }}>{msg.author}</span>
              {msg.isBot && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[var(--discord-blurple)] text-white">BOT</span>}
            </div>
            {msg.content && <div className={`text-xs ${msg.isCommand ? "text-[var(--hud-dim)] font-mono" : msg.isButton ? "text-[var(--hud-cyan)] italic" : "text-gray-300"}`}>{msg.content}</div>}
            {msg.embed && (
              <div className="mt-1 rounded overflow-hidden max-w-xs" style={{ borderLeft: `3px solid ${msg.embed.color}` }}>
                <div className="bg-[rgba(30,30,50,0.8)] p-2.5">
                  <div className="text-xs font-semibold text-white mb-1.5">{msg.embed.title}</div>
                  {msg.embed.fields.map((f, j) => (
                    <div key={j} className="flex gap-2 text-[11px] leading-5">
                      <span className="text-[var(--hud-dim)]">{f.name}:</span>
                      <span className="text-white">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </HudFrame>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="relative py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-20">
          <div className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-[0.3em] mb-3">// CORE FEATURES</div>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="neon-text">Feature</span> Overview
          </h2>
        </motion.div>

        <div className="space-y-24">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.demoType} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// INTERACTIVE TERMINAL — Live command playground
// ============================================

const TERMINAL_COMMANDS: Record<string, { response: string; color?: string }> = {
  // Meta commands
  "help": { response: "Available commands:\n  help        Show this message\n  modules     List all modules\n  stats       Show system status\n  clear       Clear terminal\n\nOr type a module name (e.g. moderation, music, fun) to see its commands." },
  "modules": { response: "[\u2713] Moderation (45 cmds)  [\u2713] Fun (36 cmds)       [\u2713] Music (27 cmds)\n[\u2713] ColorRoles (25 cmds) [\u2713] Tickets (18 cmds)   [\u2713] Leveling (13 cmds)\n[\u2713] Giveaways (13 cmds)  [\u2713] Currency (12 cmds)  [\u2713] AutoMod (12 cmds)\n[\u2713] TempVoice (11 cmds)  [\u2713] Welcome (10 cmds)   [\u2713] ...27 more", color: "var(--hud-green)" },
  "stats": { response: "NEXUS SYSTEM STATUS\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nModules:  39 loaded\nCommands: 370 registered\nUptime:   99.9%\nLatency:  42ms\nShards:   1 active", color: "var(--hud-green)" },

  // Module lookups — flat subcommand structure
  "moderation": { response: "/mod ban, unban, tempban, kick, softban, mute, unmute,\n     warn, unwarn, warnings, clearwarnings, purge, purgeuser,\n     purgebot, purgehuman, slowmode, lock, unlock, lockdown,\n     unlockdown, nuke, nickname, role, userinfo\n/modlog case, modstats, history, note, notes, massban,\n        massmute, mutelist, banlist, serverwarns, bulkdelete...\n(45 commands total)", color: "var(--hud-red)" },
  "mod": { response: "/mod ban, unban, tempban, kick, softban, mute, unmute,\n     warn, unwarn, warnings, clearwarnings, purge, purgeuser,\n     purgebot, purgehuman, slowmode, lock, unlock, lockdown,\n     unlockdown, nuke, nickname, role, userinfo\n(24 commands)", color: "var(--hud-red)" },
  "modlog": { response: "/modlog case, modstats, history, note, notes, massban,\n        massmute, mutelist, banlist, serverwarns, bulkdelete,\n        quarantine, unquarantine, shadowban, unshadowban,\n        altdetect, watchlist, addreputation, removereputation,\n        setreputation, reputationhistory\n(21 commands)", color: "var(--hud-red)" },
  "fun": { response: "/fun trivia, rps, coinflip, 8ball, roll, slots, blackjack,\n     connect4, tictactoe, wordle, wouldyourather,\n     meme, joke, fact, quote, dog, cat, roast, compliment, config\n/social hug, pat, slap, kiss, highfive, bite, punch, kick...\n(36 commands total)", color: "var(--hud-purple)" },
  "social": { response: "/social hug, pat, slap, kiss, highfive, bite, punch,\n        kick, laugh, cry, pout, wave, dance, boop, cuddle, poke\n(16 commands)", color: "var(--hud-purple)" },
  "music": { response: "/music play, forceplay, pause, resume, skip, stop, previous,\n       seek, nowplaying, autoplay, filters, volume, voteskip,\n       lyrics, songinfo, queue, clear, loop, move, remove,\n       shuffle, skipto, djrole, musicconfig\n/playlist favorites, playlist, serverplaylist\n(27 commands total)", color: "var(--hud-purple)" },
  "playlist": { response: "/playlist favorites, playlist, serverplaylist\n(3 commands)", color: "var(--hud-purple)" },
  "leveling": { response: "/leveling rank, leaderboard, xp, setlevel, setxp,\n           resetxp, rewards, doublexp, xpsettings,\n           levelroles, rankcardconfig, ignore, unignore\n(13 commands)", color: "var(--hud-yellow)" },
  "economy": { response: "/currency daily, work, balance, pay, deposit, withdraw,\n           rob, gamble, slots, leaderboard, shop, inventory\n(12 commands)", color: "var(--hud-green)" },
  "currency": { response: "/currency daily, work, balance, pay, deposit, withdraw,\n           rob, gamble, slots, leaderboard, shop, inventory\n(12 commands)", color: "var(--hud-green)" },
  "tickets": { response: "/tickets open, close, add, remove, rename, claim,\n          transcript, panel, category, priority, topic,\n          reopen, delete, list, setup, settings, stats, archive\n(18 commands)", color: "var(--hud-cyan)" },
  "giveaways": { response: "/giveaways create, end, reroll, delete, list, pause,\n             resume, edit, winners, requirements, schedule,\n             template, settings\n(13 commands)", color: "var(--hud-yellow)" },
  "welcome": { response: "/welcome setup, message, channel, testrole, testmessage,\n          toggle, autorole, dmgreeting, leavemessage, settings\n(10 commands)", color: "var(--hud-cyan)" },
  "automod": { response: "/automod antispam, antiraid, wordfilter, linkfilter,\n          capsfilter, emojifilter, mentionfilter, invitefilter,\n          settings, whitelist, log, toggle\n(12 commands)", color: "var(--hud-red)" },
  "shop": { response: "/shop view, buy, sell, create, delete, edit, restock, inventory\n(8 commands)", color: "var(--hud-green)" },
  "reputation": { response: "/reputation give, remove, check, leaderboard,\n              reset, settings, history, top\n(8 commands)", color: "var(--hud-yellow)" },

  // Individual command shortcuts
  "ban": { response: "/mod ban <user> [reason] [duration]\n  Bans a user from the server. Supports temp-bans.\n  Requires: BAN_MEMBERS permission", color: "var(--hud-red)" },
  "kick": { response: "/mod kick <user> [reason]\n  Kicks a user from the server.\n  Requires: KICK_MEMBERS permission", color: "var(--hud-red)" },
  "mute": { response: "/mod mute <user> [duration] [reason]\n  Timeouts a user, preventing them from chatting.\n  Requires: MODERATE_MEMBERS permission", color: "var(--hud-red)" },
  "play": { response: "/music play <query>\n  Plays a track from YouTube, Spotify, or SoundCloud.\n  Supports playlists, live streams, and direct URLs.", color: "var(--hud-purple)" },
  "skip": { response: "/music skip\n  Skips the currently playing track.", color: "var(--hud-purple)" },
  "rank": { response: "/leveling rank [user]\n  Shows your level, XP, rank position, and next level role.\n  Features custom rank cards with avatar and progress bar.", color: "var(--hud-yellow)" },
  "daily": { response: "/currency daily\n  Claim your daily reward. Streaks give bonus coins!\n  Current streak multiplier: up to 2x.", color: "var(--hud-green)" },
};

function InteractiveTerminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<{ type: "input" | "output"; text: string; color?: string }[]>([
    { type: "output", text: "NEXUS TERMINAL v3.8.0 \u2014 Type 'help' for commands", color: "var(--hud-cyan)" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Normalize: strip leading slash, collapse whitespace, lowercase
    const raw = input.trim().toLowerCase().replace(/^\/+/, "").replace(/\s+/g, " ");

    if (raw === "clear") {
      setHistory([{ type: "output", text: "NEXUS TERMINAL v3.8.0 \u2014 Type 'help' for commands", color: "var(--hud-cyan)" }]);
      setInput("");
      return;
    }

    const newHistory = [...history, { type: "input" as const, text: `> ${input}` }];

    // Try exact match first
    let match = TERMINAL_COMMANDS[raw];

    // If no exact match, try matching the first word (e.g. "/mod ban ban" → "mod" → "moderation")
    if (!match) {
      const words = raw.split(" ");
      const first = words[0];

      // Map common command prefixes to their terminal lookup key
      const ALIASES: Record<string, string> = {
        mod: "mod", moderation: "moderation",
        modlog: "modlog", cases: "modlog", case: "modlog",
        fun: "fun", games: "fun",
        social: "social", hug: "social", pat: "social",
        music: "music", play: "play", pause: "music", skip: "skip", queue: "music",
        playlist: "playlist",
        level: "leveling", leveling: "leveling", xp: "leveling", rank: "rank",
        econ: "economy", economy: "economy", currency: "currency", daily: "daily",
        ticket: "tickets", tickets: "tickets",
        give: "giveaways", giveaway: "giveaways", giveaways: "giveaways",
        welcome: "welcome",
        automod: "automod",
        shop: "shop",
        rep: "reputation", reputation: "reputation",
        ban: "ban", kick: "kick", mute: "mute",
        help: "help", modules: "modules", stats: "stats",
        colorroles: "leveling", colorrole: "leveling",
        tempvoice: "music",
      };

      // Try the first word as an alias
      const aliased = ALIASES[first];
      if (aliased) {
        match = TERMINAL_COMMANDS[aliased];
      }

      // If still no match, try finding any key that starts with the input
      if (!match) {
        const key = Object.keys(TERMINAL_COMMANDS).find(
          (k) => k.startsWith(first) || first.startsWith(k)
        );
        if (key) match = TERMINAL_COMMANDS[key];
      }
    }

    if (match) {
      newHistory.push({ type: "output", text: match.response, color: match.color });
    } else {
      newHistory.push({ type: "output", text: `Unknown command: "${raw}". Try 'help' or type a module name like 'moderation', 'music', 'fun'.`, color: "var(--hud-red)" });
    }

    setHistory(newHistory);
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [input, history]);

  return (
    <section id="terminal" className="relative py-24">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <div className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-[0.3em] mb-3">// LIVE TERMINAL</div>
          <h2 className="text-4xl font-black mb-3">
            <span className="neon-text">Try</span> It Yourself
          </h2>
          <p className="text-sm text-[var(--hud-dim)] font-mono">
            Try: help, modules, moderation, music, fun, leveling, ban, play...
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <HudFrame label="NEXUS TERMINAL" className="border border-[var(--hud-border)]">
            {/* Terminal header */}
            <div className="terminal-header">
              <div className="terminal-dot bg-[var(--hud-red)]" />
              <div className="terminal-dot bg-[var(--hud-yellow)]" />
              <div className="terminal-dot bg-[var(--hud-green)]" />
              <span className="text-[10px] font-mono text-[var(--hud-dim)] ml-2">nexus@bot:~</span>
            </div>

            {/* Terminal body */}
            <div className="p-4 h-72 overflow-y-auto font-mono text-xs leading-6" style={{ background: "rgba(0,5,15,0.95)" }}>
              {history.map((line, i) => (
                <div key={i} style={{ color: line.type === "input" ? "#fff" : (line.color || "var(--hud-dim)") }} className="whitespace-pre-wrap">
                  {line.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center border-t border-[var(--hud-border)]" style={{ background: "rgba(0,5,15,0.95)" }}>
              <span className="pl-4 text-[var(--hud-cyan)] font-mono text-sm">&gt;</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent text-white font-mono text-sm px-2 py-3 outline-none"
                placeholder="Type a command..."
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="px-4 py-3 text-[var(--hud-cyan)] font-mono text-xs hover:bg-[var(--hud-cyan-glow)] transition-colors">
                EXEC
              </button>
            </form>
          </HudFrame>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// MODULE GRID — Achievement Collection
// ============================================

function ModuleGrid() {
  const [activeCategory, setActiveCategory] = useState("all");
  const categories = ["all", "moderation", "engagement", "fun", "economy", "utility", "social"];

  const filtered = activeCategory === "all" ? MODULES : MODULES.filter((m) => m.category === activeCategory);

  return (
    <section id="modules" className="relative py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <div className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-[0.3em] mb-3">// ALL MODULES</div>
          <h2 className="text-4xl font-black mb-2">
            <span className="neon-text">39</span> Modules Loaded
          </h2>
          <p className="text-sm text-[var(--hud-dim)] font-mono">Everything your server needs. Select a category to filter.</p>
        </motion.div>

        {/* Category filter — HUD style */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded text-xs font-mono uppercase tracking-wider transition-all ${
                activeCategory === cat
                  ? "bg-[var(--hud-cyan)] text-black font-bold shadow-[0_0_15px_var(--hud-cyan-glow)]"
                  : "border border-[var(--hud-border)] text-[var(--hud-dim)] hover:text-white hover:border-[var(--hud-cyan)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((mod) => (
              <motion.div
                key={mod.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="achievement-card rounded-lg p-4 border border-[var(--hud-border)] bg-[var(--hud-bg-panel)] backdrop-blur cursor-default"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl">{mod.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{mod.name}</h3>
                    <span className="text-[9px] font-mono text-[var(--hud-cyan)] uppercase tracking-wider">
                      {mod.commandCount} CMD
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--hud-dim)] leading-relaxed">{mod.description}</p>
                <div className="xp-bar mt-3">
                  <div className="xp-bar-fill" style={{ width: `${Math.min((mod.commandCount / 45) * 100, 100)}%` }} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// DEPLOY CTA
// ============================================

function DeployCTA() {
  return (
    <section className="relative py-32 overflow-hidden scan-line-container">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,240,255,0.06),transparent_60%)]" />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <div className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-[0.3em] mb-6">// READY TO GO</div>
          <h2 className="text-5xl sm:text-6xl font-black font-mono mb-6">
            <span className="glitch-text-hover neon-text">GET STARTED</span>
          </h2>
          <p className="text-[var(--hud-dim)] font-mono text-sm mb-10 max-w-lg mx-auto">
            One click. 39 modules. 370+ commands. Your server, upgraded.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={INVITE_URL} className="group relative inline-flex items-center gap-3 px-12 py-5 font-mono font-bold text-lg text-black bg-[var(--hud-cyan)] rounded hover:shadow-[0_0_40px_var(--hud-cyan-glow)] transition-all">
              <span className="absolute inset-0 rounded bg-[var(--hud-cyan)] animate-pulse-ring opacity-0 group-hover:opacity-100" />
              <span className="relative z-10 flex items-center gap-3">
                ADD TO DISCORD
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </span>
            </a>
            <a href={DASHBOARD_URL} className="inline-flex items-center gap-3 px-12 py-5 font-mono font-bold text-lg border border-[var(--hud-purple)] text-[var(--hud-purple)] rounded hover:bg-[rgba(168,85,247,0.1)] transition-all">
              OPEN DASHBOARD
            </a>
          </div>

          <div className="mt-8 text-[10px] font-mono text-[var(--hud-dim)]">
            FREE FOREVER &bull; NO CREDIT CARD &bull; PREMIUM OPTIONAL
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer() {
  return (
    <footer className="border-t border-[var(--hud-border)] py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <span className="font-mono font-bold text-[var(--hud-cyan)]">NEXUS</span>
            <p className="text-[11px] text-[var(--hud-dim)] mt-2 leading-relaxed">
              The ultimate all-in-one Discord bot. 39 modules. 370+ commands.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-widest mb-3">Product</h4>
            <div className="space-y-1.5 text-xs text-[var(--hud-dim)]">
              <a href="#features" className="block hover:text-white transition-colors">Features</a>
              <a href="#modules" className="block hover:text-white transition-colors">Modules</a>
              <a href="#" className="block hover:text-white transition-colors">Premium</a>
              <a href="#" className="block hover:text-white transition-colors">Status</a>
            </div>
          </div>
          <div>
            <h4 className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-widest mb-3">Resources</h4>
            <div className="space-y-1.5 text-xs text-[var(--hud-dim)]">
              <a href="#" className="block hover:text-white transition-colors">Docs</a>
              <a href="#" className="block hover:text-white transition-colors">Commands</a>
              <a href="#" className="block hover:text-white transition-colors">Support</a>
            </div>
          </div>
          <div>
            <h4 className="text-[10px] font-mono text-[var(--hud-cyan)] uppercase tracking-widest mb-3">Legal</h4>
            <div className="space-y-1.5 text-xs text-[var(--hud-dim)]">
              <a href="#" className="block hover:text-white transition-colors">Terms</a>
              <a href="#" className="block hover:text-white transition-colors">Privacy</a>
            </div>
          </div>
        </div>
        <div className="pt-6 border-t border-[var(--hud-border)] flex justify-between items-center">
          <span className="text-[10px] font-mono text-[var(--hud-dim)]">&copy; 2026 NEXUS BOT // ALL RIGHTS RESERVED</span>
          <div className="flex gap-4">
            <a href="https://github.com/G-tare/Bot-2026" className="text-[var(--hud-dim)] hover:text-[var(--hud-cyan)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// NAV — Minimal HUD style
// ============================================

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[var(--hud-bg-panel)] backdrop-blur-xl border-b border-[var(--hud-border)]" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-mono font-bold text-[var(--hud-cyan)] tracking-widest text-sm">NEXUS</span>
        <div className="hidden md:flex items-center gap-6 text-xs font-mono text-[var(--hud-dim)]">
          <a href="#features" className="hover:text-[var(--hud-cyan)] transition-colors">FEATURES</a>
          <a href="#terminal" className="hover:text-[var(--hud-cyan)] transition-colors">TERMINAL</a>
          <a href="#modules" className="hover:text-[var(--hud-cyan)] transition-colors">MODULES</a>
          <a href={DASHBOARD_URL} className="hover:text-[var(--hud-purple)] text-[var(--hud-purple)] transition-colors">DASHBOARD</a>
        </div>
        <div className="flex items-center gap-3">
          <a href={DASHBOARD_URL} className="hidden sm:block px-4 py-1.5 rounded text-xs font-mono font-bold border border-[var(--hud-purple)] text-[var(--hud-purple)] hover:bg-[rgba(168,85,247,0.1)] transition-all">
            DASHBOARD
          </a>
          <a href={INVITE_URL} className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-[var(--hud-cyan)] text-black hover:shadow-[0_0_15px_var(--hud-cyan-glow)] transition-all">
            ADD BOT
          </a>
        </div>
      </div>
    </nav>
  );
}

// ============================================
// CONSTANTS
// ============================================

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1475529392963981333&permissions=8&scope=bot%20applications.commands";
const DASHBOARD_URL = "/dashboard";

// App download links — update these when builds are published
const APP_LINKS: Record<string, { label: string; icon: string; url: string }> = {
  mac:     { label: "Download for Mac",     icon: "\uF8FF",       url: "#download-mac" },
  windows: { label: "Download for Windows", icon: "\u{1FAA0}",    url: "#download-windows" },
  iphone:  { label: "Get the iPhone App",   icon: "\u{1F4F1}",    url: "#download-ios" },
  android: { label: "Get the Android App",  icon: "\u{1F4F1}",    url: "#download-android" },
};

// ============================================
// DEVICE DETECTION BANNER
// ============================================

function detectPlatform(): string | null {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "iphone";
  if (/android/.test(ua)) return "android";
  if (/macintosh|mac os x/.test(ua)) return "mac";
  if (/windows/.test(ua)) return "windows";
  return null;
}

function AppBanner() {
  const [platform, setPlatform] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!platform || dismissed || !APP_LINKS[platform]) return null;

  const app = APP_LINKS[platform];

  return (
    <motion.div
      initial={{ y: 60, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: 60, opacity: 0, x: "-50%" }}
      transition={{ delay: 2, duration: 0.4 }}
      className="fixed bottom-6 left-1/2 z-[60] flex items-center gap-4 px-5 py-3 rounded-lg border border-[var(--hud-purple)] bg-[var(--hud-bg-panel)] backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.15)]"
    >
      <span className="text-lg">{app.icon}</span>
      <div className="text-xs">
        <div className="text-white font-semibold">{app.label}</div>
        <div className="text-[var(--hud-dim)]">Manage your server on the go</div>
      </div>
      <a
        href={app.url}
        className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-[var(--hud-purple)] text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all ml-2"
      >
        GET APP
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="text-[var(--hud-dim)] hover:text-white text-lg leading-none ml-1 transition-colors"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </motion.div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function Home() {
  const [booted, setBooted] = useState(false);
  const handleBootComplete = useCallback(() => setBooted(true), []);

  return (
    <div className="scanlines">
      <AnimatePresence>
        {!booted && <BootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {booted && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Navbar />
          <Hero />
          <StatsHud />
          <FeaturesSection />
          <InteractiveTerminal />
          <ModuleGrid />
          <DeployCTA />
          <Footer />
          <AnimatePresence>
            <AppBanner />
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
