import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, Users, BarChart3,
  Bell, Search, Plus, Paperclip, MessageSquare, ChevronRight, X, Check,
  CircleDot, Clock, AlertTriangle, FileText, Send, Filter,
  CheckCircle2, Eye, CalendarDays, Trash2, ArrowLeft, Shield, User,
  Mic, MicOff, Sparkles, Mail, Pencil, CornerDownRight, Sun, Moon,
  Link2, Upload, Settings, LogOut, ExternalLink, Download, Inbox
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Cell, AreaChart, Area
} from "recharts";
import * as DB from "./db.js";
import { scoreBreakdown, priorityScore, priorityBand } from "./scoring.js";

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    bg: "#0E0F12", surface: "#16171B", line: "rgba(255,255,255,.09)",
    ink: "#F4F4F2", body: "#C9CAC7", mut: "#8E8F8C", faint: "#63645F", tick: "#8E8F8C",
    accent: "#B0B2AD", accentSoft: "rgba(244,244,242,.08)", accentInk: "#E4E5E1",
    cyan: "#3FB8AF", cyanSoft: "rgba(63,184,175,.13)",
    amber: "#E0A83E", amberSoft: "rgba(224,168,62,.13)",
    red: "#E36560", redSoft: "rgba(227,101,96,.13)",
    blue: "#6E9BE8", blueSoft: "rgba(110,155,232,.13)",
    purple: "#A98FE0", purpleSoft: "rgba(169,143,224,.13)",
    green: "#57B77F", greenSoft: "rgba(87,183,127,.13)",
    gray: "#8E8F8C", graySoft: "rgba(255,255,255,.06)",
    glass: "#16171B",
    panel: "#121316", input: "#101114", raise: "rgba(255,255,255,.05)", hover: "rgba(255,255,255,.04)",
    pop: "#1B1C21", nodeBg: "#101114", headerBg: "rgba(14,15,18,.85)", grid: "rgba(255,255,255,.06)",
    dot: "rgba(255,255,255,.06)", scroll: "#32333A", dateInv: ".8",
    btnGrad: "linear-gradient(180deg,#3A3B41 0%,#232428 100%)", btnText: "#FFFFFF",
    glow: "0 6px 18px -8px rgba(0,0,0,.6)",
    shadow: "0 1px 0 rgba(255,255,255,.04) inset,0 1px 2px rgba(0,0,0,.35),0 10px 24px -16px rgba(0,0,0,.6)",
    shadowHover: "0 1px 0 rgba(255,255,255,.05) inset,0 2px 4px rgba(0,0,0,.4),0 18px 40px -20px rgba(0,0,0,.7)",
    liftBorder: "rgba(255,255,255,.22)",
  },
  light: {
    bg: "#F7F6F3", surface: "#FFFFFF", line: "rgba(23,24,20,.09)",
    ink: "#17181A", body: "#45464B", mut: "#70716F", faint: "#A3A4A0", tick: "#70716F",
    accent: "#17181A", accentSoft: "rgba(23,24,26,.06)", accentInk: "#17181A",
    cyan: "#0E7C74", cyanSoft: "rgba(14,124,116,.10)",
    amber: "#9A6A10", amberSoft: "rgba(154,106,16,.11)",
    red: "#C4423E", redSoft: "rgba(196,66,62,.09)",
    blue: "#2F5FB3", blueSoft: "rgba(47,95,179,.09)",
    purple: "#6D4FB8", purpleSoft: "rgba(109,79,184,.09)",
    green: "#20794A", greenSoft: "rgba(32,121,74,.10)",
    gray: "#70716F", graySoft: "rgba(23,24,20,.06)",
    glass: "#FFFFFF",
    panel: "#FFFFFF", input: "#FFFFFF", raise: "rgba(23,24,20,.04)", hover: "rgba(23,24,20,.03)",
    pop: "#FFFFFF", nodeBg: "#FFFFFF", headerBg: "rgba(247,246,243,.88)", grid: "rgba(23,24,20,.07)",
    dot: "rgba(23,24,20,.08)", scroll: "#D6D5D0", dateInv: "0",
    btnGrad: "linear-gradient(180deg,#26272B 0%,#151619 100%)", btnText: "#FFFFFF",
    glow: "0 8px 20px -10px rgba(23,24,26,.25)",
    shadow: "0 1px 2px rgba(23,24,20,.05),0 6px 16px -10px rgba(23,24,20,.10)",
    shadowHover: "0 1px 2px rgba(23,24,20,.06),0 14px 30px -14px rgba(23,24,20,.16)",
    liftBorder: "rgba(23,24,26,.28)",
  },
};
const T = { ...THEMES.light };
/* ==================================================================
   REAL EMAIL DELIVERY — Gmail via EmailJS
   ------------------------------------------------------------------
   Progress emails only: one mail whenever a task moves to a new stage
   in the 9-step pipeline. Comments, attachments, links, edits, blocks
   and team chat stay in-app — they never send mail.

   Keys are entered in Settings → Email notifications (saved in this
   browser), so nothing has to be edited in this file. Set-up:

   1. Free account at https://www.emailjs.com
   2. Email Services → Add New Service → Gmail → connect the Gmail
      account mail should be sent FROM. Copy the Service ID.
   3. Email Templates → Create Template, using these variables:
        To email:  {{to_email}}
        Subject:   {{subject}}
        Body:      {{message}}      (and {{from_name}} if you like)
      Copy the Template ID.
   4. Account → General → copy the Public Key.
   5. Paste all three in Settings and flip the toggle on.

   Delivery needs a real origin (Vercel / Netlify / localhost) — some
   sandboxes block outbound API calls. Whenever a send fails the app
   keeps working and still logs the mail on the task's Email activity
   card, so nothing is lost.
   ================================================================== */
/* Where the requirement intake form is published. Settings can override
   this — handy if the Netlify site is ever renamed. */
const DEFAULT_FORM_URL = "https://dapper-kelpie-fbd4f3.netlify.app/";

const EMAIL_DEFAULTS = { enabled: false, serviceId: "", templateId: "", publicKey: "" };
/* live copy — App keeps this in sync with what's saved in Settings */
let EMAIL_CONFIG = { ...EMAIL_DEFAULTS };
const setEmailConfig = c => { EMAIL_CONFIG = { ...EMAIL_DEFAULTS, ...c }; };
const emailReady = c => !!(c?.enabled && c.serviceId && c.templateId && c.publicKey);

/* ==================================================================
   AI — Groq (OpenAI-compatible API, key configured in Settings)
   ================================================================== */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
async function callGroq(groq, messages, { json = false } = {}) {
  if (!groq?.key) throw new Error("no-key");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groq.key}` },
    body: JSON.stringify({
      model: (groq.model || "").trim() || GROQ_DEFAULT_MODEL,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error("Groq API error " + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function deliverEmail({ fromName, fromEmail, to, subject, message }) {
  if (!emailReady(EMAIL_CONFIG)) return false;
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAIL_CONFIG.serviceId,
        template_id: EMAIL_CONFIG.templateId,
        user_id: EMAIL_CONFIG.publicKey,
        template_params: { to_email: to.join(","), from_name: fromName, from_email: fromEmail, subject, message },
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("Email delivery failed (falling back to in-app log):", e);
    return false;
  }
}

const applyTheme = mode => Object.assign(T, THEMES[mode]);
const celebrate = () => { try { window.dispatchEvent(new Event("ziu-celebrate")); } catch (e) {} };

const mkStatus = (label, ck, bk) => ({ label, get c() { return T[ck]; }, get bg() { return T[bk]; } });
/* the 9-stage delivery pipeline — every task moves through these in order */
const STATUS = {
  assigned:   mkStatus("Task assigned", "gray", "graySoft"),
  prd:        mkStatus("PRD creation", "blue", "blueSoft"),
  prototype:  mkStatus("Prototype creation", "cyan", "cyanSoft"),
  demo:       mkStatus("Prototype demo", "purple", "purpleSoft"),
  feedback:   mkStatus("Feedback finalised", "amber", "amberSoft"),
  build:      mkStatus("Build", "blue", "blueSoft"),
  finaldemo:  mkStatus("Final Demo", "purple", "purpleSoft"),
  deployment: mkStatus("Deployment", "cyan", "cyanSoft"),
  golive:     mkStatus("Go Live", "green", "greenSoft"),
};
const PIPELINE = Object.keys(STATUS);
const DONE = "golive";
/* compact labels for the lifecycle rail */
const STAGE_SHORT = {
  assigned: "Assigned", prd: "PRD", prototype: "Prototype", demo: "Demo",
  feedback: "Feedback", build: "Build", finaldemo: "Final demo", deployment: "Deploy", golive: "Go live",
};
/* reasons captured when a task is flagged blocked */
const TRACK_REASONS = ["Delay reason", "Insufficient data", "Testing pending", "Scope change", "Dependency on other team", "Other"];

/* ---- business-day (5-day work week) helpers ---- */
const isWorkday = d => d.getDay() !== 0 && d.getDay() !== 6;
const addBusinessDays = (fromISO, n) => {
  const d = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00" : ""));
  let left = Math.max(0, Math.round(n));
  while (left > 0) { d.setDate(d.getDate() + 1); if (isWorkday(d)) left--; }
  return d.toISOString().slice(0, 10);
};
const bizDaysBetween = (aISO, bISO) => {
  if (!aISO || !bISO) return 0;
  let a = new Date(aISO.slice(0, 10) + "T00:00:00"), b = new Date(bISO.slice(0, 10) + "T00:00:00");
  if (a > b) [a, b] = [b, a];
  let n = 0; const d = new Date(a);
  while (d < b) { d.setDate(d.getDate() + 1); if (isWorkday(d)) n++; }
  return n;
};
const workdaysInMonth = (ref = new Date()) => {
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1); let n = 0;
  while (d.getMonth() === ref.getMonth()) { if (isWorkday(d)) n++; d.setDate(d.getDate() + 1); }
  return n;
};
const gcalLink = t => {
  const s = (t.startAt || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  const e = (t.deadline || t.startAt || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
    encodeURIComponent(`ZIU · #${t.no} ${t.title}`) + "&dates=" + s + "/" + e +
    "&details=" + encodeURIComponent(`Task ${t.id} · ${STATUS[t.status]?.label || t.status}${t.effortDays ? ` · effort ${t.effortDays}d` : ""}`);
};

const PRIORITY = {
  critical: mkStatus("Critical", "red", "redSoft"),
  high:     mkStatus("High", "amber", "amberSoft"),
  medium:   mkStatus("Medium", "blue", "blueSoft"),
  low:      mkStatus("Low", "gray", "graySoft"),
};

/* ------------------------------------------------------------------ */
/*  Team — Krunal is the assigner; everyone else is assignable          */
/* ------------------------------------------------------------------ */
const OWNER_ID = "u1";
const USERS = [
  { id: "u1", name: "Krunal Rajput",     email: "krunalr477@gmail.com", role: "owner",  initials: "KR" },
  { id: "u2", name: "Jaynil Agarwal",    email: "jaynil@ziu.team",      role: "member", initials: "JA" },
  { id: "u3", name: "Abhishek Shah",     email: "abhishek@ziu.team",    role: "member", initials: "AS" },
  { id: "u4", name: "Katha Pawale",      email: "katha@ziu.team",       role: "member", initials: "KP" },
  { id: "u5", name: "Vijesh Zinzuwadia", email: "vijesh@ziu.team",      role: "viewer", initials: "VZ" },
  { id: "u6", name: "Ujay Ranpara",      email: "ujay@ziu.team",        role: "viewer", initials: "UR" },
  { id: "u7", name: "Jigar Shah",        email: "jigar@ziu.team",       role: "viewer", initials: "JS" },
];
/* order the names appear on the login portal */
const LOGIN_ORDER = ["u1", "u5", "u6", "u7", "u3", "u2", "u4"];
const LOGIN_LIST = () => LOGIN_ORDER.map(id => USERS.find(u => u.id === id)).filter(Boolean)
  .concat(USERS.filter(u => !LOGIN_ORDER.includes(u.id)));

/* what each role is called, and what it may do */
const ROLE_LABEL = { owner: "Assigner", member: "Team Member", viewer: "View Only Control" };
const rlabel = u => ROLE_LABEL[u?.role] || "Team Member";
const isOwner  = u => u?.role === "owner";
const isViewer = u => u?.role === "viewer";
/* viewers are read-only apart from comments and team chat */
const canWrite   = u => !isViewer(u);          // move stages, attach files, pin links, block
const canAdmin   = u => isOwner(u);            // create / edit / delete tasks, manage team, settings
/* Automation requests are visible to every signed-in person; only members and
  the assigner can approve or reject them. */
const canReview  = u => isOwner(u) || u?.role === "member";

/* assigner + view-only see the whole org; team members see their own work */
const visibleTasks = (tasks, u) => u?.role === "member"
  ? tasks.filter(t => t.assignees.includes(u.id) || t.owner === u.id || t.createdBy === u.id)
  : tasks;

const MEMBERS = USERS.filter(u => u.role === "member");
/* assignable people — team members only; the assigner and the view-only
   accounts can never be put on a task */
const STAFF = () => USERS.filter(u => u.role === "member");

const daysFromNow = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ts = (offsetH) => { const d = new Date(); d.setHours(d.getHours() - offsetH); return d.toISOString(); };

let SEQ = 1008;

/* ------------------------------------------------------------------ */
/*  Live task board — the real ZIU workstreams                          */
/*  Stages walk the 9-step pipeline up to whatever each task has reached */
/* ------------------------------------------------------------------ */
const TEAM = ["u2", "u3", "u4"];   // Jaynil, Abhishek, Katha — all three on every task

/* builds a full task from a short spec: history is derived from the stage */
function mkTask(no, spec) {
  const target = PIPELINE.indexOf(spec.status);
  const reached = PIPELINE.slice(0, target + 1);
  const span = spec.ageH || (reached.length * 68);         // hours since the task was raised
  const step = span / Math.max(1, reached.length);
  const at = i => ts(Math.round(span - i * step));
  const stageHistory = reached.map((stage, i) => ({ stage, at: at(i), by: i === 0 ? "u1" : spec.driver || "u3" }));
  const closedAt = spec.status === DONE ? stageHistory[stageHistory.length - 1].at : undefined;
  return {
    id: "T-" + (1000 + no), no, title: spec.title, desc: spec.desc,
    status: spec.status, blocked: spec.blocked || null, priority: spec.priority,
    deadline: daysFromNow(spec.due), effortDays: spec.effortDays,
    startAt: ts(span), closedAt,
    createdBy: "u1", owner: "u1", poc: spec.poc || "", remarks: spec.remarks || "", productUrl: spec.productUrl || "",
    requirements: spec.requirements || "",
    reference: spec.reference || "", techStack: spec.techStack || "",
    assignees: [...TEAM],
    stageHistory,
    attachments: [], links: [], queries: [],
    comments: spec.comments || [],
    history: [
      { at: at(0), by: "u1", ev: "Task created and assigned to " + TEAM.map(id => USERS.find(u => u.id === id)?.name || id).join(", ") },
      ...stageHistory.slice(1).map(h => ({ at: h.at, by: h.by, ev: "Stage moved to " + STATUS[h.stage].label })),
      ...(spec.blocked ? [{ at: ts(6), by: spec.driver || "u3", kind: "block", ev: "Flagged blocked — " + spec.blocked.reason }] : []),
    ],
  };
}

const SEED_TASKS = [
  mkTask(1, {
    title: "UG Task Manager", status: "finaldemo", priority: "high", due: 7, effortDays: 22, driver: "u3",
    desc: "Task and workflow manager for the UG account — assign work, track it through the delivery pipeline, and give the client a single view of progress.",
    requirements: "Final demo is done. Collect sign-off notes before moving to deployment.",
    techStack: "React, Vite, Node",
    comments: [{ by: "u3", at: ts(20), text: "Final demo went well — waiting on written sign-off.", reactions: {} }],
  }),
  mkTask(2, {
    title: "5471 Form", status: "build", priority: "critical", due: 12, effortDays: 18, driver: "u2",
    desc: "Automate preparation of IRS Form 5471 for foreign-corporation filings — schedule mapping, ownership tracking and validation before export.",
    requirements: "Every schedule must reconcile against the source trial balance. No manual overrides.",
    techStack: "Python, React",
  }),
  mkTask(3, {
    title: "GST Reconciliation", status: "golive", priority: "high", due: -4, effortDays: 15, driver: "u4",
    desc: "Reconcile GSTR-2B against the purchase register, flag mismatches, and produce a vendor-wise action list each month.",
    requirements: "Mismatches above the tolerance limit need a written root-cause note.",
    techStack: "Python, Postgres",
    comments: [{ by: "u4", at: ts(30), text: "Live and running the monthly cycle. ✅", reactions: {} }],
  }),
  mkTask(4, {
    title: "ZIU HR", status: "build", priority: "high", due: 21, effortDays: 28, driver: "u4",
    desc: "In-house HR platform — employee records, leave and attendance, onboarding checklists and the appraisal cycle.",
    requirements: "Leave policy rules must be configurable, not hard-coded.",
    techStack: "React, Node, Postgres",
  }),
  mkTask(5, {
    title: "Talent Mining", status: "finaldemo", priority: "medium", due: 9, effortDays: 20, driver: "u3",
    desc: "Source and shortlist candidates from public profiles and inbound applications, scored against the role brief.",
    requirements: "Shortlist must show why each candidate scored the way they did.",
    techStack: "Python, React",
  }),
  mkTask(6, {
    title: "Lead Mining", status: "feedback", priority: "medium", due: 18, effortDays: 16, driver: "u2",
    desc: "Build a qualified lead pipeline from public company data — enrich, score and route leads to the right owner.",
    requirements: "Feedback from the first review round has to be closed out before Build starts.",
    techStack: "Python, React",
    comments: [{ by: "u2", at: ts(14), text: "Consolidating review feedback — will circulate the final list today.", reactions: {} }],
  }),
  mkTask(7, {
    title: "ZIU Learn", status: "build", priority: "medium", due: 30, effortDays: 25, driver: "u3",
    desc: "Internal learning platform — course library, structured learning paths, progress tracking and completion certificates.",
    requirements: "Content must be authorable by non-developers.",
    techStack: "React, Node",
  }),
  mkTask(8, {
    title: "OKR", status: "prototype", priority: "medium", due: 35, effortDays: 14, driver: "u4",
    desc: "Objectives and key results tracker — set quarterly objectives, cascade them to teams, and check in on progress.",
    requirements: "Prototype should cover objective creation and check-ins before anything else.",
    techStack: "React, Node",
  }),
];

const SEED_AUDIT = SEED_TASKS.flatMap(t => t.history.map(h => ({ ...h, task: t.id, title: t.title })))
  .sort((a, b) => new Date(b.at) - new Date(a.at));

/* ------------------------------------------------------------------ */
/*  Persistence — everything lives in this browser's localStorage       */
/* ------------------------------------------------------------------ */
const LS_KEY = "ziu-connect-v3";
/* Bump this whenever SEED_TASKS or the roster changes. A saved board from an
   older seed is dropped so the new task list actually shows up — theme and the
   Groq key are kept. */
const SEED_VERSION = "2026-08-tasks-8";
function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!p || p.v !== 3) return null;
    if (p.seed !== SEED_VERSION) return { v: 3, seed: SEED_VERSION, theme: p.theme, groq: p.groq, mail: p.mail };
    return p;
  } catch { return null; }
}
const BOOT = loadState();
if (BOOT?.users?.length) {
  USERS.splice(0, USERS.length, ...BOOT.users);
  MEMBERS.splice(0, MEMBERS.length, ...USERS.filter(u => u.role === "member"));
}
if (BOOT?.tasks?.length) {
  SEQ = Math.max(SEQ, ...BOOT.tasks.map(t => +String(t.id).replace("T-", "") || 0));
}
if (BOOT?.mail) setEmailConfig(BOOT.mail);
applyTheme(BOOT?.theme === "dark" ? "dark" : "light");


/* ------------------------------------------------------------------ */
/*  ZIU brand mark — white wordmark, green blades, globe, GROUP        */
/* ------------------------------------------------------------------ */
const ZIU_BRAND = "#9B9C98"; // neutral brand gray, works on light + charcoal
function ZiuLogo({ h = 110, sub = "GROUP", ink = "#FFFFFF", subColor, style = {}, className = "", animate = false, hideGlobe = false }) {
  // Crop the viewBox to the mark alone when there is no sub-word, so it sits
  // flush in tight spaces (sidebar) instead of carrying empty bottom space.
  const vb = sub ? "34 10 296 144" : "36 12 292 114";
  const a = cls => (animate ? cls : undefined);
  return (
    <svg viewBox={vb} className={(className + (animate ? " zl-anim" : "") + (animate === "merge" ? " zl-merge" : "")).trim()} preserveAspectRatio="xMinYMid meet"
      style={{ height: h, width: "auto", display: "block", maxWidth: "100%", ...style }}
      role="img" aria-label={"ZIU " + sub}>
      {animate && (
        <style>{`
          .zl-anim .zl-word,.zl-anim .zl-bl,.zl-anim .zl-br,.zl-anim .zl-globe,.zl-anim .zl-sub,.zl-anim .zl-meridian{
            transform-box:fill-box;transform-origin:center;animation-fill-mode:backwards}
          .zl-anim .zl-word{animation:zlWord .9s cubic-bezier(.16,1,.3,1) .15s}
          @keyframes zlWord{from{opacity:0;transform:translateY(16px);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}
          .zl-anim .zl-bl{animation:zlBladeL .8s cubic-bezier(.16,1,.3,1) .5s}
          @keyframes zlBladeL{from{opacity:0;transform:translate(-14px,10px)}to{opacity:1;transform:none}}
          .zl-anim .zl-br{transform-origin:left center;animation:zlBladeR .9s cubic-bezier(.16,1,.3,1) .6s}
          @keyframes zlBladeR{from{opacity:0;transform:translateX(-30px) scaleX(.4)}to{opacity:1;transform:none}}
          .zl-anim .zl-globe{animation:zlGlobe .7s cubic-bezier(.16,1,.3,1) .75s}
          @keyframes zlGlobe{from{opacity:0;transform:scale(.25)}to{opacity:1;transform:scale(1)}}
          .zl-anim .zl-meridian{animation:zlSpin 1.6s ease-in-out 1.05s}
          @keyframes zlSpin{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.08)}}
          .zl-anim .zl-sub{animation:zlSub 1.1s cubic-bezier(.16,1,.3,1) .85s}
          @keyframes zlSub{from{opacity:0;letter-spacing:26px}to{opacity:1;letter-spacing:13px}}
          .zl-anim .zl-sheen{animation:zlSheen 1.2s cubic-bezier(.4,0,.2,1) 1.35s backwards}
          @keyframes zlSheen{from{opacity:0;transform:translateX(-180px)}15%{opacity:1}85%{opacity:1}to{opacity:0;transform:translateX(260px)}}
          .zl-anim .zl-globe,.zl-anim .zl-bl,.zl-anim .zl-br{transition:transform .35s cubic-bezier(.16,1,.3,1),filter .35s}
          .zl-anim:hover .zl-sheen{animation:zlSheen 1.1s cubic-bezier(.4,0,.2,1) both}
          .zl-anim:hover .zl-meridian{animation:zlSpin 1.4s ease-in-out}
          .zl-anim:hover .zl-globe{transform:scale(1.12)}
          .zl-anim:hover .zl-bl{transform:translate(-2px,1px);filter:brightness(1.15)}
          .zl-anim:hover .zl-br{transform:translateX(3px)}
          .zl-merge .zl-word,.zl-merge .zl-sub,.zl-merge .zl-bl,.zl-merge .zl-br{animation:none}
          .zl-merge .zl-globe{animation:zlDock .65s cubic-bezier(.34,1.56,.64,1) both}
          @keyframes zlDock{from{opacity:0;transform:scale(2.4)}60%{opacity:1;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
          .zl-merge .zl-meridian{animation:zlSpin 1.3s ease-in-out .2s}
          .zl-merge .zl-sheen{animation:zlSheen 1.1s cubic-bezier(.4,0,.2,1) .45s backwards}
          @media(prefers-reduced-motion:reduce){.zl-anim *,.zl-merge *{animation:none!important;transition:none!important}}
        `}</style>
      )}
      {animate && (
        <defs>
          <linearGradient id="zlsheen" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(16)">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".38" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="zlclip">
            <text x="178" y="105" textAnchor="middle" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="78" letterSpacing="2">ZIU</text>
          </clipPath>
        </defs>
      )}
      {/* left blade — angled sweep hugging the Z */}
      <defs>
        <linearGradient id="zbladeL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8FE0F5" /><stop offset="1" stopColor="#7B6CF0" />
        </linearGradient>
        <linearGradient id="zbladeR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#17181A" /><stop offset="1" stopColor="#3A3B41" />
        </linearGradient>
      </defs>
      <path className={a("zl-bl")} d="M62 34 L98 19 L80 40 L66 102 L47 117 Z" fill="url(#zbladeL)" />
      {/* top-right blade — long taper flying off past the U */}
      <path className={a("zl-br")} d="M170 31 L326 21 L180 42 Z" fill="url(#zbladeR)" />
      {/* wordmark */}
      <text className={a("zl-word")} x="178" y="105" textAnchor="middle" fill={ink}
        fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="78" letterSpacing="2">ZIU</text>
      {/* light sweep across the letters */}
      {animate && (
        <g clipPath="url(#zlclip)">
          <rect className="zl-sheen" x="60" y="30" width="110" height="88" fill="url(#zlsheen)" />
        </g>
      )}
      {/* globe above the U */}
      <g className={a("zl-globe")} stroke={ink} strokeWidth="2" fill="none" style={hideGlobe ? { opacity: 0 } : undefined}>
        <circle cx="236" cy="24" r="11" fill="rgba(0,0,0,.25)" />
        <ellipse className={a("zl-meridian")} cx="236" cy="24" rx="5" ry="11" />
        <line x1="225" y1="24" x2="247" y2="24" />
        <path d="M227.5 17.5 Q236 21 244.5 17.5 M227.5 30.5 Q236 27 244.5 30.5" strokeWidth="1.5" />
      </g>
      {/* sub-word, letter-spaced */}
      {sub && <text className={a("zl-sub")} x="176" y="146" textAnchor="middle" fill={subColor || ink}
        fontFamily="'Inter',sans-serif" fontWeight="600" fontSize="17" letterSpacing="13">{sub}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
const uname = id => USERS.find(u => u.id === id)?.name || "—";
const uinit = id => USERS.find(u => u.id === id)?.initials || "?";
const fileSize = b => !b ? "" : b < 1024 * 1024
  ? Math.max(1, Math.round(b / 1024)) + " KB · "
  : (b / 1048576).toFixed(1) + " MB · ";
const fmtDate = d => d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const fmtTs = d => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const overdue = t => t.deadline && t.status !== DONE && new Date(t.deadline) < new Date(new Date().toDateString());
/* progress is derived from how far along the 9-stage pipeline the task is */
const progressOf = t => Math.round(Math.max(0, PIPELINE.indexOf(t.status)) / (PIPELINE.length - 1) * 100);

const Avatar = ({ id, size = 26 }) => (
  <span title={uname(id)} style={{
    width: size, height: size, borderRadius: "50%", background: T.accentSoft, color: T.accentInk,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.38, fontWeight: 700, fontFamily: "'Inter',sans-serif",
    border: "1.5px solid rgba(255,255,255,.15)", flexShrink: 0,
  }}>{uinit(id)}</span>
);

const Chip = ({ label, c, bg, dot = true }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
    borderRadius: 99, background: bg, color: c, fontSize: 11.5, fontWeight: 600,
    letterSpacing: .2, whiteSpace: "nowrap",
  }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />}
    {label}
  </span>
);
const StatusChip = ({ s }) => <Chip {...STATUS[s]} label={STATUS[s].label} />;
const PrioChip = ({ p }) => <Chip {...PRIORITY[p]} label={PRIORITY[p].label} dot={false} />;

const Btn = ({ children, kind = "primary", small, disabled, ...rest }) => {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 7, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Inter',sans-serif", fontWeight: 600,
    fontSize: small ? 12.5 : 13.5, padding: small ? "6px 12px" : "9px 16px",
    borderRadius: 12, border: "1px solid transparent", transition: "filter .12s", opacity: disabled ? .5 : 1,
  };
  const kinds = {
    primary: { background: T.btnGrad, color: T.btnText, borderRadius: 99 },
    ghost: { background: T.raise, color: T.ink, border: `1px solid ${T.line}`, borderRadius: 99 },
    danger: { background: T.redSoft, color: T.red, borderRadius: 99 },
    soft: { background: T.accentSoft, color: T.accentInk, borderRadius: 99 },
  };
  return <button className={kind === "primary" ? "btn3d" : ""} disabled={disabled} {...rest} style={{ ...base, ...kinds[kind], ...(rest.style || {}) }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.filter = "brightness(.94)")}
    onMouseLeave={e => (e.currentTarget.style.filter = "none")}>{children}</button>;
};

const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 14 }}>
    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase", color: T.mut, marginBottom: 6 }}>{label}</div>
    {children}
  </label>
);
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 12,
  fontSize: 14, fontFamily: "'Inter',sans-serif", outline: "none",
  get border() { return `1px solid ${T.line}`; },
  get color() { return T.ink; },
  get background() { return T.input; },
};

const Modal = ({ title, onClose, children, width = 560 }) => (
  <div onMouseDown={e => e.target === e.currentTarget && onClose()} style={{
    position: "fixed", inset: 0, background: "rgba(4,7,10,.7)", backdropFilter: "blur(4px)", zIndex: 60,
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto",
    animation: "fadein .2s ease-out",
  }}>
    <div style={{ animation: "modalin .3s cubic-bezier(.16,1,.3,1)", background: T.pop, border: `1px solid ${T.line}`, borderRadius: 16, width: "100%", maxWidth: width, boxShadow: "0 0 0 1px rgba(255,255,255,.04) inset, 0 30px 80px -20px rgba(0,0,0,.9), 0 0 60px -20px rgba(23,24,26,.14)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 17 }}>{title}</div>
        <X size={18} style={{ cursor: "pointer", color: T.mut }} onClick={onClose} />
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Error boundary — if anything throws, show the message readably      */
/* ------------------------------------------------------------------ */
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#0E0F12", color: "#F4F4F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ maxWidth: 520, background: "#131A24", border: "1px solid rgba(242,109,98,.4)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#FF5C7C", marginBottom: 8 }}>Something broke</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.6, color: "#C4CEDA", wordBreak: "break-word" }}>
            {String(this.state.err && this.state.err.message || this.state.err)}
          </div>
          <button onClick={() => this.setState({ err: null })} style={{ marginTop: 16, padding: "9px 18px", borderRadius: 99, border: "none", background: "linear-gradient(180deg,#26272B,#151619)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Try to recover
          </button>
        </div>
      </div>
    );
  }
}


/* ------------------------------------------------------------------ */
/*  Intro splash — cinematic brand open, plays once on load            */
/* ------------------------------------------------------------------ */
function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { const t = setTimeout(onDone, 250); return () => clearTimeout(t); }
    const t1 = setTimeout(() => setLeaving(true), 2650);   // hold until the logo finishes
    const t2 = setTimeout(onDone, 3400);                    // remove after the curtain lifts
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div className={"intro" + (leaving ? " intro-out" : "")} onClick={() => { setLeaving(true); setTimeout(onDone, 750); }}
      role="presentation" aria-hidden="true">
      <style>{`
        .intro{position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
          background:radial-gradient(900px 480px at 50% 42%, #FFFFFF 0%, ${T.bg} 62%, #EFEEE9 100%);cursor:pointer;
          transition:transform .75s cubic-bezier(.7,0,.25,1),border-radius .75s cubic-bezier(.7,0,.25,1)}
        .intro-dots{position:absolute;inset:0;pointer-events:none;opacity:.55;
          background-image:radial-gradient(${T.dot} 1px,transparent 1px);background-size:22px 22px;
          -webkit-mask-image:radial-gradient(640px 420px at 50% 45%,transparent 30%,#000 80%);
          mask-image:radial-gradient(640px 420px at 50% 45%,transparent 30%,#000 80%)}
        .intro-out{transform:translateY(-100%);border-bottom-left-radius:48px;border-bottom-right-radius:48px;
          box-shadow:0 30px 60px -20px rgba(23,24,20,.25)}
        .intro-out .intro-inner{opacity:0;transform:translateY(-26px) scale(.96)}
        .intro-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:22px;
          transition:opacity .45s ease,transform .6s cubic-bezier(.7,0,.25,1)}
        .intro-ring{position:absolute;width:520px;height:520px;border-radius:50%;border:1px solid rgba(23,24,20,.08);
          animation:introRing 2.8s cubic-bezier(.16,1,.3,1) both}
        .intro-ring.r2{width:760px;height:760px;animation-delay:.25s;opacity:.6}
        @keyframes introRing{from{transform:scale(.55);opacity:0}30%{opacity:1}to{transform:scale(1);opacity:.5}}
        .intro-tag{font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;letter-spacing:5px;text-transform:uppercase;
          color:${T.mut};animation:introTag 1s cubic-bezier(.16,1,.3,1) 1.6s backwards}
        @keyframes introTag{from{opacity:0;letter-spacing:12px;transform:translateY(8px)}to{opacity:1;letter-spacing:5px;transform:none}}
        .intro-bar{width:180px;height:2px;border-radius:99px;background:rgba(23,24,20,.10);overflow:hidden}
        .intro-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#B7B8B4,${T.ink});
          transform-origin:left;animation:introBar 2.45s cubic-bezier(.45,.05,.25,1) .15s both}
        @keyframes introBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .intro-skip{position:absolute;bottom:26px;z-index:2;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:1.5px;
          text-transform:uppercase;color:${T.faint};animation:introTag 1s ease 2s backwards}
        @media(prefers-reduced-motion:reduce){.intro,.intro *{animation:none!important;transition:opacity .2s!important}}
      `}</style>
      <div className="intro-dots" />
      <ParticleNetwork color="23,24,20" lineColor="23,24,20" dotAlpha={.35} style={{ position: "absolute", inset: 0, zIndex: 1, opacity: .5 }} />
      <span className="intro-ring" /><span className="intro-ring r2" />
      <div className="intro-inner">
        <ZiuLogo animate sub="CONNECT" subColor={ZIU_BRAND} ink={T.ink} style={{ height: 132, width: "auto" }} />
        <div className="intro-tag">Work, connected</div>
        <div className="intro-bar"><i /></div>
      </div>
      <span className="intro-skip">Click to skip</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Root app                                                           */
/* ------------------------------------------------------------------ */
export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [session, setSession] = useState(null);   // { userId } — set by the login portal
  const [tasks, setTasks] = useState(() => BOOT?.tasks?.length
    ? BOOT.tasks
    : SEED_TASKS.map((t, i) => ({ poc: "", queries: [], blocked: null, stageHistory: [], no: i + 1, ...t })));
  const [audit, setAudit] = useState(BOOT?.audit || SEED_AUDIT);
  const [chat, setChat] = useState(BOOT?.chat || [
    { id: 1, by: "u3", at: ts(28), text: "UG Task Manager final demo is done — sharing the recording and the sign-off checklist today." },
    { id: 2, by: "u2", at: ts(27), text: "Noted 👍 I'll pick up the 5471 schedule mapping right after." },
    { id: 3, by: "u1", at: ts(26), text: "Good momentum across the board. Keep moving the stages as you go so the board stays honest." },
    { id: 4, by: "u4", at: ts(4), text: "GST Reconciliation is live and the monthly cycle ran clean ✅" },
    { id: 5, by: "u2", at: ts(2), text: "Lead Mining feedback is nearly closed out — Build can start this week 🚀" },
  ]);
  const [chatRead, setChatRead] = useState(BOOT?.chatRead || {});
  const chatId = useRef(Math.max(10, ...((BOOT?.chat) || []).map(m => +m.id || 0)));
  const sendChat = (byId, text) => {
    /* with a database the message comes back over realtime, so adding it
       locally too would show it twice */
    if (DB.hasDb()) DB.insertChat(byId, text);
    else setChat(c => [...c, { id: ++chatId.current, by: byId, at: new Date().toISOString(), text }]);
    const name = USERS.find(u => u.id === byId)?.name || "Someone";
    notify(USERS.filter(u => u.id !== byId).map(u => u.id), `💬 ${name} in Team chat: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`, null, byId);
  };
  const markChatRead = (uid) => {
    setChatRead(r => ({ ...r, [uid]: new Date().toISOString() }));
    if (DB.hasDb()) DB.setChatRead(uid);
  };

  const [emails, setEmails] = useState(BOOT?.emails || [
    { from: "abhishek@ziu.team", to: ["krunalr477@gmail.com"], subject: "[ZIU Connect task #1] UG Task Manager moved to Final Demo", at: ts(24), task: "T-1001" },
    { from: "katha@ziu.team", to: ["krunalr477@gmail.com"], subject: "[ZIU Connect task #3] GST Reconciliation moved to Go Live", at: ts(30), task: "T-1003" },
    { from: "jaynil@ziu.team", to: ["krunalr477@gmail.com"], subject: "[ZIU Connect task #6] New comment from Jaynil Agarwal", at: ts(14), task: "T-1006" },
  ]);
  const [notifs, setNotifs] = useState(BOOT?.notifs || [
    { id: 1, to: "u1", text: "“UG Task Manager” moved to Final Demo", at: ts(24), read: false, task: "T-1001" },
    { id: 2, to: "u1", text: "“GST Reconciliation” moved to Go Live", at: ts(30), read: false, task: "T-1003" },
    { id: 3, to: "u1", text: "“Lead Mining” moved to Feedback finalised", at: ts(14), read: false, task: "T-1006" },
  ]);
  const nid = useRef(Math.max(10, ...((BOOT?.notifs) || []).map(n => +n.id || 0)));

  /* Groq API settings — configured in Settings, saved in this browser */
  const [groq, setGroqState] = useState(BOOT?.groq || { key: "", model: GROQ_DEFAULT_MODEL });
  /* EmailJS settings — configured in Settings */
  const [mail, setMailState] = useState(BOOT?.mail || { ...EMAIL_DEFAULTS });
  const [formUrl, setFormUrlState] = useState(BOOT?.formUrl ?? DEFAULT_FORM_URL);
  useEffect(() => { setEmailConfig(mail); }, [mail]);
  /* with a database these are shared by the whole team, not per-browser */
  const setGroq = u => { const next = typeof u === "function" ? u(groq) : u; setGroqState(next); if (DB.hasDb()) DB.saveSettings({ groq: next }); };
  const setMail = u => { const next = typeof u === "function" ? u(mail) : u; setMailState(next); if (DB.hasDb()) DB.saveSettings({ mail: next }); };
  const setFormUrl = v => { setFormUrlState(v); if (DB.hasDb()) DB.saveSettings({ form_url: v }); };
  /* bumped whenever the mutable USERS/MEMBERS arrays change, so they persist */
  const [usersTick, setUsersTick] = useState(0);

  /* theme lives here so the choice persists */
  const [theme, setTheme] = useState(BOOT?.theme === "dark" ? "dark" : "light");
  const flipTheme = (e) => {
    const doFlip = () => setTheme(m => { const next = m === "dark" ? "light" : "dark"; applyTheme(next); return next; });
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced) {
      document.documentElement.style.setProperty("--tvx", (e?.clientX ?? window.innerWidth / 2) + "px");
      document.documentElement.style.setProperty("--tvy", (e?.clientY ?? window.innerHeight / 2) + "px");
      // resolve after React has flushed the new theme; rAF is suspended inside a
      // view-transition callback (it caused a ~4s hang), so use a short timer
      document.startViewTransition(() => new Promise(res => {
        doFlip();
        setTimeout(res, 60);
      }));
    } else doFlip();
  };

  /* ---------------- shared database (optional) ----------------
     Without credentials every branch below is skipped and the app behaves
     exactly as it did before: one private board per browser. */
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const [dbLive, setDbLive] = useState(DB.hasDb() ? "connecting" : "off");
  const [reqs, setReqs] = useState([]);

  const markAllRead = (uid) => { if (DB.hasDb()) DB.markNotifsRead(uid); };

  const applyPeople = (people) => {
    if (!people?.length) return;
    USERS.splice(0, USERS.length, ...people);
    MEMBERS.splice(0, MEMBERS.length, ...USERS.filter(u => u.role === "member"));
    setUsersTick(t => t + 1);
  };

  useEffect(() => {
    if (!DB.hasDb()) return;
    let alive = true;

    (async () => {
      const snap = await DB.loadAll();
      if (!alive || !snap) { setDbLive("error"); return; }
      applyPeople(snap.people);
      if (snap.tasks.length) setTasks(snap.tasks);
      setNotifs(snap.notifs);
      setChat(snap.chat);
      setChatRead(snap.chatRead);
      setEmails(snap.emails);
      setAudit(snap.audit);
      if (snap.groq) setGroqState(snap.groq);
      if (snap.mail) setMailState(snap.mail);
      if (snap.formUrl) setFormUrlState(snap.formUrl);
      setReqs(await DB.loadAutomationRequests());
      setDbLive("live");
    })();

    const off = DB.subscribe({
      onTask: (t) => setTasks(ts => ts.some(x => x.id === t.id)
        ? ts.map(x => (x.id === t.id ? t : x))
        : [t, ...ts]),
      onTaskDelete: (id) => id && setTasks(ts => ts.filter(x => x.id !== id)),
      onNotif: (n) => setNotifs(ns => ns.some(x => x.id === n.id)
        ? ns.map(x => (x.id === n.id ? n : x))
        : [n, ...ns]),
      onChat: (m) => setChat(c => (c.some(x => x.id === m.id) ? c : [...c, m])),
      onChatRead: (id, at) => setChatRead(r => ({ ...r, [id]: at })),
      onPeople: async () => applyPeople(await DB.loadPeople()),
      onRequirement: (r) => setReqs(rs => rs.some(x => x.id === r.id)
        ? rs.map(x => (x.id === r.id ? r : x))
        : [r, ...rs]),
      onReqDelete: (id) => id && setReqs(rs => rs.filter(x => x.id !== id)),
      onSettings: (x) => {
        if (x.groq && Object.keys(x.groq).length) setGroqState(x.groq);
        if (x.mail && Object.keys(x.mail).length) setMailState(x.mail);
        if (x.formUrl != null) setFormUrlState(x.formUrl);
      },
      onStatus: (st) => setDbLive(st === "live" ? "live" : st),
    });

    return () => { alive = false; off(); };
  }, []);

  /* save everything whenever any slice changes.
     With a database configured the server is the source of truth, so this
     local copy is skipped entirely. */
  useEffect(() => {
    if (DB.hasDb()) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        v: 3, seed: SEED_VERSION, tasks, audit, chat, chatRead, emails, notifs,
        users: USERS, theme, groq, mail, formUrl,
      }));
    } catch {}
  }, [tasks, audit, chat, chatRead, emails, notifs, usersTick, theme, groq, mail, formUrl]);

  const logAudit = (by, task, ev) => {
    const row = { at: new Date().toISOString(), by, task: task.id, title: task.title, ev };
    setAudit(a => [row, ...a]);
    if (DB.hasDb()) DB.insertAudit(row);
  };

  /* View Only Control accounts are copied on everything — they aren't an owner,
     creator or assignee anywhere, so without this their bell would stay empty.
     `except` keeps whoever triggered the event from notifying themselves. */
  const notify = (toIds, text, taskId, except) => {
    const viewers = USERS.filter(isViewer).map(u => u.id);
    const to = [...new Set([...toIds, ...viewers])].filter(Boolean).filter(id => id !== except);
    if (!to.length) return;
    /* the database hands back real ids over realtime, so don't add them twice */
    if (DB.hasDb()) { DB.insertNotifs(to, text, taskId); return; }
    setNotifs(n => [...to.map(id => ({ id: ++nid.current, to: id, text, at: new Date().toISOString(), read: false, task: taskId })), ...n]);
  };

  const sendEmail = (fromId, toIds, subject, taskId, body) => {
    const sender = USERS.find(u => u.id === fromId);
    const from = sender?.email || "system@relayops.io";
    const to = [...new Set(toIds.filter(Boolean).filter(id => id !== fromId))]
      .map(id => USERS.find(u => u.id === id)?.email).filter(Boolean);
    if (!to.length) return;
    // real delivery to Gmail inboxes (fire-and-forget; keys live in Settings)
    deliverEmail({
      fromName: sender?.name || "ZIU Connect", fromEmail: from, to, subject,
      message: body || `${subject}\n\nSent from ZIU Connect${taskId ? ` · task ${taskId}` : ""} on ${new Date().toLocaleString()}.`,
    });
    // per-task sent log (the task's Email activity card)
    const row = { from, to, subject, at: new Date().toISOString(), task: taskId };
    setEmails(e => [row, ...e]);
    if (DB.hasDb()) DB.insertEmail(row);
  };

  /* ---- the only email this app sends: a task moved to a new stage ---- */
  const sendProgressEmail = (task, fromStage, toStage, byId) => {
    const mover = USERS.find(u => u.id === byId);
    const from = PIPELINE.indexOf(fromStage), to = PIPELINE.indexOf(toStage);
    const pct = Math.round(((to + 1) / PIPELINE.length) * 100);
    const subject = `[ZIU Connect #${task.no}] ${task.title} → ${STATUS[toStage].label}`;
    const bar = "█".repeat(to + 1) + "░".repeat(PIPELINE.length - to - 1);
    const body = [
      `${task.title} has moved ${to > from ? "forward" : "back"} a stage.`,
      ``,
      `  Was:      ${STATUS[fromStage].label}`,
      `  Now:      ${STATUS[toStage].label}   (stage ${to + 1} of ${PIPELINE.length})`,
      `  Progress: ${bar}  ${pct}%`,
      ``,
      `  Task:     #${task.no} · ${task.id}`,
      `  Moved by: ${mover?.name || "Someone"}`,
      `  Team:     ${(task.assignees || []).map(id => USERS.find(u => u.id === id)?.name).filter(Boolean).join(", ") || "unassigned"}`,
      `  Priority: ${PRIORITY[task.priority]?.label || task.priority}`,
      `  Deadline: ${fmtDate(task.deadline)}${overdue(task) ? "  ** OVERDUE **" : ""}`,
      task.blocked ? `  Blocked:  ${task.blocked.reason}` : null,
      ``,
      toStage === DONE ? `This task is now live. 🎉` : null,
      `— ZIU Connect · ${new Date().toLocaleString()}`,
    ].filter(l => l !== null).join("\n");
    /* progress mail goes to the whole workspace */
    sendEmail(byId, USERS.map(u => u.id), subject, task.id, body);
  };

  const updateTask = (id, patch, historyEv, by, kind) => {
    const stamp = new Date().toISOString();
    // updater stays PURE (React 18 may re-run it) — no side effects inside
    setTasks(ts => ts.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      if (historyEv) next.history = [...t.history, { at: stamp, by, ev: historyEv, ...(kind ? { kind } : {}) }];
      return next;
    }));
    /* push the same result to the shared database */
    if (DB.hasDb()) {
      const base = tasksRef.current.find(t => t.id === id);
      if (base) {
        const next = { ...base, ...patch };
        if (historyEv) next.history = [...base.history, { at: stamp, by, ev: historyEv, ...(kind ? { kind } : {}) }];
        DB.upsertTask(next);
      }
    }
    /* NOTE: no email here on purpose — mail is sent only for stage
       moves, via sendProgressEmail. Comments, files, links, edits and
       blocks stay in-app. */
  };

  const createTask = (task) => {
    setTasks(ts => [task, ...ts]);
    if (DB.hasDb()) DB.upsertTask(task);
  };
  const removeTask = (id) => {
    setTasks(ts => ts.filter(x => x.id !== id));
    if (DB.hasDb()) DB.deleteTask(id);
  };

  /* Approving turns a submission into a numbered task, assigned to the three
     team members, sitting at the first pipeline stage. */
  const approveRequirement = (r, byId) => {
    const nextNo = Math.max(0, ...tasksRef.current.map(t => +t.no || 0)) + 1;
    const id = "T-" + (1000 + nextNo);
    const p = r.payload || {};
    const nowIso = new Date().toISOString();
    const team = USERS.filter(u => u.role === "member").map(u => u.id);
    const desc = [p.useCase || p.processDescription, p.justification && `Why it's needed: ${p.justification}`]
      .filter(Boolean).join("\n\n") || r.title;
    const requirements = [
      (p.proposedSolution || p.futureProcess) && `Proposed solution (To-Be):\n${p.proposedSolution || p.futureProcess}`,
      (p.functionalRequirements || p.functionalNeed) && `Functional requirements:\n${p.functionalRequirements || p.functionalNeed}`,
      p.stepProcess && `Step-wise process:\n${p.stepProcess}`,
      p.integrationRequirements && `Integration:\n${p.integrationRequirements}`,
      p.acceptanceCriteria && `Acceptance criteria:\n${p.acceptanceCriteria}`,
      p.currentProcess && `Current process (As-Is):\n${p.currentProcess}`,
      p.painPoints && `Pain points:\n${p.painPoints}`,
      (p.regulatory || p.obligations) && `Regulatory / audit:\n${p.regulatory || p.obligations}`,
      p.links && `Reference links:\n${p.links}`,
      p.keyRisks && `Key risks: ${p.keyRisks}`,
      r.score != null && `Priority score: ${r.score}/100 (${r.band})\n` + scoreBreakdown(p.scores || {})
        .map(d => `  ${d.label}: ${d.value}/5 — ${d.answer} (${d.points} of ${d.weight})`).join("\n"),
      p.dataClassification && `Data classification: ${p.dataClassification}`,
      p.securityReview && `Security review: ${p.securityReview}`,
    ].filter(Boolean).join("\n\n");

    const task = {
      id, no: nextNo, title: r.title,
      desc, requirements,
      status: PIPELINE[0], blocked: null,
      /* the weighted score decides priority; the requestor's own pick is a fallback */
      priority: ({ Critical: "critical", High: "high", Medium: "medium", Low: "low" })[r.band || p.priority] || "medium",
      deadline: p.requiredDate || daysFromNow(21),
      effortDays: "", startAt: nowIso, closedAt: undefined,
      createdBy: byId, owner: byId,
      poc: r.requestor || "", reference: r.publicId, techStack: p.systems || "",
      remarks: "", productUrl: "",
      assignees: team,
      stageHistory: [{ stage: PIPELINE[0], at: nowIso, by: byId }],
      attachments: (r.files || []).map(f => ({ name: f.name, size: f.size, by: byId, at: nowIso, url: f.url || "", path: f.path || "" })),
      links: [], comments: [], queries: [],
      history: [{ at: nowIso, by: byId, ev: `Created from requirement ${r.publicId} (${r.department} · ${r.requestor})`
        + (r.score != null ? ` — priority score ${r.score}/100, ${r.band}` : "") }],
    };
    createTask(task);
    setReqs(rs => rs.map(x => x.id === r.id ? { ...x, status: "approved", decidedBy: byId, taskId: id } : x));
    if (DB.hasDb()) DB.decideRequirement(r.dbId ?? r.id, { source: r.source, dbId: r.dbId, status: "approved", decidedBy: byId, taskId: id });
    notify(USERS.map(u => u.id), `“${r.title}” was approved from requirement ${r.publicId} and is now task #${nextNo}`, id, byId);
    return id;
  };

  const rejectRequirement = (r, byId, reason) => {
    setReqs(rs => rs.map(x => x.id === r.id ? { ...x, status: "rejected", decidedBy: byId, rejectReason: reason } : x));
    if (DB.hasDb()) DB.decideRequirement(r.dbId ?? r.id, { source: r.source, dbId: r.dbId, status: "rejected", decidedBy: byId, rejectReason: reason });
  };

  const bumpUsers = () => {
    setUsersTick(t => t + 1);
    if (DB.hasDb()) DB.savePeople(USERS);
  };
  const store = { tasks, setTasks, createTask, removeTask, updateTask, dbLive, markAllRead, reqs, approveRequirement, rejectRequirement, audit, logAudit, notifs, setNotifs, notify, emails, sendEmail, sendProgressEmail, chat, sendChat, chatRead, markChatRead, groq, setGroq, mail, setMail, formUrl, setFormUrl, bumpUsers };

  const intro = showIntro ? <Intro onDone={() => setShowIntro(false)} /> : null;
  const user = session && USERS.find(u => u.id === session.userId);
  if (!user) return <Boundary>{intro}<WhoAreYou onPick={setSession} /></Boundary>;
  return <Boundary>{intro}<Shell user={user} store={store} theme={theme} flipTheme={flipTheme}
    onLogout={() => setSession(null)} /></Boundary>;
}

/* ------------------------------------------------------------------ */
/*  Particle network — drifting dots linked by lines, gentle mouse push */
/* ------------------------------------------------------------------ */
function ParticleNetwork({ color = "23,24,20", lineColor = "23,24,20", count, linkDist = 130, dotAlpha = .8, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, pts = [], raf = 0;
    const mouse = { x: -9e3, y: -9e3 };
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      W = cv.offsetWidth; H = cv.offsetHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = count || Math.max(30, Math.min(100, Math.round(W * H / 16000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .34, vy: (Math.random() - .5) * .34,
        r: 1 + Math.random() * 1.6,
      }));
    };

    const draw = (animate) => {
      ctx.clearRect(0, 0, W, H);
      if (animate) for (const p of pts) {
        // gentle mouse repulsion within 120px
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400 && d2 > .01) {
          const d = Math.sqrt(d2), f = ((120 - d) / 120) * .022;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        p.vx *= .994; p.vy *= .994;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > .7) { p.vx *= .7 / sp; p.vy *= .7 / sp; }
        if (sp < .06) { p.vx += (Math.random() - .5) * .04; p.vy += (Math.random() - .5) * .04; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
        if (p.y < -12) p.y = H + 12; else if (p.y > H + 12) p.y = -12;
      }
      ctx.lineWidth = 1.3;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            ctx.strokeStyle = `rgba(${lineColor},${(1 - Math.sqrt(d2) / linkDist) * .5})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (animate) {
          const mdx = a.x - mouse.x, mdy = a.y - mouse.y, md2 = mdx * mdx + mdy * mdy;
          if (md2 < 25600) {
            ctx.strokeStyle = `rgba(${lineColor},${(1 - Math.sqrt(md2) / 160) * .65})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${color},${dotAlpha})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      }
    };

    const loop = () => { draw(true); raf = requestAnimationFrame(loop); };
    const onMove = e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onLeave = () => { mouse.x = -9e3; mouse.y = -9e3; };

    resize();
    if (reduced) draw(false); else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...style }} />;
}

/* ------------------------------------------------------------------ */
/*  Login portal — pick your name, no password                         */
/* ------------------------------------------------------------------ */
function WhoAreYou({ onPick }) {
  const [lightMode, setLightMode] = useState(T.bg === THEMES.light.bg);
  const flipLogin = () => { const next = lightMode ? "dark" : "light"; applyTheme(next); setLightMode(!lightMode); };

  const P = lightMode ? {
    pageBg: "radial-gradient(1100px 460px at 50% 112%, rgba(23,24,20,.05), transparent 62%), linear-gradient(180deg,#F7F6F3 0%,#EFEEE9 100%)",
    ink: "#17181A", h1: "#141519", sub2: "#5D5E5B",
    starDot: "rgba(23,24,20,.28)", cardBg: "#FFFFFF", cardBorder: "rgba(23,24,20,.11)",
    rowBg: "rgba(23,24,26,.04)", rowBorder: "rgba(23,24,26,.14)",
    logoInk: "#17181A", pDots: "23,24,20", pLines: "23,24,20", fcardBg: "rgba(255,255,255,.7)",
  } : {
    pageBg: "radial-gradient(1100px 460px at 50% 112%, rgba(255,255,255,.05), transparent 62%), linear-gradient(180deg,#0E0F12 0%,#0A0B0E 100%)",
    ink: "#F4F4F2", h1: "#FAFAF8", sub2: "#8E8F8C",
    starDot: "rgba(255,255,255,.4)", cardBg: "rgba(22,23,27,.85)", cardBorder: "rgba(255,255,255,.12)",
    rowBg: "rgba(255,255,255,.04)", rowBorder: "rgba(255,255,255,.14)",
    logoInk: "#FFFFFF", pDots: "220,220,215", pLines: "220,220,215", fcardBg: "rgba(255,255,255,.05)",
  };

  return (
    <div className="lp"
      style={{ minHeight: "100vh", position: "relative", overflow: "hidden", color: P.ink, fontFamily: "'Inter',sans-serif", background: P.pageBg, transition: "background .3s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        :focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:4px}
        .lp *{box-sizing:border-box}
        .stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(${P.starDot} 1px,transparent 1.5px);background-size:210px 160px;opacity:.35;animation:twinkle 5s ease-in-out infinite alternate}
        .stars.s2{background-size:120px 200px;background-position:60px 90px;opacity:.18;animation-delay:2.2s}
        @keyframes twinkle{from{opacity:.16}to{opacity:.42}}
        .lnav{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:12px 26px 4px}
        .hero{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 20px 44px}
        @keyframes lpRise{from{opacity:0;transform:translateY(16px)}}
        .hero>*{animation:lpRise .6s cubic-bezier(.16,1,.3,1) backwards}
        .hero>*:nth-child(2){animation-delay:.12s}.hero>*:nth-child(3){animation-delay:.2s}
        .pill{display:inline-flex;align-items:center;gap:8px;margin-top:6px;padding:8px 18px;border-radius:99px;font-size:13px;font-weight:600;color:${P.sub2};
          border:1px solid ${P.rowBorder};background:${P.fcardBg};backdrop-filter:blur(6px)}
        .h1{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-.8px;line-height:1.08;margin:18px 0 0;
          font-size:clamp(24px,3.4vw,40px);color:${P.h1};max-width:720px}
        .card{position:relative;z-index:2;margin-top:22px;width:100%;max-width:430px;text-align:left;border-radius:18px;padding:26px 26px 22px;
          background:${P.cardBg};backdrop-filter:blur(14px);
          border:1px solid ${P.cardBorder};box-shadow:0 30px 80px -30px rgba(0,0,10,.9),0 0 50px -18px rgba(23,24,26,.35)}
        .rolebtn{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border-radius:14px;cursor:pointer;text-align:left;
          font-family:'Inter',sans-serif;background:${P.rowBg};border:1.5px solid ${P.rowBorder};transition:transform .15s cubic-bezier(.16,1,.3,1),border-color .15s}
        .rolebtn:hover{transform:translateX(4px);border-color:${P.ink}}
        @media(prefers-reduced-motion:reduce){.stars,.hero>*,.rolebtn{animation:none!important;transition:none!important;transform:none!important}}`}</style>

      <div className="stars" /><div className="stars s2" />
      <ParticleNetwork key={lightMode ? "l" : "d"} color={P.pDots} lineColor={P.pLines} style={{ zIndex: 1, opacity: lightMode ? .65 : .85 }} />

      <div className="lnav">
        <ZiuLogo animate sub="CONNECT" subColor={ZIU_BRAND} ink={P.logoInk} style={{ height: 54, width: "auto" }} />
        <button onClick={flipLogin} title={lightMode ? "Switch to dark theme" : "Switch to light theme"} style={{
          width: 40, height: 40, borderRadius: 99, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${P.cardBorder}`, background: P.fcardBg, color: P.sub2, backdropFilter: "blur(6px)",
        }}>
          {lightMode ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>

      <div className="hero">
        <div className="pill"><CircleDot size={13} color={ZIU_BRAND} /> Enterprise Task &amp; Workflow Platform</div>
        <h1 className="h1">Connect. Assign. Deliver.</h1>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 2 }}>Who are you?</div>
          <div style={{ color: P.sub2, fontSize: 12.5, marginBottom: 16 }}>Pick your name to open your workspace. No password needed.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {LOGIN_LIST().map(u => (
              <button key={u.id} className="rolebtn" onClick={() => onPick({ userId: u.id })}>
                <Avatar id={u.id} size={30} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: P.ink }}>{u.name}</span>
                </span>
                <ChevronRight size={15} color={P.sub2} />
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: P.sub2, marginTop: 14, lineHeight: 1.5 }}>
            <Shield size={11} style={{ verticalAlign: -1.5 }} /> Your name decides what you can do once you are inside.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell: sidebar + topbar + routing                                  */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Products — mega-menu of everything on the board                     */
/* ------------------------------------------------------------------ */
function ProductsMenu({ tasks, goTask }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative", flexShrink: 0 }} className="hide-sm">
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 99, cursor: "pointer",
        border: `1px solid ${open ? T.accent : T.line}`, background: open ? T.accentSoft : T.raise,
        color: open ? T.accentInk : T.body, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13,
      }}>
        Products
        <ChevronRight size={14} style={{ transform: `rotate(${open ? -90 : 90}deg)`, transition: "transform .18s" }} />
      </button>

      {open && (
        <div style={{
          position: "fixed", top: 68, left: 16, right: 16, zIndex: 60, width: "auto", maxWidth: 1120, margin: "0 auto",
          background: T.pop, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden",
          boxShadow: "0 30px 70px -20px rgba(0,0,0,.55)",
          animation: "modalin .18s cubic-bezier(.2,.8,.2,1)",
        }}>
          <div className="prodscroll" style={{ padding: "16px 18px", maxHeight: "min(78vh, 900px)", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: -.3, marginBottom: 12 }}>
              Products
            </div>
            {tasks.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No products yet.</div>}
            <div className="prodgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
              <style>{`@media(max-width:900px){.prodgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
                @media(max-width:620px){.prodgrid{grid-template-columns:minmax(0,1fr)!important}}
                .prodcard{border:1px solid ${T.line};border-radius:13px;padding:13px 14px;cursor:pointer;background:${T.surface};
                  transition:border-color .15s,transform .15s,box-shadow .15s;text-align:left;font-family:'Inter',sans-serif;
                  width:100%;display:block;text-decoration:none}
                .prodscroll{scrollbar-width:none;-ms-overflow-style:none}
                .prodscroll::-webkit-scrollbar{width:0;height:0;display:none}
                .prodcard,.prodcard *{-webkit-user-drag:none;user-select:none}
                .prodcard:hover{border-color:${T.accent};transform:translateY(-2px);box-shadow:${T.shadow}}
                .prodcard:hover .prodgo{gap:8px}`}</style>
              {tasks.map(t => {
                const inner = (
                  <>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: STATUS[t.status].bg, color: STATUS[t.status].c, fontWeight: 800, fontSize: 12,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}>{t.no}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: T.mut, lineHeight: 1.5, minHeight: 36,
                      overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {t.desc}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <StatusChip s={t.status} />
                      {t.blocked && <Chip label="Blocked" c={T.red} bg={T.redSoft} />}
                      <span className="prodgo" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
                        color: t.productUrl ? T.accent : T.faint, fontWeight: 800, fontSize: 11.5, letterSpacing: .5, transition: "gap .15s" }}>
                        {t.productUrl ? <>OPEN <ExternalLink size={12} /></> : <>ADD LINK <ChevronRight size={13} /></>}
                      </span>
                    </span>
                  </>
                );
                /* with a product link this is a real link straight to the tool;
                   without one it opens the task so someone can add it */
                return t.productUrl ? (
                  <a key={t.id} className="prodcard" href={t.productUrl} target="_blank" rel="noopener noreferrer"
                     draggable={false} onDragStart={e => e.preventDefault()}
                     title={t.productUrl} onClick={() => setOpen(false)}>{inner}</a>
                ) : (
                  <button key={t.id} className="prodcard" title="No product link yet — opens the task so you can add one"
                          onClick={() => { setOpen(false); goTask(t.id); }}>{inner}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* small chip: shared-and-live, shared-but-reconnecting, or this browser only */
function DbBadge({ state }) {
  const look = {
    live:       { c: T.green, bg: T.greenSoft, label: "Live",       tip: "Connected to the shared database — everyone sees the same board." },
    connecting: { c: T.amber, bg: T.amberSoft, label: "Connecting", tip: "Reaching the shared database…" },
    retrying:   { c: T.amber, bg: T.amberSoft, label: "Reconnecting", tip: "Lost the live connection — retrying. Your changes are still being saved." },
    error:      { c: T.red,   bg: T.redSoft,   label: "No database", tip: "Could not reach the database. Check the URL and key in config.js." },
    offline:    { c: T.red,   bg: T.redSoft,   label: "Offline",    tip: "Not connected to the shared database." },
    off:        { c: T.mut,   bg: T.graySoft,  label: "This browser", tip: "No database configured — this board is private to this browser. Add your Supabase details to config.js to share it." },
  }[state] || null;
  if (!look) return null;
  return (
    <span className="hide-sm" title={look.tip} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99,
      background: look.bg, color: look.c, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: look.c }} />
      {look.label}
    </span>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div className="hide-sm" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.25 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 600, color: T.ink }}>
        {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span style={{ fontSize: 10.5, color: T.faint }}>
        {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </span>
    </div>
  );
}

function Celebration() {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const fn = () => setBurst(b => b + 1);
    window.addEventListener("ziu-celebrate", fn);
    return () => window.removeEventListener("ziu-celebrate", fn);
  }, []);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 1500);
    return () => clearTimeout(t);
  }, [burst]);
  const bits = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    x: (Math.random() * 2 - 1) * 130, y: -60 - Math.random() * 90, r: Math.random() * 300 - 150,
    c: [T.green, T.blue, T.amber, T.purple, T.red, T.cyan][i % 6], d: .05 + Math.random() * .12,
  })), [burst]);
  if (!burst) return null;
  return (
    <div key={burst} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 90, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ overflow: "visible" }}>
        <circle cx="48" cy="48" r="34" fill="none" stroke={T.green} strokeWidth="4"
          strokeDasharray="214" strokeDashoffset="214" style={{ animation: "celring .55s cubic-bezier(.4,0,.2,1) forwards" }} />
        <path d="M33 49 L44 60 L64 38" fill="none" stroke={T.green} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="46" strokeDashoffset="46" style={{ animation: "celcheck .4s cubic-bezier(.4,0,.2,1) .45s forwards" }} />
        {bits.map((b, i) => (
          <rect key={i} x="45" y="45" width="7" height="7" rx="2" fill={b.c}
            style={{ animation: `celbit 1s cubic-bezier(.2,.7,.3,1) ${b.d}s forwards`, "--cx": b.x + "px", "--cy": b.y + "px", "--cr": b.r + "deg" }} />
        ))}
      </svg>
    </div>
  );
}

function PageSkeleton() {
  const bar = (w, h = 15, mt = 0) => (
    <div className="shimmer" style={{ width: w, height: h, marginTop: mt, borderRadius: 8 }} />
  );
  return (
    <div aria-hidden="true">
      {bar("38%", 24)}{bar("22%", 12, 8)}
      <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
        {[0, 1, 2, 3].map(i => <div key={i} className="shimmer" style={{ flex: 1, height: 84, borderRadius: 14 }} />)}
      </div>
      <div className="shimmer" style={{ height: 220, borderRadius: 14, marginTop: 22 }} />
    </div>
  );
}

function CommandPalette({ open, onClose, tasks, goTask, navItems, goNav }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  const ql = q.trim().toLowerCase();
  const navHits = navItems.filter(([, label]) => !ql || label.toLowerCase().includes(ql))
    .map(([key, label, Icon]) => ({ kind: "nav", key, label: "Go to " + label, Icon }));
  const taskHits = tasks.filter(t => !ql || t.title.toLowerCase().includes(ql) || ("#" + t.no).includes(ql) || String(t.no) === ql)
    .slice(0, 7).map(t => ({ kind: "task", key: t.id, label: `#${t.no} · ${t.title}`, status: t.status }));
  const items = [...(ql ? [] : navHits), ...taskHits, ...(ql ? navHits : [])].slice(0, 9);
  const pick = it => { if (!it) return; it.kind === "task" ? goTask(it.key) : goNav(it.key); onClose(); };
  if (!open) return null;
  return (
    <div onMouseDown={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,7,10,.55)", backdropFilter: "blur(3px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "16vh", animation: "fadein .15s ease-out",
    }}>
      <div style={{ width: "100%", maxWidth: 520, background: T.pop, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 80px -20px rgba(0,0,0,.55)", animation: "modalin .25s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Search size={16} color={T.mut} />
          <input ref={inputRef} value={q} placeholder="Search tasks or jump anywhere…"
            onChange={e => { setQ(e.target.value); setSel(0); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
              if (e.key === "Enter") pick(items[sel]);
              if (e.key === "Escape") onClose();
            }}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: T.ink, fontSize: 14.5, fontFamily: "'Inter',sans-serif" }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.faint, border: `1px solid ${T.line}`, borderRadius: 6, padding: "2px 6px" }}>ESC</span>
        </div>
        <div style={{ maxHeight: 330, overflowY: "auto", padding: 6 }}>
          {items.length === 0 && <div style={{ padding: "18px 14px", fontSize: 13, color: T.faint }}>No matches — try a task number or title.</div>}
          {items.map((it, i) => (
            <button key={it.kind + it.key} onClick={() => pick(it)} onMouseEnter={() => setSel(i)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px",
              borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
              background: i === sel ? T.accentSoft : "transparent", color: T.ink, fontSize: 13.5,
            }}>
              {it.kind === "nav" ? <it.Icon size={15} color={T.mut} /> : <ClipboardList size={15} color={T.mut} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              {it.status && <span style={{ marginLeft: "auto" }}><StatusChip s={it.status} /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Shell({ user, store, theme, flipTheme, onLogout }) {
  useEffect(() => {
    const mv = e => {
      const card = e.target.closest && e.target.closest(".c3d");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    };
    document.addEventListener("mousemove", mv, { passive: true });
    // background orb: rotates a full 360° across the page scroll, proportionally
    let orbIdle;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const deg = (window.scrollY / max) * 360;
      const de = document.documentElement;
      de.style.setProperty("--orb", deg.toFixed(1) + "deg");
      de.style.setProperty("--orbA", "1");                    // highlight while scrolling
      clearTimeout(orbIdle);
      orbIdle = setTimeout(() => de.style.setProperty("--orbA", "0"), 550);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousemove", mv);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(orbIdle);
    };
  }, []);
  const [nav, setNav] = useState("dashboard");
  const [pageLoading, setPageLoading] = useState(false);
  const goNav = k => { if (k !== nav) { setNav(k); setPageLoading(true); } };
  useEffect(() => {
    if (!pageLoading) return;
    const t = setTimeout(() => setPageLoading(false), 340);
    return () => clearTimeout(t);
  }, [pageLoading, nav]);
  const [palette, setPalette] = useState(false);
  const [guide, setGuide] = useState(true);
  useEffect(() => {
    const kd = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(p => !p); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, []);
  const [bellRing, setBellRing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const seenNotifs = useRef(null);
  useEffect(() => {
    const mine = store.notifs.filter(n => n.to === user.id);
    if (seenNotifs.current === null) { seenNotifs.current = new Set(mine.map(n => n.id)); return; }
    const fresh = mine.filter(n => !seenNotifs.current.has(n.id));
    if (fresh.length) {
      fresh.forEach(n => seenNotifs.current.add(n.id));
      setToasts(ts => [...ts, ...fresh.map(n => ({ id: n.id, text: n.text, task: n.task }))]);
      fresh.forEach(n => setTimeout(() => setToasts(ts => ts.filter(x => x.id !== n.id)), 6000));
    }
  }, [store.notifs, user.id]);
  const [openTask, setOpenTask] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { type, taskId? }

  const myNotifs = store.notifs.filter(n => n.to === user.id);
  const unread = myNotifs.filter(n => !n.read).length;
  const prevUnread = useRef(unread);
  useEffect(() => {
    if (unread > prevUnread.current) { setBellRing(true); const t = setTimeout(() => setBellRing(false), 1100); prevUnread.current = unread; return () => clearTimeout(t); }
    prevUnread.current = unread;
  }, [unread]);

  const pendingReqs = store.reqs.filter(r => r.status === "submitted").length;
  const NAV = [
    ["dashboard", "Overview", LayoutDashboard],
    ["automation", "Automation requests", Inbox, pendingReqs],
    ["team", "Team performance", Users],
    ["reports", "Analysis", BarChart3],
    ["settings", "Settings", Settings],
  ];

  const task = store.tasks.find(t => t.id === openTask);

  const goTask = id => { setOpenTask(id); setShowNotifs(false); };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',sans-serif", color: T.ink, display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        input:focus,select:focus,textarea:focus{border-color:#17181A!important;box-shadow:0 0 0 3px rgba(23,24,26,.10)}
        ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:6px}
        @media(max-width:860px){.side-label{display:none}.sidebar{width:60px!important}
          .side-brand{justify-content:center;padding:14px 6px 10px!important}
          .side-logo{height:34px!important}}
        .c3d{box-shadow:${T.shadow};
             backdrop-filter:blur(10px);transition:transform .18s ease,box-shadow .18s ease,border-color .18s}
        .c3d-lift:hover{transform:translateY(-3px);border-color:${T.liftBorder}!important;
             box-shadow:${T.shadowHover}}
        .btn3d{box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 1px 2px rgba(23,24,26,.25),0 6px 14px -8px rgba(23,24,26,.35)}
        .btn3d:active{transform:translateY(1px);box-shadow:0 1px 3px -1px rgba(23,24,26,.35)}
        /* scroll-driven background orb: one full 360° per page scroll */
        .scroll-orb{position:fixed;right:-190px;top:14%;width:580px;height:580px;pointer-events:none;z-index:0;
          opacity:calc(.13 + var(--orbA,0)*.17);color:${T.ink};
          transform:rotate(var(--orb,0deg)) scale(calc(1 + var(--orbA,0)*.025));will-change:transform;
          transition:transform .15s linear,opacity .6s ease}
        @media(max-width:960px){.scroll-orb{display:none}}
        @media(prefers-reduced-motion:reduce){.scroll-orb{transform:none!important;transition:none!important}}
        /* --- motion layer --- */
        @keyframes fadein{from{opacity:0}}
        @keyframes modalin{from{opacity:0;transform:translateY(14px) scale(.97)}}
        @keyframes risein{from{opacity:0;transform:translateY(14px)}}
        @keyframes bargrow{from{transform:scaleX(0)}}
        /* celebration */
        @keyframes celring{to{stroke-dashoffset:0}}
        @keyframes celcheck{to{stroke-dashoffset:0}}
        @keyframes celbit{0%{opacity:0;transform:translate(0,0) rotate(0)}12%{opacity:1}
          to{opacity:0;transform:translate(var(--cx),calc(var(--cy) * -1 + 160px)) rotate(var(--cr))}}
        /* bell + badge */
        @keyframes bellring{0%,100%{transform:rotate(0)}12%{transform:rotate(16deg)}28%{transform:rotate(-13deg)}
          44%{transform:rotate(9deg)}60%{transform:rotate(-6deg)}76%{transform:rotate(3deg)}}
        @keyframes badgepop{from{transform:scale(0)}60%{transform:scale(1.25)}to{transform:scale(1)}}
        /* skeleton shimmer */
        .shimmer{position:relative;overflow:hidden;background:${T.graySoft}}
        .shimmer::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
          background:linear-gradient(90deg,transparent,${T.dateInv === "0" ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.07)"},transparent);
          animation:shimmer 1.1s ease-in-out infinite}
        @keyframes shimmer{to{transform:translateX(100%)}}
        /* pipeline stepper */
        @keyframes connGrow{from{transform:scaleX(0)}}
        @keyframes nodePop{from{transform:scale(0);opacity:0}70%{transform:scale(1.18)}to{transform:scale(1);opacity:1}}
        /* reactions */
        @keyframes rxnpop{from{transform:scale(.4);opacity:0}65%{transform:scale(1.15)}to{transform:scale(1);opacity:1}}
        /* typing indicator */
        .typedots{display:inline-flex;gap:4px;align-items:center}
        .typedots i{width:6px;height:6px;border-radius:50%;background:${T.mut};animation:tdb 1.1s ease-in-out infinite}
        .typedots i:nth-child(2){animation-delay:.15s}.typedots i:nth-child(3){animation-delay:.3s}
        @keyframes tdb{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
        /* keyboard focus */
        :focus-visible{outline:2px solid ${T.ink};outline-offset:2px;border-radius:4px}
        .app-main>*{animation:risein .55s cubic-bezier(.16,1,.3,1) backwards}
        .app-main>*:nth-child(1){animation-delay:.03s}.app-main>*:nth-child(2){animation-delay:.09s}
        .app-main>*:nth-child(3){animation-delay:.15s}.app-main>*:nth-child(4){animation-delay:.21s}
        .app-main>*:nth-child(5){animation-delay:.27s}.app-main>*:nth-child(6){animation-delay:.33s}
        /* cursor spotlight that follows the mouse across every card */
        .c3d{position:relative}
        .c3d::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
          transition:opacity .35s ease;
          background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),${T.dateInv === "0" ? "rgba(23,24,26,.055)" : "rgba(255,255,255,.075)"},transparent 65%)}
        .c3d:hover::before{opacity:1}
        /* buttons: lift toward the cursor */
        .btn3d{transition:transform .16s cubic-bezier(.16,1,.3,1),box-shadow .2s,filter .12s}
        .btn3d:hover{transform:translateY(-1.5px)}
        /* sidebar nav: nudge + icon slide */
        .sidebar nav button{transition:transform .18s cubic-bezier(.16,1,.3,1),background .15s,color .15s}
        .sidebar nav button:hover{transform:translateX(4px)}
        /* header icon buttons: playful wiggle on hover */
        @keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}60%{transform:rotate(7deg)}}
        .app-header button:hover svg{animation:wiggle .45s ease-in-out}
        /* task rows glide */
        .trow{transition:background .15s,transform .18s cubic-bezier(.16,1,.3,1)}
        .trow:hover{background:${T.hover}!important;transform:translateX(4px)}
        /* chat messages pop in */
        @keyframes msgin{from{opacity:0;transform:translateY(8px) scale(.98)}}
        .chatmsgs>*{animation:msgin .28s cubic-bezier(.16,1,.3,1) backwards}
        /* status chips breathe on hover */
        .c3d .stat-card,.c3d span{transition:transform .15s}
        .side-logo:hover .zl-sheen{animation:zlSheen 1.1s cubic-bezier(.4,0,.2,1) both}
        .dotgrid{background-image:radial-gradient(${T.dot} 1px,transparent 1px);background-size:22px 22px}
        .hero-glow{position:fixed;pointer-events:none;z-index:0;width:640px;height:640px;border-radius:50%;
             background:radial-gradient(circle,rgba(23,24,20,.05) 0%,rgba(23,24,20,.02) 45%,transparent 72%);top:-260px;right:-140px}
        ::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
        ::view-transition-new(root){clip-path:circle(0 at var(--tvx,50%) var(--tvy,50%));animation:themewipe .45s cubic-bezier(.4,0,.2,1) forwards}
        @keyframes themewipe{to{clip-path:circle(155% at var(--tvx,50%) var(--tvy,50%))}}
        select,option{background-color:${T.input};color:${T.ink}}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(${T.dateInv})}
        input::placeholder,textarea::placeholder{color:${T.faint}}
        @media(prefers-reduced-motion:reduce){.c3d,.c3d-lift:hover,.btn3d:active,.app-main>*,.chatmsgs>*,.trow,.sidebar nav button,.shimmer::after,.typedots i{transition:none!important;transform:none!important;animation:none!important}}
        @media(max-width:640px){
          .app-main{padding:14px 12px 70px!important}
          .app-header{padding:8px 12px!important;gap:8px!important}
          .trow{grid-template-columns:1fr auto!important;gap:10px!important;padding:12px 12px!important}
          .task-num,.row-people{display:none!important}
          .stat-card{min-width:calc(50% - 8px)!important}
          .mgrid{grid-template-columns:1fr!important}
          .page-h1{font-size:20px!important}
        }
        @media(max-width:440px){.row-prog{display:none!important}}`}</style>

      {/* Sidebar */}
      <aside className="sidebar" style={{ width: 216, background: "linear-gradient(180deg,#17181C 0%,#101114 100%)", borderRight: `1px solid ${T.line}`, boxShadow: "1px 0 0 rgba(255,255,255,.06) inset", color: "#B7B8B4", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        <div className="side-brand" style={{ display: "flex", justifyContent: "flex-start", padding: "18px 14px 14px" }}>
          <ZiuLogo animate sub="CONNECT" subColor={ZIU_BRAND} className="side-logo" style={{ height: 52, width: "auto", flexShrink: 0 }} />
        </div>
        <nav style={{ padding: "6px 10px", display: "grid", gap: 3 }}>
          {NAV.map(([key, label, Icon, badge]) => {
            const active = nav === key && !openTask;
            return (
              <button key={key} onClick={() => { goNav(key); setOpenTask(null); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 12,
                background: active ? "rgba(23,24,26,.14)" : "transparent", color: active ? "#EAF0F6" : "#7C8896", borderLeft: active ? "2px solid #17181A" : "2px solid transparent",
                border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: "'Inter',sans-serif", width: "100%", textAlign: "left",
              }}>
                <Icon size={16} /><span className="side-label">{label}</span>
                {badge > 0 && <span className="side-label" style={{ marginLeft: "auto", background: T.red, color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: "1px 6px" }}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", padding: 12, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Avatar id={user.id} size={30} />
            <div className="side-label" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 10.5, color: "#6B7684", fontFamily: "'JetBrains Mono',monospace" }}>{rlabel(user)}</div>
            </div>
            <button onClick={onLogout} title="Sign out" className="side-label" style={{
              marginLeft: "auto", width: 28, height: 28, borderRadius: 99, flexShrink: 0, cursor: "pointer",
              border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#8E99A6",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="dotgrid" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <div className="hero-glow" />
        <div className="scroll-orb" aria-hidden="true">
          <svg viewBox="0 0 560 560" width="100%" height="100%">
            <g fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="280" cy="280" r="252" strokeWidth="2.2" />
              <ellipse cx="280" cy="280" rx="252" ry="78" />
              <ellipse cx="280" cy="170" rx="212" ry="52" />
              <ellipse cx="280" cy="390" rx="212" ry="52" />
              <ellipse cx="280" cy="280" rx="92" ry="252" />
              <ellipse cx="280" cy="280" rx="180" ry="252" />
            </g>
            <circle cx="280" cy="280" r="300" fill="none" stroke={T.accent} strokeWidth="1.6" strokeDasharray="2 10" opacity=".8" />
            <g>
              <circle cx="120" cy="180" r="9" fill={T.blue} /><circle cx="452" cy="210" r="9" fill={T.purple} />
              <circle cx="392" cy="452" r="9" fill={T.green} /><circle cx="280" cy="28" r="8" fill={T.amber} />
              <circle cx="60" cy="360" r="7" fill={T.cyan} />
            </g>
          </svg>
        </div>
        {/* Topbar */}
        <header className="app-header" style={{ position: "sticky", top: 0, zIndex: 30, background: T.headerBg, backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", flex: "0 1 380px" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: T.faint }} />
            <input value={q} onChange={e => { setQ(e.target.value); if (e.target.value) { setNav("dashboard"); setOpenTask(null); } }}
              placeholder="Search tasks, IDs, people…" style={{ ...inputStyle, paddingLeft: 34, borderRadius: 99 }} />
          </div>
          <ProductsMenu tasks={store.tasks} goTask={id => { setOpenTask(null); goTask(id); }} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <DbBadge state={store.dbLive} />
            <LiveClock />
            <button onClick={flipTheme} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              style={{ width: 36, height: 36, borderRadius: 99, border: `1px solid ${T.line}`, background: T.raise, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.mut }}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {canAdmin(user) && <Btn small onClick={() => setModal({ type: "new" })}><Plus size={14} /> New task</Btn>}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifs(s => !s)} style={{ position: "relative", width: 36, height: 36, border: `1px solid ${T.line}`, background: T.raise, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 99 }}>
                <Bell size={16} color={bellRing ? T.ink : T.mut} style={bellRing ? { animation: "bellring 1s cubic-bezier(.36,.07,.19,.97)", transformOrigin: "top center" } : undefined} />
                {unread > 0 && <span key={unread} style={{ position: "absolute", top: -4, right: -4, background: T.red, color: T.btnText, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 5px", animation: "badgepop .4s cubic-bezier(.34,1.56,.64,1)" }}>{unread}</span>}
              </button>
              {showNotifs && <NotifPanel notifs={myNotifs} onOpen={goTask} onClose={() => setShowNotifs(false)}
                markAll={() => { store.setNotifs(n => n.map(x => x.to === user.id ? { ...x, read: true } : x)); store.markAllRead?.(user.id); }} />}
            </div>
          </div>
        </header>

        <main className="app-main" style={{ padding: "22px 24px 60px", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {task
            ? <TaskDetail task={task} user={user} store={store} back={() => setOpenTask(null)} setModal={setModal} />
            : pageLoading ? <PageSkeleton />
            : <>
              {guide && nav === "dashboard" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", border: `1px solid ${T.line}`, borderRadius: 14, marginBottom: 16, fontSize: 12.5, color: T.mut, flexWrap: "wrap" }}>
                  <Sparkles size={14} color={T.amber} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 220 }}>
                    <><b style={{ color: T.ink }}>How it works:</b> every new task starts a 9-stage pipeline at <b style={{ color: T.ink }}>Task assigned</b> → move it stage by stage to <b style={{ color: T.ink }}>Go Live</b> → flag <b style={{ color: T.ink }}>Blocked</b> with a reason when something is stuck.</>
                  </span>
                  <button onClick={() => setGuide(false)} title="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex", padding: 2 }}><X size={14} /></button>
                </div>
              )}
              {nav === "dashboard" && <SubAdminDash store={store} user={user} goTask={goTask} setModal={setModal} q={q} setQ={setQ} />}
              {nav === "team" && <TeamPerformance store={store} goTask={goTask} />}
              {nav === "automation" && <AutomationRequestsPage store={store} user={user} goTask={goTask} />}
              {nav === "reports" && <Reports store={store} />}
              {nav === "settings" && <SettingsPage user={user} store={store} theme={theme} flipTheme={flipTheme} openPalette={() => setPalette(true)} />}
            </>}
        </main>
      </div>

      <Celebration />
      <CommandPalette open={palette} onClose={() => setPalette(false)} tasks={store.tasks}
        goTask={id => { goTask(id); }} navItems={NAV} goNav={k => { goNav(k); setOpenTask(null); }} />

      {/* pop-up notifications */}
      <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 80, display: "grid", gap: 8, maxWidth: 330 }}>
        {toasts.map(x => (
          <button key={x.id} onClick={() => { if (x.task) goTask(x.task); else { setDrawerTab("team"); setChatOpen(true); } setToasts(ts => ts.filter(y => y.id !== x.id)); }}
            style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12,
              background: T.pop, border: `1px solid ${T.liftBorder}`, color: T.ink, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 18px 44px -12px rgba(0,0,10,.8), 0 0 24px -8px rgba(23,24,26,.4)", animation: "toastin .3s cubic-bezier(.2,.8,.2,1)" }}>
            <Bell size={15} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.8, lineHeight: 1.5 }}>{x.text}</span>
            <X size={13} color={T.faint} style={{ flexShrink: 0, marginLeft: "auto" }}
              onClick={e => { e.stopPropagation(); setToasts(ts => ts.filter(y => y.id !== x.id)); }} />
          </button>
        ))}
      </div>
      <style>{`@keyframes toastin{from{opacity:0;transform:translateY(14px)}}
        @keyframes drawerin{from{transform:translateX(100%)}}`}</style>

      {/* chat FAB — team chat + assistant, available everywhere */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} title="AI assistant"
          style={{ position: "fixed", right: 20, bottom: 20, zIndex: 70, width: 54, height: 54, borderRadius: "50%", border: "none",
            cursor: "pointer", background: T.btnGrad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 3px rgba(23,24,26,.25), 0 10px 30px -6px rgba(23,24,26,.7)" }}>
          <Sparkles size={22} />
        </button>
      )}

      {/* AI assistant drawer */}
      {chatOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 75 }}>
          <div onClick={() => setChatOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,.55)", backdropFilter: "blur(2px)" }} />
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(460px,100%)", background: T.bg, borderLeft: `1px solid ${T.line}`,
            display: "flex", flexDirection: "column", padding: "14px 16px", overflowY: "auto", animation: "drawerin .28s cubic-bezier(.2,.8,.2,1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 99,
                background: T.accentSoft, color: T.accentInk, fontWeight: 700, fontSize: 13 }}>
                <Sparkles size={14} /> AI assistant
              </span>
              <X size={18} color={T.mut} style={{ cursor: "pointer", marginLeft: "auto" }} onClick={() => setChatOpen(false)} />
            </div>
            <AIAssistant store={store} user={user} goTask={id => { setChatOpen(false); goTask(id); }} />
          </div>
        </div>
      )}

      {modal && <Modals modal={modal} setModal={setModal} user={user} store={store} goTask={goTask} />}
    </div>
  );
}

function NotifPanel({ notifs, onOpen, onClose, markAll }) {
  return (
    <div style={{ position: "absolute", right: 0, top: 44, width: 340, background: T.pop, border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 24px 60px -12px rgba(0,0,0,.9)", zIndex: 50, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Notifications</span>
        <button onClick={markAll} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Mark all read</button>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {notifs.length === 0 && <div style={{ padding: 20, color: T.faint, fontSize: 13, textAlign: "center" }}>You're all caught up.</div>}
        {notifs.map(n => (
          <button key={n.id} onClick={() => { onOpen(n.task); onClose(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: n.read ? "transparent" : T.accentSoft, border: "none", borderBottom: `1px solid ${T.line}`, cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 12.8, color: T.ink, lineHeight: 1.45 }}>{n.text}</div>
            <div style={{ fontSize: 11, color: T.faint, marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>{fmtTs(n.at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */
const Card = ({ children, style, lift, className = "" }) => (
  <div className={("c3d" + (lift ? " c3d-lift" : "") + " " + className).trim()} style={{ background: T.glass, border: `1px solid ${T.line}`, borderRadius: 14, ...style }}>{children}</div>
);
const SectionTitle = ({ children, right }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "26px 0 12px" }}>
    <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 16.5, letterSpacing: -.2 }}>{children}</div>
    {right}
  </div>
);
const PageTitle = ({ kicker, title, sub, right }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
    <div>
      {kicker && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1.2, color: T.accent, fontWeight: 600, marginBottom: 5 }}>{kicker}</div>}
      <h1 className="page-h1" style={{ margin: 0, fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 25, letterSpacing: -.5 }}>{title}</h1>
      {sub && <div style={{ color: T.mut, fontSize: 13.5, marginTop: 5, maxWidth: 640 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

function ProgressBar({ v, c = T.accent, h = 6 }) {
  return (
    <div style={{ background: T.graySoft, borderRadius: 99, height: h, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${v}%`, height: "100%", background: c, borderRadius: 99, transformOrigin: "left", animation: "bargrow .8s cubic-bezier(.16,1,.3,1)", transition: "width .7s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

function TaskRow({ t, goTask, showAssignees = true }) {
  return (
    <button className="trow" onClick={() => goTask(t.id)} style={{
      display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 14, alignItems: "center", width: "100%",
      padding: "13px 16px", background: "transparent", border: "none", borderBottom: `1px solid ${T.line}`,
      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.hover}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span className="task-num" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: T.accent }}>#{t.no}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {t.title} {overdue(t) && <AlertTriangle size={13} color={T.red} style={{ verticalAlign: -2, marginLeft: 4 }} />}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
          <StatusChip s={t.status} />{t.blocked && <Chip label="Blocked" c={T.red} bg={T.redSoft} />}<PrioChip p={t.priority} />
          <span style={{ fontSize: 11.5, color: overdue(t) ? T.red : T.faint, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CalendarDays size={12} /> {fmtDate(t.deadline)}
          </span>
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {showAssignees && <span style={{ display: "flex" }}>{t.assignees.map((a, i) => <span key={a} style={{ marginLeft: i ? -8 : 0 }}><Avatar id={a} /></span>)}</span>}
        <span style={{ width: 72 }}><ProgressBar v={progressOf(t)} c={t.blocked ? T.red : STATUS[t.status].c} /></span>
        <ChevronRight size={15} color={T.faint} />
      </span>
    </button>
  );
}

function useCountUp(target, ms = 800) {
  const num = typeof target === "number" ? target : parseFloat(target);
  const ok = Number.isFinite(num);
  const [v, setV] = useState(ok ? 0 : target);
  useEffect(() => {
    if (!ok) { setV(target); return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches) { setV(num); return; }
    let raf; const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(num * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [num, ok, ms, target]);
  if (!ok) return target;
  const suffix = typeof target === "string" ? target.replace(String(num), "") : "";
  return v + suffix;
}

function Stat({ label, value, sub, c = T.ink }) {
  const shown = useCountUp(value);
  return (
    <Card lift style={{ padding: "15px 17px", flex: 1, minWidth: 140 }} className="stat-card">
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase", color: T.mut }}>{label}</div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 27, color: c, marginTop: 4, letterSpacing: -.5 }}>{shown}</div>
      {sub && <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboards                                                         */
/* ------------------------------------------------------------------ */
/* One-line remark per task. Kept in local state while typing so the table
   doesn't re-render on every keystroke, then written on blur or Enter. */
function RemarkCell({ t, store, user }) {
  const saved = t.remarks || "";
  const [val, setVal] = useState(saved);
  const [focused, setFocused] = useState(false);
  /* pick up outside edits, but never yank text out from under the cursor */
  useEffect(() => { if (!focused) setVal(saved); }, [saved, focused]);

  const commit = () => {
    const next = val.trim();
    if (next === saved) return;
    store.updateTask(t.id, { remarks: next },
      next ? `Remark: ${next.slice(0, 60)}${next.length > 60 ? "…" : ""}` : "Remark cleared", user.id);
  };

  if (!canWrite(user)) {
    return <span style={{ fontSize: 12.5, fontWeight: 700, color: saved ? T.ink : T.faint }}>{saved || "—"}</span>;
  }
  return (
    <input
      value={val}
      onClick={e => e.stopPropagation()}
      onChange={e => setVal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setVal(saved); e.currentTarget.blur(); }
      }}
      placeholder="Add a remark…"
      title={val || "Add a remark"}
      style={{
        width: "100%", minWidth: 130, boxSizing: "border-box", padding: "6px 9px",
        borderRadius: 9, border: `1px solid ${focused ? T.accent : T.line}`,
        background: focused ? T.input : "transparent", color: T.ink,
        fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 700, outline: "none",
        transition: "border-color .15s, background .15s",
      }}
    />
  );
}

/* Column widths are dragged by the user and remembered in this browser. */
const COLS = [
  { key: "no",       label: "#",        w: 62,  min: 46 },
  { key: "title",    label: "Task",     w: 260, min: 120 },
  { key: "status",   label: "Status",   w: 150, min: 100 },
  { key: "remarks",  label: "Remarks",  w: 210, min: 120 },
  { key: "poc",      label: "POC",      w: 130, min: 80 },
  { key: "deadline", label: "Deadline", w: 110, min: 90 },
  { key: "team",     label: "Team",     w: 110, min: 80 },
  { key: "progress", label: "Progress", w: 150, min: 110 },
];
const COLS_KEY = "ziu-col-widths-v1";
const loadWidths = () => {
  const base = Object.fromEntries(COLS.map(c => [c.key, c.w]));
  try {
    const saved = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
    return saved ? { ...base, ...saved } : base;
  } catch { return base; }
};

function TaskTable({ rows, goTask, store, user, empty = "No tasks here." }) {
  const [widths, setWidths] = useState(loadWidths);
  const drag = useRef(null);

  /* drag the divider between two headers to resize */
  useEffect(() => {
    const move = e => {
      const d = drag.current; if (!d) return;
      const col = COLS.find(c => c.key === d.key);
      const next = Math.max(col.min, d.startW + (e.clientX - d.startX));
      setWidths(w => (w[d.key] === next ? w : { ...w, [d.key]: next }));
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidths(w => { try { localStorage.setItem(COLS_KEY, JSON.stringify(w)); } catch {} return w; });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const startDrag = (key, e) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { key, startX: e.clientX, startW: widths[key] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const resetWidths = () => {
    const base = Object.fromEntries(COLS.map(c => [c.key, c.w]));
    setWidths(base);
    try { localStorage.removeItem(COLS_KEY); } catch {}
  };

  const th = { position: "relative", textAlign: "left", padding: "10px 14px", fontSize: 10.5, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: T.mut, borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const td = { padding: "11px 14px", borderBottom: `1px solid ${T.line}`, verticalAlign: "middle", overflow: "hidden" };
  const total = COLS.reduce((n, c) => n + widths[c.key], 0);

  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <style>{`.colgrip{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:2}
          .colgrip:after{content:"";position:absolute;left:3px;top:6px;bottom:6px;width:1px;background:${T.line};transition:background .15s,width .15s}
          .colgrip:hover:after{background:${T.accent};width:2px;left:2.5px}`}</style>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed", minWidth: total }}>
          <colgroup>{COLS.map(c => <col key={c.key} style={{ width: widths[c.key] }} />)}</colgroup>
          <thead><tr>
            {COLS.map((c, i) => (
              <th key={c.key} style={th} title={c.key === "poc" ? "Point of Contact — first person to ask" : c.label}>
                {c.label}
                {i < COLS.length - 1 &&
                  <span className="colgrip" title="Drag to resize" onMouseDown={e => startDrag(c.key, e)} onClick={e => e.stopPropagation()} />}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} onClick={() => goTask(t.id)} style={{ cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = T.hover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...td, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: T.accent }}>#{t.no}</td>
                <td style={{ ...td, fontWeight: 600, color: T.ink }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title} {overdue(t) && <AlertTriangle size={12} color={T.red} style={{ verticalAlign: -1 }} />}
                  </span>
                </td>
                <td style={td}><span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}><StatusChip s={t.status} />{t.blocked && <Chip label="Blocked" c={T.red} bg={T.redSoft} />}</span></td>
                <td style={td}><RemarkCell t={t} store={store} user={user} /></td>
                <td style={{ ...td, color: t.poc ? T.body : T.faint }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.poc || "—"}</span>
                </td>
                <td style={{ ...td, color: overdue(t) ? T.red : T.body, whiteSpace: "nowrap" }}>{fmtDate(t.deadline)}</td>
                <td style={td}>
                  <span style={{ display: "flex" }}>
                    {t.assignees.length ? t.assignees.map((a, i) => <span key={a} style={{ marginLeft: i ? -8 : 0 }}><Avatar id={a} size={24} /></span>)
                      : <span style={{ color: T.faint }}>—</span>}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 40 }}><ProgressBar v={progressOf(t)} c={t.blocked ? T.red : STATUS[t.status].c} h={5} /></span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.mut, width: 32, textAlign: "right" }}>{progressOf(t)}%</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div style={{ padding: 20, color: T.faint, fontSize: 13 }}>{empty}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.faint }}>
        <span>Drag the line between column titles to resize.</span>
        <button onClick={resetWidths} style={{ marginLeft: "auto", background: "none", border: "none", color: T.accent, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          Reset widths
        </button>
      </div>
    </Card>
  );
}

function TableTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 24, marginBottom: 14, borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "none",
            border: "none", borderBottom: on ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
            cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
            color: on ? T.ink : T.mut, whiteSpace: "nowrap", marginBottom: -1, transition: "color .15s",
          }}>
            {t.label}
            <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", padding: "1px 8px", borderRadius: 99, background: on ? T.accentSoft : T.graySoft, color: on ? T.accentInk : T.faint }}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function TaskSection({ tabs, user, store, goTask, q = "", setQ = () => {} }) {
  const [tab, setTab] = useState(tabs[0].key);
  const [fStatus, setFStatus] = useState("all");
  const [fPrio, setFPrio] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const cur = tabs.find(t => t.key === tab) || tabs[0];
  let list = cur.rows;
  if (fStatus !== "all") list = fStatus === "__blocked" ? list.filter(t => t.blocked) : list.filter(t => t.status === fStatus);
  if (fPrio !== "all") list = list.filter(t => t.priority === fPrio);
  if (fAssignee !== "all") list = list.filter(t => t.assignees.includes(fAssignee));
  if (q) {
    const s = q.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(s) || ("#" + t.no).includes(s) || String(t.no) === s ||
      t.desc.toLowerCase().includes(s) || t.assignees.some(a => uname(a).toLowerCase().includes(s)));
  }
  const filtered = q || fStatus !== "all" || fPrio !== "all" || fAssignee !== "all";
  const selStyle = { ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13, marginBottom: 0 };
  return (
    <div>
      <TableTabs active={tab} onChange={setTab} tabs={tabs.map(t => ({ key: t.key, label: t.label, count: t.rows.length }))} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <Filter size={15} color={T.mut} />
        <select style={selStyle} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All stages</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="__blocked">Blocked</option>
        </select>
        <select style={selStyle} value={fPrio} onChange={e => setFPrio(e.target.value)}>
          <option value="all">All priorities</option>
          {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={selStyle} value={fAssignee} onChange={e => setFAssignee(e.target.value)}>
          <option value="all">Anyone assigned</option>
          {STAFF().map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {filtered &&
          <Btn kind="ghost" small onClick={() => { setQ(""); setFStatus("all"); setFPrio("all"); setFAssignee("all"); }}>Clear filters</Btn>}
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: T.faint }}>
          {q ? `“${q}” — ` : ""}{list.length} task{list.length !== 1 ? "s" : ""}
        </span>
      </div>
      <TaskTable rows={list} goTask={goTask} store={store} user={user} empty={filtered ? "No tasks match these filters. Clear one to widen the view." : cur.empty || "No tasks here."} />
    </div>
  );
}

function SubAdminDash({ store, user, goTask, setModal, q, setQ }) {
  const ts = visibleTasks(store.tasks, user);
  const active = ts.filter(t => t.status !== DONE);
  const orgProgress = active.length ? Math.round(active.reduce((s, t) => s + progressOf(t), 0) / active.length) : 0;
  const blocked = ts.filter(t => t.blocked);
  const live = ts.filter(t => t.status === DONE);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <PageTitle kicker={`ZIU CONNECT · ${rlabel(user).toUpperCase()}`} title={`Good day, ${user.name.split(" ")[0]}`}
          sub={isOwner(user) ? "Organisation-wide progress across every task you've raised."
            : isViewer(user) ? "Read-only view of every task across the organisation."
            : "Every task assigned to you, and where each one stands."} />
        {canAdmin(user) && <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn kind="soft" onClick={() => setModal({ type: "team" })}><Users size={15} /> Manage team</Btn>
          <Btn onClick={() => setModal({ type: "new" })}><Plus size={15} /> New task</Btn>
        </div>}
      </div>
      {isViewer(user) && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "9px 14px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.accentSoft, fontSize: 12.5, color: T.mut }}>
          <Eye size={14} color={T.blue} style={{ flexShrink: 0 }} />
          <span><b style={{ color: T.ink }}>View only.</b> You can see everything and join the discussion — comments and team chat — but tasks can't be changed from this account.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Stat label="Active tasks" value={active.length} sub="in the pipeline now" />
        <Stat label="Org progress" value={orgProgress + "%"} sub="avg. pipeline position" c={T.accent} />
        <Stat label="Blocked" value={blocked.length} sub="flagged with a reason" c={blocked.length ? T.red : T.ink} />
        <Stat label="Overdue" value={ts.filter(overdue).length} sub="past deadline" c={ts.filter(overdue).length ? T.red : T.ink} />
        <Stat label="Live" value={live.length} sub="gone live, all time" c={T.green} />
      </div>

      <TaskSection user={user} store={store} goTask={goTask} q={q} setQ={setQ} tabs={[
        { key: "all", label: "All tasks", rows: ts },
        { key: "blocked", label: "Blocked", rows: blocked, empty: "Nothing is blocked. Smooth sailing." },
        { key: "live", label: "Live", rows: live, empty: "Nothing has gone live yet." },
      ]} />
    </div>
  );
}

function TeamPerformance({ store, goTask }) {
  const ts = store.tasks;
  const now = new Date();
  const WEEK_LABELS = ["5w", "4w", "3w", "2w", "1w", "Now"];

  const perMember = STAFF().map(m => {
    const myTasks = ts.filter(t => (t.assignees || []).includes(m.id));
    const open = myTasks.filter(t => t.status !== DONE);
    const done = myTasks.filter(t => t.status === DONE);
    const blockedCount = myTasks.filter(t => t.blocked).length;
    // every pipeline move this person made (skipping the initial "assigned" entry)
    const moves = ts.flatMap(t => (t.stageHistory || []).slice(1).filter(h => h.by === m.id).map(h => ({ ...h, task: t })))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const doubts = ts.reduce((n, t) => n + (t.queries || []).filter(q => q.by === m.id).length, 0);
    const comments = ts.reduce((n, t) => n + t.comments.filter(c => c.by === m.id).length, 0);
    const weeks = [5, 4, 3, 2, 1, 0].map(w =>
      moves.filter(e => Math.min(Math.floor((now - new Date(e.at)) / (7 * 864e5)), 5) === w).length);
    // this-month utilization: effort days on tasks they're on (split between assignees)
    // vs standard availability = working days (Mon–Fri) in the current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const usedDays = ts.reduce((sum, t) => {
      const onIt = (t.assignees || []).includes(m.id);
      if (!onIt || !t.effortDays) return sum;
      const activeThisMonth = t.status !== DONE || (t.closedAt && new Date(t.closedAt) >= monthStart);
      if (!activeThisMonth) return sum;
      const heads = Math.max(1, (t.assignees || []).length);
      return sum + (+t.effortDays) / heads;
    }, 0);
    const capacity = workdaysInMonth(now);
    const util = capacity ? Math.round((usedDays / capacity) * 100) : 0;
    return { m, open, done, blockedCount, moves, doubts, comments, weeks, usedDays, capacity, util };
  });

  const totDone = perMember.reduce((n, x) => n + x.done.length, 0);
  const totOpen = perMember.reduce((n, x) => n + x.open.length, 0);
  const totBlocked = ts.filter(t => t.blocked).length;
  const star = [...perMember].sort((a, b) => b.weeks[5] + b.weeks[4] - (a.weeks[5] + a.weeks[4]))[0];

  const Spark = ({ weeks }) => {
    const max = Math.max(1, ...weeks);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 46 }}>
          {weeks.map((v, i) => (
            <div key={i} title={`${v} stage move${v !== 1 ? "s" : ""} ${WEEK_LABELS[i] === "Now" ? "this week" : WEEK_LABELS[i] + " ago"}`}
              style={{ flex: 1, borderRadius: 4, minHeight: 3, height: `${Math.max(6, v / max * 100)}%`,
                background: v ? (i === 5 ? T.accent : T.accentSoft) : T.graySoft,
                border: v && i !== 5 ? `1px solid ${T.liftBorder}` : "none" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {WEEK_LABELS.map(l => <span key={l} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.faint }}>{l}</span>)}
        </div>
      </div>
    );
  };

  const Mini = ({ label, value, c = T.ink }) => (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: T.faint }}>{label}</div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 19, color: c }}>{value}</div>
    </div>
  );

  return (
    <div>
      <PageTitle kicker={`TEAM · ${workdaysInMonth(new Date())} WORKING DAYS THIS MONTH (MON–FRI)`} title="Team performance"
        sub="One line per person: what they're working on, what they've delivered, and how full their month is." />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Stat label="Gone live" value={totDone} sub="tasks delivered" c={T.green} />
        <Stat label="Being worked on" value={totOpen} sub="tasks in the pipeline" c={T.blue} />
        <Stat label="Blocked" value={totBlocked} sub="flagged with a reason" c={totBlocked ? T.red : T.ink} />
        <Stat label="Most active" value={star && (star.weeks[5] + star.weeks[4]) ? star.m.name.split(" ")[0] : "—"} sub="stage moves, last 2 weeks" c={T.accent} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, fontSize: 11.5, color: T.faint }}>
        <span><span style={{ color: T.green, fontWeight: 700 }}>● Available</span> under 40% booked</span>
        <span><span style={{ color: T.amber, fontWeight: 700 }}>● Busy</span> 40–85%</span>
        <span><span style={{ color: T.red, fontWeight: 700 }}>● Overloaded</span> over 85%</span>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {perMember.map(({ m, open, done, blockedCount, weeks, usedDays, capacity, util }) => (
          <Card key={m.id} style={{ padding: "16px 20px" }}>
            {/* one line: who · what they're carrying · how loaded */}
            <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
              <Avatar id={m.id} size={40} />
              <div style={{ minWidth: 150, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: T.mut, marginTop: 2 }}>
                  {open.length ? `Working on ${open.length} task${open.length > 1 ? "s" : ""}` : "Nothing in progress"}{blockedCount ? ` (${blockedCount} blocked)` : ""} · {done.length} live · {Math.round(usedDays * 10) / 10} of {capacity} days booked this month
                </div>
              </div>
              <Chip
                label={util > 85 ? "Overloaded" : util >= 40 ? "Busy" : "Available"}
                c={util > 85 ? T.red : util >= 40 ? T.amber : T.green}
                bg={util > 85 ? T.redSoft : util >= 40 ? T.amberSoft : T.greenSoft} dot />
            </div>
            {/* one bar: month load */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", color: T.faint, width: 86, flexShrink: 0 }}>Month load</span>
              <div style={{ flex: 1 }}><ProgressBar v={Math.min(util, 100)} c={util > 85 ? T.red : util >= 40 ? T.amber : T.green} /></div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, color: util > 85 ? T.red : T.mut, flexShrink: 0 }}>{util}%</span>
            </div>
            {/* what they're doing right now — tap to open */}
            {open.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                {open.slice(0, 3).map(t => (
                  <button key={t.id} onClick={() => goTask(t.id)} title={`Open task #${t.no}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 99,
                    border: `1px solid ${T.line}`, background: T.hover, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                  }}>
                    <CircleDot size={11} color={t.blocked ? T.red : T.blue} />
                    <span style={{ fontWeight: 600, color: T.ink, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: T.accent, fontWeight: 700 }}>#{t.no}</span>
                  </button>
                ))}
                {open.length > 3 && <span style={{ fontSize: 11.5, color: T.faint, alignSelf: "center" }}>+{open.length - 3} more</span>}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Requirements — submissions from the intake form                     */
/*  Visible only to the assigner and the three team members.            */
/* ------------------------------------------------------------------ */
const REQ_FIELDS = [
  /* Automation Need Intake field names */
  ["processDescription", "Process description"],
  ["futureProcess", "Proposed future process"],
  ["functionalNeed", "Functional need"],
  ["obligations", "Regulatory / legal obligations"],
  ["links", "Reference links"],
  /* original Requirement Intake field names */
  ["useCase", "Use-case description"],
  ["justification", "Why is this required?"],
  ["currentProcess", "Current process (As-Is)"],
  ["painPoints", "Pain points"],
  ["proposedSolution", "Proposed solution (To-Be)"],
  ["functionalRequirements", "Functional requirements"],
  ["stepProcess", "Step-wise process"],
  ["integrationRequirements", "Integration requirements"],
  ["systems", "Systems involved"],
  ["dataInputsOutputs", "Data inputs & outputs"],
  ["acceptanceCriteria", "Acceptance criteria"],
  ["regulatory", "Regulatory / legal / audit"],
  ["keyRisks", "Key risks"],
  ["otherBenefits", "Other expected benefits"],
];
const REQ_META = [
  ["priority", "Requestor's own priority"],
  ["integrationApplicable", "Integration section"],
  ["benefitsApplicable", "Benefits section"],
  ["riskApplicable", "Risk section"], ["requestType", "Request type"], ["requiredDate", "Required by"],
  ["dataClassification", "Data classification"], ["securityReview", "Security review"],
  ["manualEffort", "Manual effort today"], ["effortReduction", "Effort reduction"],
  ["productivity", "Productivity increase"], ["currentCost", "Current cost"], ["costReduction", "Cost reduction"],
];
const BAND_TONE = {
  Critical: () => ({ c: T.red, bg: T.redSoft }),
  High:     () => ({ c: T.amber, bg: T.amberSoft }),
  Medium:   () => ({ c: T.cyan, bg: T.cyanSoft }),
  Low:      () => ({ c: T.gray, bg: T.graySoft }),
};
const ScorePill = ({ score, band, big }) => {
  if (score == null) return <span style={{ fontSize: 11.5, color: T.faint }}>Not scored</span>;
  const tone = (BAND_TONE[band] || BAND_TONE.Low)();
  return (
    <span title={`Weighted priority score ${score} of 100 — ${band}`} style={{
      display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
      padding: big ? "5px 12px" : "3px 9px", borderRadius: 99,
      background: tone.bg, color: tone.c, fontWeight: 800,
      fontSize: big ? 13 : 11.5, fontFamily: "'JetBrains Mono',monospace",
    }}>{score}<span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700 }}>{band}</span></span>
  );
};

const REQ_STATUS = {
  submitted: { label: "Awaiting review", c: () => T.amber, bg: () => T.amberSoft },
  approved:  { label: "Approved",        c: () => T.green, bg: () => T.greenSoft },
  rejected:  { label: "Rejected",        c: () => T.red,   bg: () => T.redSoft },
};

function ShareFormBar({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt("Copy the form link:", url); return; }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  if (!url) {
    return (
      <Card style={{ marginTop: 16, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <AlertTriangle size={15} color={T.amber} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: T.mut }}>
          No form link set yet — the Assigner can add it in <b style={{ color: T.ink }}>Settings → Requirement form</b>.
        </span>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: 16, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: T.cyanSoft, color: T.cyan }}>
        <Link2 size={16} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: T.ink }}>Share the intake form</span>
        <a href={url} target="_blank" rel="noopener noreferrer" title={url}
          style={{ display: "block", fontSize: 11.5, color: T.blue, textDecoration: "none", fontFamily: "'JetBrains Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url.replace(/^https?:\/\//, "")}
        </a>
      </span>
      <Btn small kind={copied ? "soft" : "ghost"} onClick={copy}>
        {copied ? <><Check size={13} /> Copied</> : <><ClipboardList size={13} /> Copy link</>}
      </Btn>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <Btn small kind="ghost"><ExternalLink size={13} /> Open</Btn>
      </a>
    </Card>
  );
}

function AutomationRequestsPage({ store, user, goTask }) {
  const [tab, setTab] = useState("submitted");
  const [sort, setSort] = useState("score");
  const [open, setOpen] = useState(null);          // requirement id being viewed
  const [rejecting, setRejecting] = useState(null); // requirement being rejected
  const [reason, setReason] = useState("");

  const all = store.reqs || [];
  const counts = {
    submitted: all.filter(r => r.status === "submitted").length,
    approved: all.filter(r => r.status === "approved").length,
    rejected: all.filter(r => r.status === "rejected").length,
    all: all.length,
  };
  const rows = [...(tab === "all" ? all : all.filter(r => r.status === tab))].sort((a, b) =>
    sort === "score"
      ? (b.score ?? -1) - (a.score ?? -1) || String(b.createdAt).localeCompare(String(a.createdAt))
      : String(b.createdAt).localeCompare(String(a.createdAt)));
  const current = all.find(r => r.id === open);

  const approve = (r) => {
    const id = store.approveRequirement(r, user.id);
    setOpen(null);
    celebrate();
    goTask(id);
  };
  const confirmReject = () => {
    if (!reason.trim()) return;
    store.rejectRequirement(rejecting, user.id, reason.trim());
    setRejecting(null); setReason(""); setOpen(null);
  };

  /* ---- one submission, expanded ---- */
  if (current) {
    const p = current.payload || {};
    const st = REQ_STATUS[current.status] || REQ_STATUS.submitted;
    return (
      <div>
        <button onClick={() => setOpen(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.mut, fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={15} /> Back to requirements
        </button>

        <Card style={{ overflow: "hidden" }}>
          <div style={{ padding: "22px 26px 16px" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: "uppercase", color: T.mut }}>
                  {current.publicId} · {fmtTs(current.createdAt)}
                </div>
                <h1 style={{ margin: "5px 0 0", fontWeight: 800, fontSize: 25, letterSpacing: -.5, lineHeight: 1.2 }}>{current.title}</h1>
                <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap", alignItems: "center" }}>
                  <Chip label={st.label} c={st.c()} bg={st.bg()} />
                  <ScorePill score={current.score} band={current.band} big />
                  <span style={{ fontSize: 12.5, color: T.body }}>{current.department}</span>
                  <span style={{ color: T.faint }}>·</span>
                  <span style={{ fontSize: 12.5, color: T.body }}>{current.requestor}</span>
                  <a href={`mailto:${current.email}`} style={{ fontSize: 12.5, color: T.blue, textDecoration: "none" }}>{current.email}</a>
                </div>
              </div>
              {current.status === "submitted" && canReview(user) && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Btn kind="danger" onClick={() => { setRejecting(current); setReason(""); }}><X size={14} /> Reject</Btn>
                  <Btn onClick={() => approve(current)}><Check size={15} /> Approve &amp; create task</Btn>
                </div>
              )}
            </div>
          </div>

          {current.status === "approved" && current.taskId && (
            <div style={{ padding: "11px 26px", borderTop: `1px solid ${T.line}`, background: T.greenSoft, color: T.green, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <CheckCircle2 size={14} /> Approved by {uname(current.decidedBy)} — now a task on the board.
              <button onClick={() => goTask(current.taskId)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.green, fontWeight: 800, fontFamily: "inherit", fontSize: 12.5 }}>Open the task →</button>
            </div>
          )}
          {current.status === "rejected" && (
            <div style={{ padding: "11px 26px", borderTop: `1px solid ${T.line}`, background: T.redSoft, color: T.red, fontSize: 12.5 }}>
              <b>Rejected by {uname(current.decidedBy)}.</b> {current.rejectReason}
            </div>
          )}

          {current.score != null && (
            <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
              <SectionHead icon={BarChart3} tint={T.blueSoft} color={T.blue}
                right={<span style={{ fontSize: 11.5, color: T.faint }}>weighted, 0–100</span>}>
                Priority score
              </SectionHead>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 38, letterSpacing: -1,
                  color: (BAND_TONE[current.band] || BAND_TONE.Low)().c, lineHeight: 1 }}>
                  {current.score}<span style={{ fontSize: 15, color: T.faint, fontWeight: 700 }}>/100</span>
                </span>
                <span style={{ flex: 1, minWidth: 180 }}>
                  <ProgressBar v={current.score} c={(BAND_TONE[current.band] || BAND_TONE.Low)().c} h={8} />
                  <span style={{ display: "block", marginTop: 6, fontSize: 12, color: T.mut }}>
                    Approving sets the task priority to <b style={{ color: T.ink }}>{current.band}</b>.
                  </span>
                </span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {scoreBreakdown((current.payload || {}).scores || {}).map(d => (
                  <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", border: `1px solid ${T.line}`, borderRadius: 10, background: T.hover, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700, color: T.ink, width: 150, flexShrink: 0 }}>{d.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.mut, flexShrink: 0 }}>{d.value}/5</span>
                    <span style={{ color: T.body, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.answer}{d.invert && <span style={{ color: T.faint }}> · lower is better</span>}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: T.faint, flexShrink: 0 }}>
                      {d.points} / {d.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={CircleDot} tint={T.amberSoft} color={T.amber}>At a glance</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              {REQ_META.filter(([k]) => p[k]).map(([k, label]) => (
                <InfoTile key={k} label={label} value={k === "requiredDate" ? fmtDate(p[k]) : p[k]} />
              ))}
            </div>
          </div>

          {REQ_FIELDS.filter(([k]) => (p[k] || "").trim()).map(([k, label]) => (
            <div key={k} style={{ padding: "16px 26px", borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: T.mut, marginBottom: 7 }}>{label}</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.body, whiteSpace: "pre-wrap" }}>{p[k]}</p>
            </div>
          ))}

          <div style={{ padding: "18px 26px 22px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={Paperclip} tint={T.cyanSoft} color={T.cyan}>Attachments</SectionHead>
            {(current.files || []).length === 0
              ? <div style={{ color: T.faint, fontSize: 12.5 }}>No files were attached.</div>
              : <div style={{ display: "grid", gap: 7 }}>
                  {current.files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "7px 10px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.hover }}>
                      <FileText size={13} color={T.accent} style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <span style={{ marginLeft: "auto", color: T.faint, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{fileSize(f.size)}</span>
                      {f.url && <a href={f.url} download={f.name} target="_blank" rel="noopener noreferrer" title={`Download ${f.name}`} style={{ display: "flex", flexShrink: 0, color: T.blue }}><Download size={14} /></a>}
                    </div>
                  ))}
                </div>}
          </div>
        </Card>

        {rejecting && (
          <Modal title={`Reject ${rejecting.publicId}?`} onClose={() => setRejecting(null)} width={480}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.body, marginBottom: 12 }}>
              <b>{rejecting.title}</b> stays on record with your reason, so {rejecting.requestor} can be told why.
            </div>
            <Field label="Reason*">
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={reason}
                onChange={e => setReason(e.target.value)} placeholder="Out of scope, duplicate of an existing task, needs more detail…" />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn kind="ghost" onClick={() => setRejecting(null)}>Cancel</Btn>
              <Btn kind="danger" disabled={!reason.trim()} onClick={confirmReject}><X size={14} /> Reject</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ---- the list ---- */
  return (
    <div>
      <PageTitle kicker="AUTOMATION REQUESTS" title="Automation request inbox"
        sub="Submissions from the intake form. Approving one creates a task assigned to the team." />

      <ShareFormBar url={store.formUrl} />

      {store.dbLive === "off" && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "9px 14px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.amberSoft, fontSize: 12.5, color: T.mut }}>
          <AlertTriangle size={14} color={T.amber} style={{ flexShrink: 0 }} />
          <span>No database connected, so submissions can't be loaded.</span>
        </div>
      )}

      <TableTabs active={tab} onChange={setTab} tabs={[
        { key: "submitted", label: "Awaiting review", count: counts.submitted },
        { key: "approved", label: "Approved", count: counts.approved },
        { key: "rejected", label: "Rejected", count: counts.rejected },
        { key: "all", label: "All", count: counts.all },
      ]} />

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, fontSize: 12.5, color: T.mut }}>
        <Filter size={14} />
        <span>Sort by</span>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "6px 10px", fontSize: 12.5 }}>
          <option value="score">Priority score (highest first)</option>
          <option value="date">Newest first</option>
        </select>
      </div>

      <Card style={{ overflow: "hidden", marginTop: 14 }}>
        {rows.length === 0 && (
          <div style={{ padding: 24, color: T.faint, fontSize: 13 }}>
            {tab === "submitted" ? "Nothing waiting. New submissions appear here the moment someone sends the form."
              : tab === "approved" ? "Nothing approved yet."
              : tab === "rejected" ? "Nothing rejected." : "No requirements have been submitted yet."}
          </div>
        )}
        {rows.map(r => {
          const st = REQ_STATUS[r.status] || REQ_STATUS.submitted;
          return (
            <button key={r.id} onClick={() => setOpen(r.id)} style={{
              display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
              padding: "13px 16px", border: "none", borderBottom: `1px solid ${T.line}`,
              background: "transparent", cursor: "pointer", fontFamily: "inherit",
            }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.accent, fontWeight: 700, flexShrink: 0, width: 128 }}>{r.publicId}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: T.faint, marginTop: 2 }}>
                  {r.department} · {r.requestor} · {fmtTs(r.createdAt)}
                </span>
              </span>
              {(r.files || []).length > 0 &&
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.faint, fontSize: 11.5, flexShrink: 0 }}>
                  <Paperclip size={12} />{r.files.length}
                </span>}
              <ScorePill score={r.score} band={r.band} />
              <Chip label={st.label} c={st.c()} bg={st.bg()} />
              <ChevronRight size={15} color={T.faint} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Analysis — completed, assigned & upcoming                          */
/* ------------------------------------------------------------------ */
function Reports({ store }) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(new Date(now - 30 * 864e5)));   // default: last 30 days
  const [to, setTo] = useState(iso(now));
  const inRange = at => { const d = at.slice(0, 10); return d >= from && d <= to; };
  // a task counts in this range if it was created, worked on, or delivered inside it
  const ts = store.tasks.filter(t => (t.history || []).some(h => inRange(h.at)) || (t.stageHistory || []).some(h => inRange(h.at)) || t.status !== DONE);
  const preset = (days) => { setFrom(iso(new Date(now - days * 864e5))); setTo(iso(now)); };
  const rangeSel = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "14px 0 4px" }}>
      <CalendarDays size={15} color={T.mut} />
      <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "7px 10px", fontSize: 12.5 }} />
      <span style={{ color: T.faint, fontSize: 12 }}>to</span>
      <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "7px 10px", fontSize: 12.5 }} />
      <Btn small kind={to === iso(now) && from === iso(new Date(now - 30 * 864e5)) ? "soft" : "ghost"} onClick={() => preset(30)}>Last 30 days</Btn>
      <Btn small kind="ghost" onClick={() => { setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(iso(now)); }}>This month</Btn>
      <Btn small kind="ghost" onClick={() => preset(365)}>Last year</Btn>
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.faint }}>{ts.length} tasks in range</span>
    </div>
  );

  // Delivered — tasks that reached Go Live, bucketed by week
  const weeks = [5, 4, 3, 2, 1, 0].map(w => ({ w, label: w === 0 ? "This wk" : w + "w ago", count: 0 }));
  ts.filter(t => t.status === DONE).forEach(t => {
    const doneAt = t.closedAt || (t.stageHistory || []).filter(h => h.stage === DONE).slice(-1)[0]?.at;
    if (doneAt && !inRange(doneAt)) return;
    const at = doneAt ? new Date(doneAt) : now;
    const diff = Math.floor((now - at) / (7 * 864e5));
    const slot = weeks.find(x => x.w === Math.min(Math.max(diff, 0), 5));
    if (slot) slot.count++;
  });

  // Assigned — active tasks per member
  const assigned = STAFF().map(m => ({
    name: m.name.split(" ")[0],
    tasks: ts.filter(t => t.status !== DONE && t.assignees.includes(m.id)).length,
  }));

  // Upcoming — open tasks by days until deadline (soonest first)
  const upcoming = ts
    .filter(t => t.status !== DONE && t.deadline && t.deadline <= to)
    .map(t => ({ name: "#" + t.no, days: Math.ceil((new Date(t.deadline) - now) / 864e5), title: t.title, priority: t.priority }))
    .sort((a, b) => a.days - b.days).slice(0, 8);

  const tooltipStyle = { fontSize: 12.5, fontFamily: "'Inter',sans-serif", borderRadius: 14, border: `1px solid ${T.line}`, background: T.pop, color: T.ink };
  const ChartCard = ({ title, sub, children }) => (
    <Card style={{ padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.faint, marginBottom: 8 }}>{sub}</div>
      {children}
    </Card>
  );

  return (
    <div>
      <PageTitle kicker="ANALYSIS" title="Completed · Assigned · Upcoming"
        sub="The three numbers that matter: what got done, who's carrying what, and what's due next." />
      {rangeSel}
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 16 }}>
        <ChartCard title="Tasks gone live" sub="Deliveries per week, last six weeks">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeks}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: T.tick }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: T.tick }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" name="Completed" stroke={T.accent} fill={T.accentSoft} strokeWidth={2.5} animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks assigned" sub="Active load per team member">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={assigned} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.tick }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: T.tick }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: T.graySoft }} />
              <Bar dataKey="tasks" name="Active tasks" fill={T.blue} radius={[6, 6, 0, 0]} animationDuration={750} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Upcoming tasks" sub="Days until each open task's deadline">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={upcoming} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: T.tick }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: T.tick, fontWeight: 700 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: T.graySoft }}
                formatter={(v, n, p) => [v + " days", (p && p.payload && p.payload.title) || "Task"]} />
              <Bar dataKey="days" name="Days left" animationDuration={750} animationEasing="ease-out">
                {upcoming.map((d, i) => <Cell key={i} fill={d.days < 0 ? T.red : d.days <= 7 ? T.amber : T.accent} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: T.faint, marginTop: 4 }}>
            <span><span style={{ color: T.red }}>■</span> overdue</span>
            <span><span style={{ color: T.amber }}>■</span> due within 7 days</span>
            <span><span style={{ color: T.accent }}>■</span> later</span>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task detail — pipeline, discussion, files, history                 */
/* ------------------------------------------------------------------ */
const SectionHead = ({ icon: Icon, tint, color, right, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
    <span style={{ width: 34, height: 34, borderRadius: 11, background: tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={16} color={color} />
    </span>
    <span style={{ fontWeight: 700, fontSize: 15 }}>{children}</span>
    {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
  </div>
);

const InfoTile = ({ label, value }) => (
  <div style={{ background: T.raise, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px", minWidth: 0 }}>
    <div style={{ fontSize: 12.2, color: T.mut }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3, color: T.ink, overflowWrap: "anywhere" }}>{value}</div>
  </div>
);

function TaskDetail({ task: t, user, store, back, setModal }) {
  const [comment, setComment] = useState("");
  const canManage = canAdmin(user);   // create / edit / delete — assigner only
  const canMove = canWrite(user);     // stage moves, blocking, files, links

  const stageIdx = Math.max(0, PIPELINE.indexOf(t.status));

  const toggleReact = (ci, emo) => {
    const comments = t.comments.map((c, i) => {
      if (i !== ci) return c;
      const r = { ...(c.reactions || {}) };
      const ids = r[emo] || [];
      r[emo] = ids.includes(user.id) ? ids.filter(x => x !== user.id) : [...ids, user.id];
      return { ...c, reactions: r };
    });
    store.updateTask(t.id, { comments });
  };

  const addComment = () => {
    if (!comment.trim()) return;
    const recipients = [t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id);
    store.updateTask(t.id, { comments: [...t.comments, { by: user.id, at: new Date().toISOString(), text: comment.trim(), reactions: {} }] });
    store.notify(recipients, `${user.name} commented on “${t.title}”`, t.id, user.id);
    setComment("");
  };

  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [upErr, setUpErr] = useState("");

  const addFiles = async (fileList) => {
    const picked = Array.from(fileList || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!picked.length) return;
    setUpErr("");

    const tooBig = picked.filter(f => f.size > DB.MAX_FILE_MB * 1024 * 1024);
    const ok = picked.filter(f => f.size <= DB.MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) setUpErr(`${tooBig.map(f => f.name).join(", ")} — over the ${DB.MAX_FILE_MB} MB limit, not uploaded.`);
    if (!ok.length) return;

    setUploading(ok.length);
    let items;
    if (DB.hasDb()) {
      const results = await Promise.all(ok.map(f => DB.uploadFile(t.id, f)));
      const failed = ok.filter((f, i) => !results[i]);
      if (failed.length) {
        setUpErr(prev => (prev ? prev + " " : "") +
          `Couldn't upload ${failed.map(f => f.name).join(", ")}. Check the storage bucket exists (storage-setup.sql).`);
      }
      items = ok.map((f, i) => ({
        name: f.name, size: f.size, by: user.id, at: new Date().toISOString(),
        url: results[i]?.url || "", path: results[i]?.path || "",
      })).filter((x, i) => results[i]);
    } else {
      /* no database — record the file so the list still works, but there's
         nowhere to put the bytes, so it can't be downloaded */
      items = ok.map(f => ({ name: f.name, size: f.size, by: user.id, at: new Date().toISOString(), url: "", path: "" }));
    }
    setUploading(0);
    if (!items.length) return;

    store.updateTask(t.id, { attachments: [...t.attachments, ...items] },
      `Attached ${items.map(x => x.name).join(", ")}`, user.id);
    store.logAudit(user.id, t, `Attached ${items.map(x => x.name).join(", ")}`);
  };

  const [linkUrl, setLinkUrl] = useState("");
  /* the live URL of the product itself — this is what the Products menu opens */
  const [prodUrl, setProdUrl] = useState(t.productUrl || "");
  useEffect(() => { setProdUrl(t.productUrl || ""); }, [t.productUrl]);
  const saveProductLink = () => {
    let raw = prodUrl.trim();
    if (raw && !/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    if (raw) { try { new URL(raw); } catch { return; } }
    if (raw === (t.productUrl || "")) return;
    store.updateTask(t.id, { productUrl: raw },
      raw ? `Product link set: ${raw}` : "Product link removed", user.id);
    store.logAudit(user.id, t, raw ? `Product link set: ${raw}` : "Product link removed");
    setProdUrl(raw);
  };
  const addLink = () => {
    let raw = linkUrl.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    let label;
    try { const u = new URL(raw); label = u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); }
    catch { return; }
    if (label.length > 42) label = label.slice(0, 40) + "…";
    store.updateTask(t.id, { links: [...(t.links || []), { url: raw, label, by: user.id, at: new Date().toISOString() }] },
      `Link added: ${label}`, user.id);
    store.logAudit(user.id, t, `Link added: ${label}`);
    setLinkUrl("");
  };
  const removeFile = (i) => {
    const gone = (t.attachments || [])[i];
    if (gone?.path) DB.deleteFile(gone.path);
    store.updateTask(t.id, { attachments: (t.attachments || []).filter((_, j) => j !== i) },
      `Attachment removed: ${gone?.name || ""}`, user.id);
    store.logAudit(user.id, t, `Attachment removed: ${gone?.name || ""}`);
  };

  const removeLink = (i) => {
    const gone = (t.links || [])[i];
    store.updateTask(t.id, { links: (t.links || []).filter((_, j) => j !== i) }, `Link removed: ${gone?.label || ""}`, user.id);
  };

  const [dtab, setDtab] = useState("overview");

  /* move the task to another pipeline stage — every move is date-stamped */
  const changeStage = (ns) => {
    if (!ns || ns === t.status || !STATUS[ns]) return;
    const nowIso = new Date().toISOString();
    const patch = {
      status: ns,
      stageHistory: [...(t.stageHistory || []), { stage: ns, at: nowIso, by: user.id }],
      ...(!t.startAt ? { startAt: nowIso } : {}),
      ...(ns === DONE ? { closedAt: nowIso } : {}),
    };
    const prev = t.status;
    store.updateTask(t.id, patch, `Stage moved to ${STATUS[ns].label}`, user.id);
    store.logAudit(user.id, t, `Stage moved to ${STATUS[ns].label}`);
    store.notify([t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id),
      `“${t.title}” moved to ${STATUS[ns].label}`, t.id, user.id);
    store.sendProgressEmail({ ...t, ...patch }, prev, ns, user.id);   // ← the only email we send
    if (ns === DONE) celebrate();
  };

  const unblock = () => {
    store.updateTask(t.id, { blocked: null }, "Unblocked", user.id, "unblock");
    store.logAudit(user.id, t, "Unblocked");
    store.notify([t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id),
      `“${t.title}” is no longer blocked`, t.id, user.id);
  };

  return (
    <div>
      <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.mut, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12, fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Back to overview
      </button>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* title row — task name left · creator top-right */}
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", padding: "20px 26px 16px" }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: "uppercase", color: T.mut }}>Task #{t.no} · {STATUS[t.status].label}</div>
            <h1 style={{ margin: "5px 0 0", fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 25, letterSpacing: -.5, lineHeight: 1.2 }}>{t.title}</h1>
            <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, background: T.graySoft, color: T.body, padding: "3px 10px", borderRadius: 99 }}>{t.id}</span>
              <StatusChip s={t.status} />{t.blocked && <Chip label="Blocked" c={T.red} bg={T.redSoft} />}<PrioChip p={t.priority} />
              {t.poc && <span title="Point of Contact — first person to ask" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: "3px 10px", borderRadius: 99 }}>
                <User size={12} /> POC · {t.poc}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: T.faint }}>Created by</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7, justifyContent: "flex-end" }}>
              <Avatar id={t.createdBy} size={30} />
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 13.5 }}>{uname(t.createdBy)}</span>
                <span style={{ display: "block", fontSize: 11.5, color: T.faint }}>{t.history?.[0] ? fmtDate(t.history[0].at) : ""}{t.owner ? ` · Lead ${uname(t.owner)}` : ""}</span>
              </span>
            </div>
            {t.assignees.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>{t.assignees.map((a, i) => <span key={a} style={{ marginLeft: i ? -8 : 0 }}><Avatar id={a} /></span>)}</div>}
          </div>
        </div>

        {/* toolbar — role actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", padding: "10px 26px", borderTop: `1px solid ${T.line}` }}>
          <span style={{ marginRight: "auto", fontSize: 12, color: T.faint }}>Due {fmtDate(t.deadline)}{overdue(t) ? " · overdue" : ""}</span>
          <a href={gcalLink(t)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <Btn small kind="ghost"><CalendarDays size={13} /> Calendar</Btn>
          </a>
          {canManage && t.status !== DONE &&
            <Btn kind="ghost" onClick={() => setModal({ type: "assign", taskId: t.id })}><Users size={14} /> Assign & schedule</Btn>}
          {canMove && (t.blocked
            ? <Btn small kind="soft" onClick={unblock}><CheckCircle2 size={13} /> Unblock</Btn>
            : t.status !== DONE &&
              <Btn small kind="danger" onClick={() => setModal({ type: "block", taskId: t.id })}><AlertTriangle size={13} /> Mark blocked</Btn>)}
          {canManage && <>
            <Btn kind="ghost" onClick={() => setModal({ type: "edit", taskId: t.id })}><Pencil size={14} /> Edit</Btn>
            <Btn kind="danger" onClick={() => setModal({ type: "delete", taskId: t.id })}><Trash2 size={14} /> Delete</Btn>
          </>}
        </div>

        {/* stage + progress — the one place to move a task forward */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 26px", borderTop: `1px solid ${T.line}`, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: T.faint }}>Stage</span>
            {canMove ? (
              <select value={t.status} title="Change stage — everyone on the task gets notified, and the move is date-stamped"
                onChange={e => changeStage(e.target.value)}
                style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "8px 12px", fontSize: 13, fontWeight: 700, borderColor: STATUS[t.status].c, color: STATUS[t.status].c }}>
                {PIPELINE.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
              </select>
            ) : <StatusChip s={t.status} />}
          </span>
          <div style={{ position: "relative", flex: 1, height: 15, borderRadius: 99, background: T.graySoft, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${Math.max(progressOf(t), 3)}%`, background: (t.blocked ? T.red : STATUS[t.status].c) + "3A", borderRadius: 99, transformOrigin: "left", animation: "bargrow .8s cubic-bezier(.16,1,.3,1)", transition: "width .7s cubic-bezier(.16,1,.3,1)" }} />
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: T.ink }}>Pipeline progress · stage {stageIdx + 1} of {PIPELINE.length}</span>
          </div>
          <span style={{ fontWeight: 800, fontFamily: "'Inter',sans-serif", fontSize: 14.5, flexShrink: 0 }}>{progressOf(t)}%</span>
        </div>

      {t.blocked &&
        <div style={{ margin: "12px 26px 4px", borderLeft: `3px solid ${T.red}`, color: T.red, padding: "4px 0 4px 14px", fontSize: 13.5 }}>
          <b>Blocked — {t.blocked.reason}:</b> {t.blocked.note || "no extra note"} <span style={{ opacity: .75 }}>· {uname(t.blocked.by)}, {fmtTs(t.blocked.at)}</span>
        </div>}

        {/* section tabs — prominent segmented control */}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: `1px solid ${T.line}`, overflowX: "auto" }}>
          {[
            ["overview", "Overview", null, Eye],
            ["discussion", "Discussion", String(t.comments.length), MessageSquare],
            ["files", "Files & links", String((t.attachments || []).length + (t.links || []).length), Paperclip],
            ["activity", "Activity", String((t.history || []).length), Clock],
          ].map(([k, label, count, Icon]) => {
            const on = dtab === k;
            return (
              <button key={k} onClick={() => setDtab(k)} style={{
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: "inherit",
                padding: "8px 15px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", borderRadius: 99,
                background: on ? T.btnGrad : T.raise,
                color: on ? T.btnText : T.mut,
                border: on ? "1px solid transparent" : `1px solid ${T.line}`,
                boxShadow: on ? T.glow : "none",
                transform: on ? "translateY(-1px)" : "none",
                transition: "all .18s cubic-bezier(.16,1,.3,1)",
              }}>
                <Icon size={14} />
                {label}
                {count != null && <span style={{
                  fontWeight: 700, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace",
                  padding: "1px 7px", borderRadius: 99,
                  background: on ? "rgba(255,255,255,.22)" : T.graySoft,
                  color: on ? T.btnText : T.faint,
                }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {dtab === "overview" && <>
      {/* Signature: 9-stage lifecycle rail */}
        <div style={{ padding: "16px 26px", borderTop: `1px solid ${T.line}` }}>
        <div style={{ display: "flex", alignItems: "center", overflowX: "auto", gap: 0 }}>
          {PIPELINE.map((s, i) => {
            const reached = i <= stageIdx;
            const current = s === t.status;
            const blockedHere = current && t.blocked;
            return (
              <React.Fragment key={s}>
                {i > 0 && <div style={{ flex: 1, height: 2, minWidth: 14, background: reached ? T.accent : T.line, transformOrigin: "left", animation: `connGrow .35s cubic-bezier(.16,1,.3,1) ${i * .07}s backwards` }} />}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 62 }}>
                  <div style={{
                    animation: `nodePop .45s cubic-bezier(.34,1.4,.4,1) ${.05 + i * .07}s backwards`,
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: blockedHere ? T.redSoft : reached ? (current ? STATUS[s].c : T.accent) : T.surface,
                    border: `2px solid ${blockedHere ? T.red : reached ? "transparent" : T.line}`,
                    color: T.surface,
                  }}>
                    {blockedHere ? <AlertTriangle size={11} color={T.red} /> : reached && !current ? <Check size={12} /> : current ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.surface }} /> : null}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase", color: blockedHere ? T.red : current ? STATUS[s].c : T.faint, whiteSpace: "nowrap" }}>
                    {STAGE_SHORT[s]}{blockedHere ? " · blocked" : ""}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        </div>

          <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={CircleDot} tint={T.amberSoft} color={T.amber}>Details</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              <InfoTile label="Deadline" value={`${fmtDate(t.deadline)}${overdue(t) ? " · overdue" : ""}`} />
              <InfoTile label="Reference" value={t.reference ? (/^https?:\/\//i.test(t.reference)
                ? <a href={t.reference} target="_blank" rel="noopener noreferrer" style={{ color: T.blue, textDecoration: "none" }}>{t.reference.replace(/^https?:\/\/(www\.)?/i, "").slice(0, 34)}</a>
                : t.reference) : "—"} />
              <InfoTile label="Tech stack" value={t.techStack || "—"} />
              <InfoTile label="Efforts" value={t.effortDays ? `${t.effortDays} working day${+t.effortDays !== 1 ? "s" : ""}` : "—"} />
            </div>
          </div>

          <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={FileText} tint={T.blueSoft} color={T.blue}>Description</SectionHead>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: T.body }}>{t.desc}</p>
            {t.requirements && <>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} color={T.accent} /> Requirements from team lead
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.body, background: T.accentSoft, borderLeft: `3px solid ${T.accent}`, padding: "10px 14px", borderRadius: "0 8px 8px 0" }}>{t.requirements}</p>
            </>}
          </div>

          {/* dated timeline of the task's journey */}
          <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={CalendarDays} tint={T.purpleSoft} color={T.purple}
              right={t.startAt && <span style={{ fontSize: 12, color: T.faint }}>
                {bizDaysBetween(t.startAt, t.closedAt || new Date().toISOString())} working days {t.closedAt ? "start → close" : "elapsed"}{t.effortDays ? ` · ${t.effortDays} planned` : ""}
              </span>}>
              Timeline
            </SectionHead>
            {(() => {
              /* structured timeline: creation + every date-stamped stage move + block/unblock + upcoming deadline */
              const H = t.history || [];
              const SH = t.stageHistory || [];
              const rows = [
                (SH[0] || H[0]) && { at: (SH[0] || H[0]).at, label: "Task created & assigned", by: (SH[0] || H[0]).by, c: T.gray },
                ...SH.slice(1).map(h => ({ at: h.at, label: "→ " + (STATUS[h.stage]?.label || h.stage), by: h.by, c: STATUS[h.stage]?.c || T.purple })),
                ...H.filter(h => h.kind === "block").map(h => ({ at: h.at, label: h.ev, by: h.by, c: T.red })),
                ...H.filter(h => h.kind === "unblock").map(h => ({ at: h.at, label: "Unblocked", by: h.by, c: T.green })),
                t.status !== DONE && t.deadline && { at: t.deadline + "T23:59:00", label: `Deadline${t.effortDays ? ` (target from ${t.effortDays}d effort)` : ""}`, c: T.amber, future: true },
              ].filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
              return (
                <div style={{ position: "relative", paddingLeft: 4 }}>
                  {rows.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", position: "relative", paddingBottom: i < rows.length - 1 ? 16 : 0 }}>
                      {i < rows.length - 1 && <span style={{ position: "absolute", left: 149, top: 16, bottom: 0, width: 2, background: T.line }} />}
                      <span style={{ width: 128, flexShrink: 0, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: x.future ? T.faint : T.mut, paddingTop: 1 }}>
                        {x.future ? fmtDate(x.at.slice(0, 10)) : fmtTs(x.at)}
                      </span>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 2, zIndex: 1,
                        background: x.future ? "transparent" : x.c, border: `2px solid ${x.c}`,
                        boxShadow: `0 0 0 3px ${T.surface}` }} />
                      <span style={{ minWidth: 0, fontSize: 13.2, lineHeight: 1.45 }}>
                        <b style={{ color: x.future ? T.mut : T.ink, fontStyle: x.future ? "italic" : "normal" }}>{x.label}</b>
                        {x.by && <span style={{ color: T.faint }}> · {uname(x.by)}</span>}
                        {x.future && <span style={{ color: T.faint }}> · upcoming</span>}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>}

        {dtab === "discussion" && <>
          <div style={{ padding: "18px 26px", borderTop: `1px solid ${T.line}` }}>
            <SectionHead icon={MessageSquare} tint={T.purpleSoft} color={T.purple}>Discussion</SectionHead>
            <div style={{ display: "grid", gap: 12 }}>
              {t.comments.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No comments yet. Start the discussion.</div>}
              {t.comments.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <Avatar id={c.by} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5 }}><b>{uname(c.by)}</b> <span style={{ color: T.faint, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{fmtTs(c.at)}</span></div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 3, color: T.body }}>{c.text}</div>
                    <ReactionBar reactions={c.reactions} me={user.id} onToggle={emo => toggleReact(i, emo)} />
                  </div>
                </div>
              ))}
            </div>
            <ChatInput value={comment} setValue={setComment} onSend={addComment}
              placeholder="Write a comment… (😊 emoji · 🎤 record)" />
          </div>

        </>}

        {dtab === "files" && <>
        {/* Product link — what "Open" launches from the Products menu */}
        <div style={{ padding: "18px 26px 4px", borderTop: `1px solid ${T.line}` }}>
          <SectionHead icon={ExternalLink} tint={T.greenSoft} color={T.green}
            right={t.productUrl
              ? <a href={t.productUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <Btn small kind="soft"><ExternalLink size={13} /> Open product</Btn>
                </a>
              : <span style={{ fontSize: 11.5, color: T.faint }}>Not set</span>}>
            Product link
          </SectionHead>
          <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 9, lineHeight: 1.5 }}>
            Paste the live URL of this product. Everyone can then launch it straight from the{" "}
            <b style={{ color: T.ink }}>Products</b> menu at the top of the page.
          </div>
          {canWrite(user) ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 220, marginBottom: 0 }} value={prodUrl}
                onChange={e => setProdUrl(e.target.value)} placeholder="https://your-product-url…"
                onKeyDown={e => { if (e.key === "Enter") saveProductLink(); }} onBlur={saveProductLink} />
              <Btn kind="ghost" onClick={saveProductLink} disabled={prodUrl.trim() === (t.productUrl || "")}>
                <Check size={14} /> Save
              </Btn>
              {t.productUrl &&
                <Btn kind="danger" onClick={() => { setProdUrl(""); store.updateTask(t.id, { productUrl: "" }, "Product link removed", user.id); }}>
                  <X size={14} /> Remove
                </Btn>}
            </div>
          ) : (
            t.productUrl
              ? <a href={t.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.blue, fontSize: 13, wordBreak: "break-all" }}>{t.productUrl}</a>
              : <span style={{ fontSize: 12.5, color: T.faint }}>No product link yet.</span>
          )}

        </div>

        <div className="att-grid" style={{ padding: "18px 26px 22px", borderTop: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <style>{`@media(max-width:700px){.att-grid{grid-template-columns:1fr!important}}`}</style>
          <div style={{ minWidth: 0 }}>
            <SectionHead icon={Paperclip} tint={T.cyanSoft} color={T.cyan}>Attachments</SectionHead>
            <div style={{ display: "grid", gap: 7 }}>
              {t.attachments.length === 0 && <div style={{ color: T.faint, fontSize: 12.5 }}>No files attached.</div>}
              {t.attachments.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "7px 10px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.hover }}>
                  <FileText size={13} color={T.accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</span>
                  <span style={{ marginLeft: "auto", color: T.faint, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{fileSize(f.size)}{uinit(f.by)}</span>
                  {f.url
                    ? <a href={f.url} download={f.name} target="_blank" rel="noopener noreferrer" title={`Download ${f.name}`}
                         style={{ display: "flex", flexShrink: 0, color: T.blue }} onClick={e => e.stopPropagation()}>
                        <Download size={14} />
                      </a>
                    : <span title="This file was recorded before uploads worked, so there's nothing to download. Remove it and add it again."
                            style={{ display: "flex", flexShrink: 0, color: T.faint, cursor: "help" }}>
                        <AlertTriangle size={13} />
                      </span>}
                  {canWrite(user) && (canManage || f.by === user.id) &&
                    <X size={13} color={T.faint} title="Remove file" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => removeFile(i)} />}
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
            {upErr && <div style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.5, color: T.red, background: T.redSoft, borderRadius: 10, padding: "8px 11px" }}>{upErr}</div>}
            {canWrite(user) && <div style={{ marginTop: 10 }}>
              <Btn small kind="soft" disabled={!!uploading} onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center" }}>
                <Upload size={13} /> {uploading ? `Uploading ${uploading} file${uploading > 1 ? "s" : ""}…` : "Add attachment"}
              </Btn>
              {!DB.hasDb() &&
                <div style={{ marginTop: 7, fontSize: 11, color: T.faint, lineHeight: 1.45 }}>
                  No database connected — files are listed but not stored, so they can't be downloaded.
                </div>}
            </div>}
          </div>

          {/* Links — any role can pin URLs to the task */}
          <div style={{ minWidth: 0 }}>
            <SectionHead icon={Link2} tint={T.blueSoft} color={T.blue}>Links</SectionHead>
            <div style={{ display: "grid", gap: 7 }}>
              {(t.links || []).length === 0 && <div style={{ color: T.faint, fontSize: 12.5 }}>No links yet — paste any URL below.</div>}
              {(t.links || []).map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "7px 10px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.hover }}>
                  <Link2 size={13} color={T.blue} style={{ flexShrink: 0 }} />
                  <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}
                    style={{ fontWeight: 600, color: T.blue, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</a>
                  <span style={{ marginLeft: "auto", color: T.faint, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{uinit(l.by)}</span>
                  {canWrite(user) && (canManage || l.by === user.id) &&
                    <X size={13} color={T.faint} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => removeLink(i)} />}
                </div>
              ))}
            </div>
            {canWrite(user) && <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "7px 10px", marginBottom: 0 }} value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" onKeyDown={e => e.key === "Enter" && addLink()} />
              <Btn small kind="ghost" onClick={addLink} disabled={!linkUrl.trim()}><Plus size={13} /></Btn>
            </div>}
          </div>
        </div>
        </>}
      </Card>

      {dtab === "activity" && <div className="aux-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
        <style>{`@media(max-width:960px){.aux-grid{grid-template-columns:1fr!important}}`}</style>
        <EmailActivity emails={store.emails.filter(e => e.task === t.id)} />

        <Card style={{ padding: 16 }}>
            <SectionHead icon={Clock} tint={T.graySoft} color={T.body}>History</SectionHead>
            <div style={{ display: "grid", gap: 0, position: "relative" }}>
              {[...t.history].reverse().map((h, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < arr.length - 1 ? 14 : 0, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? T.accent : "#C7D2CD", marginTop: 4 }} />
                    {i < arr.length - 1 && <span style={{ width: 1.5, flex: 1, background: T.line, marginTop: 3 }} />}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <div style={{ color: T.body }}>{h.ev}</div>
                    <div style={{ color: T.faint, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{uname(h.by)} · {fmtTs(h.at)}</div>
                  </div>
                </div>
              ))}
            </div>
        </Card>
      </div>}

      {/* footer, like the reference */}
      <Card style={{ marginTop: 16, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: T.faint }}>
          Last updated {t.history?.length ? fmtTs(t.history[t.history.length - 1].at) : "—"} · {t.history?.length || 0} events on this task
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Btn onClick={back}>Done</Btn>
        </span>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings — app, technical & integration info for every role         */
/* ------------------------------------------------------------------ */
function SettingsPage({ user, store, theme, flipTheme, openPalette }) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showMailKey, setShowMailKey] = useState(false);
  const mail = store.mail || EMAIL_DEFAULTS;
  const setMailField = (k, v) => store.setMail(m => ({ ...m, [k]: typeof v === "string" ? v.trim() : v }));
  const mailOk = emailReady(mail);
  const diag = {
    app: "ZIU Connect", build: "prototype", theme,
    signedInAs: user.name,
    data: { tasks: store.tasks.length, people: USERS.length, emailsLogged: store.emails.length, notifications: store.notifs.length, auditEvents: store.audit.length },
    viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 90) : "",
    generatedAt: new Date().toISOString(),
  };
  const copyDiag = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(diag, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { window.prompt("Copy diagnostics:", JSON.stringify(diag)); }
  };
  const services = [
    { name: "EmailJS → Gmail", use: "Progress emails — sent when a task moves to a new stage", plan: "Free tier · 200 emails / month",
      status: mailOk ? "Active" : (mail.serviceId || mail.templateId || mail.publicKey) ? "Keys incomplete" : "Not configured",
      ok: mailOk, link: "https://www.emailjs.com", cta: "Set up" },
    { name: "Groq AI", use: "AI polish on new tasks & the assistant chat", plan: "Bring your own key · free tier available",
      status: store.groq?.key ? "Configured" : "No API key", ok: !!store.groq?.key, link: "https://console.groq.com/keys", cta: "Get key" },
    { name: "Requirement intake form", use: "Public form that feeds the Requirements inbox", plan: "Netlify · free",
      status: store.formUrl ? "Linked" : "Not linked", ok: !!store.formUrl,
      link: store.formUrl || "https://app.netlify.com", cta: "Open" },
    { name: "Supabase", use: "Shared database — one live board for the whole team", plan: "Free tier",
      status: { live: "Live", connecting: "Connecting", retrying: "Reconnecting", error: "Unreachable", offline: "Offline", off: "Not configured" }[store.dbLive] || "Not configured",
      ok: store.dbLive === "live", link: "https://supabase.com/dashboard", cta: "Open" },
    { name: "Google Fonts", use: "Inter + JetBrains Mono typography", plan: "Free · unlimited", status: "Active", ok: true, link: "https://fonts.google.com", cta: "Open" },
    { name: "Google Calendar", use: "Add-to-calendar links on every task", plan: "Free · unlimited", status: "Active", ok: true, link: "https://calendar.google.com", cta: "Open" },
    { name: "lucide-react · recharts", use: "Icons & analytics charts", plan: "Open source (MIT)", status: "Active", ok: true, link: "https://lucide.dev", cta: "Docs" },
  ];
  const Row = ({ k, v }) => (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
      <span style={{ width: 170, flexShrink: 0, color: T.mut }}>{k}</span>
      <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
  return (
    <div>
      <PageTitle kicker="SETTINGS" title="Settings & system info"
        sub="Workspace preferences, what this app is built with, and the services it talks to." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginTop: 18 }}>
        <Card style={{ padding: 18 }}>
          <SectionHead icon={Sun} tint={T.amberSoft} color={T.amber}>Appearance & shortcuts</SectionHead>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Btn kind="soft" onClick={flipTheme}>{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Switch to {theme === "dark" ? "light" : "dark"} theme</Btn>
            <Btn kind="soft" onClick={openPalette}><Search size={14} /> Command palette</Btn>
          </div>
          <Row k="Theme" v={theme === "dark" ? "Dark (charcoal)" : "Light (paper)"} />
          <Row k="Quick search" v="Ctrl / Cmd + K anywhere" />
          <Row k="Close dialogs" v="Esc" />
          <Row k="Reduced motion" v="Respects your OS setting automatically" />
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionHead icon={Shield} tint={T.accentSoft} color={T.accentInk}>Account</SectionHead>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Avatar id={user.id} size={40} />
            <span>
              <span style={{ display: "block", fontWeight: 700 }}>{user.name}</span>
              <span style={{ display: "block", fontSize: 12, color: T.faint }}>{user.email} · {rlabel(user)}</span>
            </span>
          </div>
          <Row k="Access" v={isOwner(user) ? "Full — assign, move stages, manage team & every task"
            : isViewer(user) ? "View only — see everything, comment & chat, no changes"
            : "Team member — move your tasks along, attach files, comment"} />
          <Row k="Data persistence" v={store.dbLive === "off"
            ? "This browser only (localStorage) — others can't see your changes"
            : store.dbLive === "live"
              ? "Shared Supabase database — everyone sees the same board, live"
              : "Shared Supabase database — connection " + store.dbLive} />
          {isOwner(user) && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn kind="soft" onClick={() => { localStorage.removeItem(LS_KEY); window.location.reload(); }}><CornerDownRight size={14} /> Reset demo data</Btn>
          </div>}
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionHead icon={Sparkles} tint={T.purpleSoft} color={T.purple}
            right={<Chip label={store.groq?.key ? "Configured" : "No API key"} c={store.groq?.key ? T.green : T.amber} bg={store.groq?.key ? T.greenSoft : T.amberSoft} dot />}>
            AI — Groq
          </SectionHead>
          <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 12, lineHeight: 1.5 }}>
            Powers <b style={{ color: T.ink }}>AI polish</b> in the new-task form and the <b style={{ color: T.ink }}>AI assistant</b> chat.
            Create a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>console.groq.com/keys</a> and paste it here.
          </div>
          <Field label="Groq API key">
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showKey ? "text" : "password"}
                value={store.groq?.key || ""} onChange={e => store.setGroq(g => ({ ...g, key: e.target.value.trim() }))}
                placeholder="gsk_…" autoComplete="off" />
              <button onClick={() => setShowKey(s => !s)} title={showKey ? "Hide key" : "Show key"}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.mut, display: "flex", padding: 4 }}>
                <Eye size={15} />
              </button>
            </div>
          </Field>
          <Field label="Model">
            <input style={inputStyle} value={store.groq?.model || ""} onChange={e => store.setGroq(g => ({ ...g, model: e.target.value }))}
              placeholder={GROQ_DEFAULT_MODEL} />
          </Field>
          <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
            <Shield size={11} style={{ verticalAlign: -1.5 }} /> The key is stored only in this browser's localStorage and is sent only to Groq's API.
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionHead icon={Link2} tint={T.blueSoft} color={T.blue}
            right={<Chip label={store.formUrl ? "Set" : "Not set"} c={store.formUrl ? T.green : T.amber} bg={store.formUrl ? T.greenSoft : T.amberSoft} dot />}>
            Requirement form
          </SectionHead>
          <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 12, lineHeight: 1.5 }}>
            Where the intake form is published. It appears as a shareable link at the top of{" "}
            <b style={{ color: T.ink }}>Requirements</b>. Submissions arrive through the database, so changing
            this only changes the link people are given — it never stops submissions coming in.
          </div>
          {isOwner(user) ? (
            <>
              <Field label="Form URL">
                <input style={inputStyle} value={store.formUrl || ""} onChange={e => store.setFormUrl(e.target.value.trim())}
                  placeholder="https://your-form.netlify.app/" autoComplete="off" />
              </Field>
              {store.formUrl &&
                <a href={store.formUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <Btn small kind="ghost"><ExternalLink size={13} /> Open the form</Btn>
                </a>}
            </>
          ) : (
            <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
              <Shield size={11} style={{ verticalAlign: -1.5 }} /> Only the Assigner can change this.
              {store.formUrl && <> Current link: <a href={store.formUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>{store.formUrl}</a></>}
            </div>
          )}
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionHead icon={Mail} tint={T.cyanSoft} color={T.cyan}
            right={<Chip label={mailOk ? "Active" : "Off"} c={mailOk ? T.green : T.amber} bg={mailOk ? T.greenSoft : T.amberSoft} dot />}>
            Email notifications
          </SectionHead>
          <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 12, lineHeight: 1.5 }}>
            Sends one email <b style={{ color: T.ink }}>only when a task moves to a new stage</b> — to all {USERS.length} people
            in the workspace. Comments, files, links, edits, blocks and team chat never send mail.
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.raise, cursor: isOwner(user) ? "pointer" : "not-allowed", marginBottom: 14, opacity: isOwner(user) ? 1 : .6 }}>
            <input type="checkbox" checked={!!mail.enabled} disabled={!isOwner(user)}
              onChange={e => setMailField("enabled", e.target.checked)} style={{ width: 16, height: 16, cursor: "inherit" }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>Send progress emails</span>
              <span style={{ display: "block", fontSize: 11.5, color: T.faint, marginTop: 1 }}>
                {mail.enabled && !mailOk ? "On, but the three keys below aren't all filled in yet." : "Off means stage moves still notify in-app, just no mail."}
              </span>
            </span>
          </label>

          {isOwner(user) ? <>
            <Field label="Service ID">
              <input style={inputStyle} value={mail.serviceId} onChange={e => setMailField("serviceId", e.target.value)}
                placeholder="service_…" autoComplete="off" />
            </Field>
            <Field label="Template ID">
              <input style={inputStyle} value={mail.templateId} onChange={e => setMailField("templateId", e.target.value)}
                placeholder="template_…" autoComplete="off" />
            </Field>
            <Field label="Public key">
              <div style={{ position: "relative" }}>
                <input style={{ ...inputStyle, paddingRight: 40 }} type={showMailKey ? "text" : "password"}
                  value={mail.publicKey} onChange={e => setMailField("publicKey", e.target.value)}
                  placeholder="Account → General → Public Key" autoComplete="off" />
                <button onClick={() => setShowMailKey(v => !v)} title={showMailKey ? "Hide key" : "Show key"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.mut, display: "flex", padding: 4 }}>
                  <Eye size={15} />
                </button>
              </div>
            </Field>
            <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.55 }}>
              <Shield size={11} style={{ verticalAlign: -1.5 }} /> Get all three free at{" "}
              <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>emailjs.com</a>{" "}
              — connect Gmail for the Service ID, then create a template using <code style={{ fontFamily: "'JetBrains Mono',monospace" }}>{"{{to_email}} {{subject}} {{message}}"}</code>.
              Stored only in this browser.
            </div>
          </> : (
            <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
              <Shield size={11} style={{ verticalAlign: -1.5 }} /> Only the Assigner can change these keys.
            </div>
          )}
        </Card>
      </div>

      <Card style={{ padding: 18, marginTop: 16 }}>
        <SectionHead icon={Sparkles} tint={T.blueSoft} color={T.blue}
          right={<span style={{ fontSize: 11.5, color: T.faint }}>free-tier quotas shown per service</span>}>
          Connected services & quotas
        </SectionHead>
        <div style={{ display: "grid", gap: 9 }}>
          {services.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: `1px solid ${T.line}`, borderRadius: 12, background: T.raise, flexWrap: "wrap" }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 13.5 }}>{s.name}</span>
                <span style={{ display: "block", fontSize: 12, color: T.mut, marginTop: 2 }}>{s.use}</span>
              </span>
              <span style={{ fontSize: 11.5, color: T.faint, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{s.plan}</span>
              <Chip label={s.status} c={s.ok ? T.green : T.amber} bg={s.ok ? T.greenSoft : T.amberSoft} dot />
              <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <Btn small kind="ghost">{s.cta}</Btn>
              </a>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 18, marginTop: 16 }}>
        <SectionHead icon={FileText} tint={T.graySoft} color={T.body}
          right={<Btn small kind="soft" onClick={copyDiag}><Check size={13} /> {copied ? "Copied!" : "Copy diagnostics"}</Btn>}>
          Website & technical info
        </SectionHead>
        <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
          <div>
            <Row k="Product" v="ZIU Connect — task & team workflow" />
            <Row k="Frontend" v="React 18 (single-file app)" />
            <Row k="UI libraries" v="lucide-react icons · recharts analytics" />
            <Row k="Design system" v="twin-style: Inter, hairline borders, ink on paper" />
            <Row k="Motion" v="CSS transforms · View Transitions · scroll-linked orb" />
          </div>
          <div>
            <Row k="Tasks in workspace" v={String(store.tasks.length)} />
            <Row k="People" v={`${USERS.length} (${MEMBERS.length} members)`} />
            <Row k="Emails logged" v={String(store.emails.length)} />
            <Row k="Viewport" v={diag.viewport} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modals: new task, approve, reject, subtask, assign & schedule       */
/* ------------------------------------------------------------------ */
function ManageTeamModal({ store, user, setModal, onClose }) {
  const [, setTick] = useState(0);
  const [editId, setEditId] = useState(null);
  const [arm, setArm] = useState(null);           // remove confirmation
  const [f, setF] = useState({ name: "", email: "" });
  const [err, setErr] = useState("");
  const roster = USERS.filter(u => u.id !== user.id);
  const startEdit = u => { setEditId(u.id); setF({ name: u.name, email: u.email }); setErr(""); setArm(null); };
  const saveEdit = () => {
    const u = USERS.find(x => x.id === editId); if (!u) return;
    const nm = f.name.trim(), em = f.email.trim().toLowerCase();
    if (!nm) return setErr("Name can't be empty.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setErr("That email doesn't look right.");
    if (USERS.some(x => x.id !== u.id && x.email.toLowerCase() === em)) return setErr("Another person already uses this email.");
    u.name = nm; u.email = em;
    u.initials = nm.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    store.notify([user.id], `${nm}'s profile was updated`, null);
    setEditId(null); setErr(""); setTick(t => t + 1); store.bumpUsers();
  };
  const remove = u => {
    const i = USERS.findIndex(x => x.id === u.id); if (i > -1) USERS.splice(i, 1);
    const j = MEMBERS.findIndex(m => m.id === u.id); if (j > -1) MEMBERS.splice(j, 1);
    store.notify([user.id], `${u.name} was removed from the team`, null);
    setArm(null); setTick(t => t + 1); store.bumpUsers();
  };
  const selSmall = { ...inputStyle, marginBottom: 0, padding: "7px 10px", fontSize: 13 };
  return (
    <Modal title="Manage team" onClose={onClose} width={560}>
      <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 14 }}>
        Add, edit or remove the people you assign tasks to. Removing someone keeps their past work in the history; their open assignments simply show as unassigned.
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        {roster.map(u => (
          <div key={u.id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px", background: T.raise }}>
            {editId === u.id ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input style={selSmall} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Full name" />
                  <input style={selSmall} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="email@company.com" />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <Btn small kind="ghost" onClick={() => { setEditId(null); setErr(""); }}>Cancel</Btn>
                    <Btn small onClick={saveEdit}><Check size={13} /> Save</Btn>
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Avatar id={u.id} size={32} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13.5 }}>{u.name}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{u.email}</span>
                </span>
                {arm === u.id ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: T.red, fontWeight: 700 }}>Remove?</span>
                    <Btn small kind="danger" onClick={() => remove(u)}>Yes</Btn>
                    <Btn small kind="ghost" onClick={() => setArm(null)}>No</Btn>
                  </span>
                ) : (
                  <span style={{ display: "flex", gap: 6 }}>
                    <Btn small kind="ghost" onClick={() => startEdit(u)}><Pencil size={12} /> Edit</Btn>
                    <Btn small kind="danger" onClick={() => setArm(u.id)}><Trash2 size={12} /></Btn>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {err && <div style={{ background: T.redSoft, color: T.red, fontSize: 12.5, padding: "9px 12px", borderRadius: 12, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn kind="soft" onClick={() => setModal({ type: "addmember" })}><Plus size={14} /> Add member</Btn>
        <span style={{ marginLeft: "auto" }}><Btn onClick={onClose}>Done</Btn></span>
      </div>
    </Modal>
  );
}

function BlockModal({ t, store, user, onClose }) {
  const [reason, setReason] = useState(TRACK_REASONS[0]);
  const [note, setNote] = useState("");
  const apply = () => {
    const blocked = { reason, note: note.trim(), by: user.id, at: new Date().toISOString() };
    const ev = `Blocked — ${reason}${note.trim() ? `: ${note.trim()}` : ""}`;
    store.updateTask(t.id, { blocked }, ev, user.id, "block");
    store.logAudit(user.id, t, ev);
    store.notify([t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id), `“${t.title}” was flagged blocked — ${reason}`, t.id, user.id);
    onClose();
  };
  return (
    <Modal title="Mark this task blocked" onClose={onClose} width={440}>
      <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 14 }}>
        The task keeps its pipeline stage — the blocked flag sits on top, with the reason visible to everyone until it's cleared.
      </div>
      <Field label="Reason">
        <select style={inputStyle} value={reason} onChange={e => setReason(e.target.value)}>
          {TRACK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Note (optional)">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} placeholder="What exactly is blocking this?" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind="danger" onClick={apply}><AlertTriangle size={14} /> Mark blocked</Btn>
      </div>
    </Modal>
  );
}

function AddMemberModal({ store, user, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const suggested = name.trim() ? name.trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "") + "@ziu.team" : "";
  const add = () => {
    const nm = name.trim(), em = (email.trim() || suggested).toLowerCase();
    if (!nm) return setErr("Please enter the person's full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setErr("That email doesn't look right.");
    if (USERS.some(u => u.email.toLowerCase() === em)) return setErr("Someone with this email already exists.");
    const initials = nm.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const nu = { id: "u" + (Math.max(0, ...USERS.map(u => +String(u.id).slice(1) || 0)) + 1), name: nm, email: em, role: "member", initials };
    USERS.push(nu);
    MEMBERS.push(nu);
    store.bumpUsers();
    store.notify([user.id], `${nm} was added to the team`, null);
    celebrate();
    onClose();
  };
  return (
    <Modal title="Add a team member" onClose={onClose} width={460}>
      <div style={{ fontSize: 12.5, color: T.mut, marginBottom: 14 }}>
        They become assignable on new and existing tasks immediately.
      </div>
      <Field label="Full name">
        <input style={inputStyle} value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="e.g. Kavya Menon" autoFocus />
      </Field>
      <Field label="Work email">
        <input style={inputStyle} value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder={suggested || "name@company.com"} onKeyDown={e => e.key === "Enter" && add()} />
      </Field>
      {err && <div style={{ background: T.redSoft, color: T.red, fontSize: 12.5, padding: "9px 12px", borderRadius: 12, marginBottom: 12 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={add} disabled={!name.trim()}><Users size={14} /> Add to team</Btn>
      </div>
    </Modal>
  );
}

function Modals({ modal, setModal, user, store, goTask }) {
  const t = modal.taskId ? store.tasks.find(x => x.id === modal.taskId) : null;
  const close = () => setModal(null);

  /* ---- New task — lands at "Task assigned" and the 9-stage pipeline begins ---- */
  if (modal.type === "new") {
    return <NewTaskModal user={user} store={store} onClose={close} onCreate={(draft) => {
      const id = "T-" + (++SEQ);
      const nowIso = new Date().toISOString();
      const assignees = draft.assignees || [];
      const ev = assignees.length
        ? `Task created and assigned to ${assignees.map(uname).join(", ")}`
        : "Task created — pipeline started";
      const task = {
        id, no: Math.max(0, ...store.tasks.map(x => x.no || 0)) + 1,
        ...draft, title: draft.title.trim() || "Untitled task", desc: draft.desc.trim() || "No description provided yet.",
        attachments: (draft.attachments || []).map(a => ({ ...a, by: user.id })),
        status: "assigned", blocked: null,
        stageHistory: [{ stage: "assigned", at: nowIso, by: user.id }],
        createdBy: user.id, owner: user.id,
        assignees,
        startAt: nowIso,
        comments: [], queries: [], links: [], remarks: "", productUrl: "",
        requirements: "",
        history: [{ at: nowIso, by: user.id, ev }],
      };
      store.createTask(task);
      store.logAudit(user.id, task, ev);
      if (assignees.length) {
        store.notify(assignees, `${user.name} assigned “${task.title}” to ${assignees.map(uname).join(", ")}`, id, user.id);
      }
      close(); goTask(id);
    }} />;
  }

  if (modal.type === "block" && t) {
    return <BlockModal t={t} store={store} user={user} onClose={close} />;
  }

  if (modal.type === "team") {
    return <ManageTeamModal store={store} user={user} setModal={setModal} onClose={close} />;
  }

  if (modal.type === "addmember") {
    return <AddMemberModal store={store} user={user} onClose={() => setModal({ type: "team" })} />;
  }

  /* ---- Edit task (Admin on any task, or Lead) ---- */
  if (modal.type === "edit" && t) {
    return <EditTaskModal t={t} onClose={close} onSave={(patch) => {
      store.updateTask(t.id, patch, "Task details edited", user.id);
      store.logAudit(user.id, t, "Task details edited");
      store.notify([t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id),
        `${user.name} edited “${patch.title}”`, t.id, user.id);
      close();
    }} />;
  }

  /* ---- Delete task ---- */
  if (modal.type === "delete" && t) {
    return (
      <Modal title="Delete this task?" onClose={close} width={460}>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.body }}>
          <b>Task #{t.no} — {t.title}</b> will be removed for everyone, along with its comments and attachments. The audit log keeps a record of the deletion.
        </div>
        <div style={{ marginTop: 10, background: T.redSoft, color: T.red, borderRadius: 12, padding: "9px 12px", fontSize: 12.5 }}>
          This can't be undone.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Btn kind="ghost" onClick={close}>Keep task</Btn>
          <Btn kind="danger" onClick={() => {
            store.logAudit(user.id, t, "Task deleted");
            store.notify([t.owner, t.createdBy, ...t.assignees].filter(id => id && id !== user.id),
              `“${t.title}” was deleted by ${user.name}`, t.id, user.id);
            store.removeTask(t.id);
            close();
          }}><Trash2 size={14} /> Delete permanently</Btn>
        </div>
      </Modal>
    );
  }

  /* ---- Assign & schedule ---- */
  if (modal.type === "assign" && t) {
    return <AssignModal t={t} onClose={close} onSave={(patch) => {
      const added = patch.assignees.filter(a => !t.assignees.includes(a));
      store.updateTask(t.id, { ...patch }, "Assignment, priority or deadline updated", user.id);
      store.logAudit(user.id, t, `Updated assignment — ${patch.assignees.map(uname).join(", ") || "no one"} · ${PRIORITY[patch.priority].label} · due ${fmtDate(patch.deadline)}`);
      if (added.length) store.notify(added, `${user.name} put ${added.map(uname).join(", ")} on “${t.title}”`, t.id, user.id);
      close();
    }} />;
  }

  return null;
}

function NewTaskModal({ onClose, onCreate, user, store }) {
  const [f, setF] = useState({ title: "", desc: "", poc: "", priority: "medium", deadline: daysFromNow(14), assignees: [], reference: "", techStack: "", effortDays: "" });
  const toggleAssignee = id => setF(x => ({ ...x, assignees: x.assignees.includes(id) ? x.assignees.filter(a => a !== id) : [...x.assignees, id] }));
  const [more, setMore] = useState(false);
  const [files, setFiles] = useState([]);   // [{name,size}]
  const nfRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const recRef = useRef(null);
  const ok = true; // all fields optional

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  const toggleVoice = () => {
    if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setAiMsg("Voice input needs Chrome or Edge — this browser doesn't support speech recognition."); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = "en-IN";
    rec.onresult = e => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) chunk += e.results[i][0].transcript + " ";
      if (chunk.trim()) setF(x => ({ ...x, desc: (x.desc + " " + chunk).replace(/\s+/g, " ").trimStart() }));
    };
    rec.onerror = ev => { setListening(false); setAiMsg(ev.error === "not-allowed" ? "Microphone permission was denied. Allow it and try again." : "Voice input stopped: " + ev.error); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setAiMsg(""); rec.start(); setListening(true);
  };

  const aiPolish = async () => {
    if (f.desc.trim().length < 10) { setAiMsg("Speak or type some rough notes first — then AI can shape them."); return; }
    if (!store?.groq?.key) { setAiMsg("Add your Groq API key in Settings to enable AI polish."); return; }
    setAiBusy(true); setAiMsg("");
    try {
      const text = await callGroq(store.groq, [{
        role: "user",
        content: "You are a PM assistant inside an enterprise task manager. Rewrite the raw (possibly voice-dictated) notes below into a task. Respond ONLY with minified JSON, no markdown fences, exactly this shape: {\"title\": string (max 10 words, imperative), \"description\": string (2-4 crisp sentences: context, the problem, what success looks like), \"priority\": one of \"critical\"|\"high\"|\"medium\"|\"low\"}. Raw notes: " + f.desc,
      }], { json: true });
      const p = JSON.parse(text.replace(/```json|```/g, "").trim());
      setF(x => ({
        ...x,
        title: x.title.trim() ? x.title : (p.title || x.title),
        desc: p.description || x.desc,
        priority: ["critical", "high", "medium", "low"].includes(p.priority) ? p.priority : x.priority,
      }));
      setAiMsg("Polished. Review the wording — you stay the author.");
    } catch (e) {
      setAiMsg("AI polish didn't go through — check your Groq key in Settings or try again.");
    }
    setAiBusy(false);
  };

  return (
    <Modal title="Raise a new task" onClose={onClose}>
      <div style={{ fontSize: 13, color: T.mut, marginBottom: 16, lineHeight: 1.5 }}>
        This task lands at <b style={{ color: T.ink }}>Task assigned</b> and its 9-stage pipeline begins — Task assigned → PRD → Prototype → Demo → Feedback → Build → Final Demo → Deployment → Go Live.
      </div>
      <Field label="Assigner">
        <input style={{ ...inputStyle, opacity: .7 }} value={user.name} readOnly />
      </Field>
      <Field label={`Assignees${f.assignees.length ? ` — ${f.assignees.length} selected` : " (pick one or more)"}`}>
        <div style={{ display: "grid", gap: 7 }}>
          {STAFF().filter(s => s.id !== user.id).map(m => {
            const on = f.assignees.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, border: `1.5px solid ${on ? T.accent : T.line}`, background: on ? T.accentSoft : "rgba(255,255,255,.03)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <Avatar id={m.id} size={24} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                {on && <Check size={15} color={T.accentInk} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Title">
        <input style={inputStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="What needs to happen? (or leave blank — AI polish will suggest one)" autoFocus />
      </Field>
      <Field label="Problem / description">
        <div style={{ position: "relative" }}>
          <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", paddingBottom: 40 }} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })}
            placeholder={listening ? "Listening… speak naturally, it types for you." : "Type — or tap the mic and just talk."} />
          <div style={{ position: "absolute", left: 8, bottom: 8, display: "flex", gap: 6 }}>
            <button onClick={toggleVoice} title={listening ? "Stop dictation" : "Dictate with voice"} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${listening ? T.red : T.line}`, background: listening ? T.redSoft : "rgba(255,255,255,.05)",
              color: listening ? T.red : T.mut, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
            }}>
              {listening ? <><MicOff size={13} /> Stop</> : <><Mic size={13} /> Voice</>}
              {listening && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, animation: "none" }} />}
            </button>
            <button onClick={aiPolish} disabled={aiBusy} title="AI: summarize notes into a perfect description" style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, cursor: aiBusy ? "wait" : "pointer",
              border: "1px solid rgba(179,147,255,.4)", background: T.purpleSoft, color: T.purple, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", opacity: aiBusy ? .6 : 1,
            }}>
              <Sparkles size={13} /> {aiBusy ? "Polishing…" : "AI polish"}
            </button>
          </div>
        </div>
        {aiMsg && <div style={{ fontSize: 12, color: T.mut, marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}><Sparkles size={12} color={T.purple} /> {aiMsg}</div>}
      </Field>
      <button onClick={() => setMore(m => !m)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.mut, padding: 0, marginBottom: 12 }}>
        <ChevronRight size={13} style={{ transform: more ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        {more ? "Hide extra options" : "More options — reference, tech stack, POC, files"}
      </button>
      {more && <>
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Reference">
          <input style={inputStyle} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="Doc / ticket / link (optional)" />
        </Field>
        <Field label="Tech stack">
          <input style={inputStyle} value={f.techStack} onChange={e => setF({ ...f, techStack: e.target.value })} placeholder="e.g. React, Node, Postgres" />
        </Field>
      </div>
      <Field label="POC — point of contact">
        <input style={inputStyle} value={f.poc} onChange={e => setF({ ...f, poc: e.target.value })} placeholder="Name / team / email (optional)" />
      </Field>
      </>}
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Efforts (working days)">
          <input type="number" min="0" style={inputStyle} value={f.effortDays} placeholder="e.g. 8"
            onChange={e => {
              const v = e.target.value;
              setF({ ...f, effortDays: v, deadline: v && +v > 0 ? addBusinessDays(new Date().toISOString().slice(0, 10), +v) : f.deadline });
            }} />
        </Field>
        <Field label="Suggested priority">
          <select style={inputStyle} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Target deadline">
          <input type="date" style={inputStyle} value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} />
        </Field>
      </div>
      {more && <Field label="Attachments">
        <div style={{ display: "flex", gap: 6 }}>
          <input ref={nfRef} type="file" multiple style={{ display: "none" }}
            onChange={e => { setFiles([...files, ...Array.from(e.target.files || []).map(x => ({ name: x.name, size: x.size }))]); if (nfRef.current) nfRef.current.value = ""; }} />
          <Btn kind="soft" small onClick={() => nfRef.current?.click()} style={{ flex: 1, justifyContent: "center" }}><Upload size={13} /> Add attachment</Btn>
        </div>
        {files.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {files.map((x, i) => <span key={i} style={{ fontSize: 12, background: T.graySoft, padding: "4px 9px", borderRadius: 6, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <FileText size={12} /> {x.name} <X size={12} style={{ cursor: "pointer" }} onClick={() => setFiles(files.filter((_, j) => j !== i))} /></span>)}
        </div>}
      </Field>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!ok} onClick={() => onCreate({ ...f, attachments: files.map(x => ({ name: x.name, size: x.size, at: new Date().toISOString() })) })}>
          <Check size={14} /> Assign
        </Btn>
      </div>
    </Modal>
  );
}

function AssignModal({ t, onClose, onSave }) {
  const [f, setF] = useState({ assignees: [...t.assignees], priority: t.priority, deadline: t.deadline });
  const toggle = id => setF(x => ({ ...x, assignees: x.assignees.includes(id) ? x.assignees.filter(a => a !== id) : [...x.assignees, id] }));
  return (
    <Modal title="Assign & schedule" onClose={onClose}>
      <Field label="Team members on this task">
        <div style={{ display: "grid", gap: 7 }}>
          {STAFF().map(m => {
            const on = f.assignees.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: `1.5px solid ${on ? T.accent : T.line}`, background: on ? T.accentSoft : "rgba(255,255,255,.03)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <Avatar id={m.id} size={26} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</span>
                {on && <Check size={15} color={T.accentInk} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Priority">
          <select style={inputStyle} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Deadline"><input type="date" style={inputStyle} value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(f)}><Check size={15} /> Save changes</Btn>
      </div>
    </Modal>
  );
}

function EmailActivity({ emails }) {
  return (
    <Card style={{ padding: 16 }}>
      <SectionHead icon={Mail} tint={T.amberSoft} color={T.amber}>Email activity</SectionHead>
      <div style={{ fontSize: 11, color: T.faint, marginBottom: 10 }}>Sent-mail log for this task. Real delivery to Gmail runs through EmailJS — fill EMAIL_CONFIG at the top of the file and deploy to activate.</div>
      <div style={{ display: "grid", gap: 8 }}>
        {emails.length === 0 && <div style={{ color: T.faint, fontSize: 12.5 }}>No emails sent for this task yet.</div>}
        {emails.map((e, i) => (
          <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 10px", background: T.hover }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.4 }}>{e.subject}</div>
            <div style={{ fontSize: 10.5, color: T.faint, fontFamily: "'JetBrains Mono',monospace", marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>
              <span style={{ color: T.accentInk }}>from</span> {e.from || "system@relayops.io"}<br />
              <span style={{ color: T.accentInk }}>to</span> {e.to.join(", ")} · {fmtTs(e.at)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit task modal                                                    */
/* ------------------------------------------------------------------ */
function EditTaskModal({ t, onClose, onSave }) {
  const [f, setF] = useState({ title: t.title, desc: t.desc, poc: t.poc || "", priority: t.priority, deadline: t.deadline, requirements: t.requirements || "", reference: t.reference || "", techStack: t.techStack || "" });
  const [more, setMore] = useState(false);
  return (
    <Modal title={`Edit task #${t.no}`} onClose={onClose} width={620}>
      <Field label="Title"><input style={inputStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></Field>
      <Field label="Requirements">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={f.requirements} onChange={e => setF({ ...f, requirements: e.target.value })} placeholder="Scope, constraints, definition of done…" />
      </Field>
      <button onClick={() => setMore(m => !m)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.mut, padding: 0, marginBottom: 12 }}>
        <ChevronRight size={13} style={{ transform: more ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        {more ? "Hide extra options" : "More options — reference, tech stack, POC"}
      </button>
      {more && <>
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Reference">
          <input style={inputStyle} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="Doc / ticket / link (optional)" />
        </Field>
        <Field label="Tech stack">
          <input style={inputStyle} value={f.techStack} onChange={e => setF({ ...f, techStack: e.target.value })} placeholder="e.g. React, Node, Postgres" />
        </Field>
      </div>
      <Field label="POC — point of contact">
        <input style={inputStyle} value={f.poc} onChange={e => setF({ ...f, poc: e.target.value })} placeholder="Name / team / email (optional)" />
      </Field>
      </>}
      <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Priority">
          <select style={inputStyle} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Deadline"><input type="date" style={inputStyle} value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim()} onClick={() => onSave(f)}><Check size={15} /> Save changes</Btn>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Emoji reactions + chat input with voice recording                   */
/* ------------------------------------------------------------------ */
const REACTS = ["👍", "❤️", "🎉", "🔥", "👀", "✅"];
const EMOJIS = ["😀", "😅", "😍", "🤔", "🙏", "👏", "💡", "🚀", "⚡", "📌", "⏳", "❗", "✅", "🔥", "❤️", "🎯", "🤝", "👍", "🎉", "👀"];

function ReactionBar({ reactions = {}, me, onToggle }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7, flexWrap: "wrap", position: "relative" }}>
      {entries.map(([emo, ids]) => {
        const mine = ids.includes(me);
        return (
          <button key={emo + ":" + ids.length} onClick={() => onToggle(emo)} title={ids.map(uname).join(", ")} style={{
            animation: "rxnpop .35s cubic-bezier(.34,1.56,.64,1)",
            display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 99, cursor: "pointer",
            border: `1px solid ${mine ? T.liftBorder : T.line}`, background: mine ? T.accentSoft : "rgba(255,255,255,.04)",
            fontSize: 12.5, fontFamily: "'Inter',sans-serif", color: T.ink,
          }}>
            <span>{emo}</span><span style={{ fontSize: 11, fontWeight: 700, color: mine ? T.accentInk : T.mut }}>{ids.length}</span>
          </button>
        );
      })}
      <button onClick={() => setOpen(o => !o)} title="Add reaction" style={{
        padding: "2px 8px", borderRadius: 99, cursor: "pointer", border: `1px dashed ${T.line}`,
        background: "transparent", fontSize: 12, color: T.faint, fontFamily: "'Inter',sans-serif",
      }}>＋😊</button>
      {open && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 40, display: "flex", gap: 4, padding: "7px 9px", background: T.pop, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 18px 40px -10px rgba(0,0,0,.85)" }}>
          {REACTS.map(e => (
            <button key={e} onClick={() => { onToggle(e); setOpen(false); }} style={{ fontSize: 17, background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 6 }}
              onMouseEnter={ev => ev.currentTarget.style.background = T.hover}
              onMouseLeave={ev => ev.currentTarget.style.background = "none"}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatInput({ value, setValue, onSend, placeholder, sendIcon: SendIcon = Send, sendLabel }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  const toggleVoice = () => {
    if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = "en-IN";
    rec.onresult = e => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) chunk += e.results[i][0].transcript + " ";
      if (chunk.trim()) setValue(v => (v + " " + chunk).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };

  const iconBtn = (active, activeC, activeBg) => ({
    width: 28, height: 28, borderRadius: 99, border: "none", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: active ? activeBg : "transparent", color: active ? activeC : T.faint,
  });

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <input style={{ ...inputStyle, paddingRight: 72, borderRadius: 99 }} value={value}
          onChange={e => setValue(e.target.value)} placeholder={listening ? "Listening… speak your message" : placeholder}
          onKeyDown={e => e.key === "Enter" && onSend()} />
        <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 2 }}>
          <button title="Emoji" onClick={() => setEmojiOpen(o => !o)} style={iconBtn(emojiOpen, T.accentInk, T.accentSoft)}>
            <span style={{ fontSize: 15 }}>😊</span>
          </button>
          <button title={listening ? "Stop recording" : "Record voice message (speech → text)"} onClick={toggleVoice} style={iconBtn(listening, T.red, T.redSoft)}>
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </div>
        {listening && <span style={{ position: "absolute", left: 14, top: -9, fontSize: 10, fontWeight: 700, letterSpacing: .5, color: T.red, background: T.redSoft, padding: "1px 8px", borderRadius: 99 }}>● REC</span>}
        {emojiOpen && (
          <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, zIndex: 40, display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 2, padding: 9, background: T.pop, border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 18px 40px -10px rgba(0,0,0,.85)", width: 300 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => { setValue(v => v + e); setEmojiOpen(false); }} style={{ fontSize: 17, background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 6 }}
                onMouseEnter={ev => ev.currentTarget.style.background = T.hover}
                onMouseLeave={ev => ev.currentTarget.style.background = "none"}>{e}</button>
            ))}
          </div>
        )}
      </div>
      <Btn onClick={onSend} disabled={!value.trim()}><SendIcon size={14} />{sendLabel}</Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Assistant — ops copilot, lives in the chat drawer                */
/* ------------------------------------------------------------------ */
function buildContext(tasks) {
  return tasks.map(t => ({
    no: t.no, title: t.title, stage: STATUS[t.status]?.label || t.status,
    blocked: t.blocked ? `${t.blocked.reason}${t.blocked.note ? ": " + t.blocked.note : ""}` : null,
    priority: t.priority, deadline: t.deadline, progress: progressOf(t) + "%",
    assignees: t.assignees.map(uname), poc: t.poc || null,
    overdue: !!overdue(t),
    openDoubts: (t.queries || []).filter(q => q.status === "open").length,
    stageHistory: (t.stageHistory || []).map(h => ({ stage: STATUS[h.stage]?.label || h.stage, at: h.at.slice(0, 10), by: uname(h.by) })),
  }));
}

function buildPeople(tasks, onlyId) {
  const now = new Date();
  return USERS.filter(u => !onlyId || u.id === onlyId).map(u => {
    const moves = tasks.flatMap(t => (t.stageHistory || []).slice(1).filter(h => h.by === u.id));
    const weekly = [5, 4, 3, 2, 1, 0].map(w =>
      moves.filter(e => Math.min(Math.floor((now - new Date(e.at)) / (7 * 864e5)), 5) === w).length);
    return {
      name: u.name, role: rlabel(u),
      tasksOn: tasks.filter(t => t.assignees.includes(u.id)).map(t => "#" + t.no),
      tasksRaised: tasks.filter(t => t.createdBy === u.id).length,
      tasksDelivered: tasks.filter(t => t.status === DONE && t.assignees.includes(u.id)).length,
      doubtsRaised: tasks.reduce((n, t) => n + (t.queries || []).filter(q => q.by === u.id).length, 0),
      comments: tasks.reduce((n, t) => n + t.comments.filter(c => c.by === u.id).length, 0),
      stageMovesPerWeek_oldest_to_now: weekly,
    };
  });
}

function buildTimeline(tasks, limit = 30) {
  return tasks.flatMap(t => t.history.map(h => ({ at: h.at, who: uname(h.by), task: "#" + t.no, event: h.ev })))
    .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit)
    .map(e => ({ ...e, at: fmtTs(e.at) }));
}

function localInsights(tasks) {
  const active = tasks.filter(t => t.status !== DONE);
  const od = tasks.filter(overdue);
  const soon = active.filter(t => t.deadline && !overdue(t) && (new Date(t.deadline) - new Date()) / 864e5 <= 7);
  const doubts = tasks.flatMap(t => (t.queries || []).filter(q => q.status === "open").map(q => ({ t, q })));
  const load = MEMBERS.map(m => ({ m, n: active.filter(t => t.assignees.includes(m.id)).length }))
    .sort((a, b) => b.n - a.n);
  const blocked = active.filter(t => t.blocked);
  const stale = active.filter(t => {
    const last = (t.stageHistory || []).slice(-1)[0];
    return last && (new Date() - new Date(last.at)) / 864e5 > 7;
  });
  return { active, od, soon, doubts, load, blocked, stale };
}

function AIAssistant({ store, user, goTask }) {
  const visTasks = user.role === "member"
    ? store.tasks.filter(t => t.assignees.includes(user.id))
    : store.tasks;
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    text: user.role === "member"
      ? `Hi ${user.name.split(" ")[0]} — I can see your ${visTasks.length} task${visTasks.length !== 1 ? "s" : ""}, your progress, deadlines and your delivery timeline. Ask me anything, or tap a suggestion.`
      : `Hi ${user.name.split(" ")[0]} — I can see all ${visTasks.length} tasks plus everyone's performance: who raised, reviewed, delivered and submitted what, comments, weekly throughput, and the full activity timeline. Ask me anything, or tap a suggestion.`,
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const ins = localInsights(visTasks);
  const SUGGESTIONS = user.role === "member" ? [
    "Summarize my progress in 3 lines",
    "What should I work on first today?",
    "What's due soonest for me?",
    "How has my delivery pace been lately?",
  ] : [
    "Summarize overall progress in 3 lines",
    "How is each team member performing?",
    "Which tasks are at risk of missing their deadline?",
    "What happened in the last 24 hours?",
    "Who's overloaded and who has capacity?",
  ];

  const fallbackAnswer = () => {
    const parts = [];
    parts.push(`Pipeline: ${ins.active.length} active task${ins.active.length !== 1 ? "s" : ""}, avg progress ${ins.active.length ? Math.round(ins.active.reduce((a, t) => a + progressOf(t), 0) / ins.active.length) : 0}%.`);
    if (ins.blocked.length) parts.push(`Blocked: ${ins.blocked.map(t => `#${t.no} (${t.blocked.reason})`).join(", ")}.`);
    if (ins.od.length) parts.push(`\u26a0 Overdue: ${ins.od.map(t => `#${t.no} ${t.title}`).join("; ")}.`);
    if (ins.soon.length) parts.push(`Due within 7 days: ${ins.soon.map(t => `#${t.no} (${fmtDate(t.deadline)})`).join(", ")}.`);
    if (ins.load[0]?.n) parts.push(`Heaviest load: ${ins.load[0].m.name} with ${ins.load[0].n} active task${ins.load[0].n !== 1 ? "s" : ""}.`);
    if (ins.stale.length) parts.push(`No stage move in 7+ days: ${ins.stale.map(t => "#" + t.no).join(", ")} — worth a check-in.`);
    return parts.join("\n");
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = [...msgs, { role: "user", text: q }];
    setMsgs(history);
    if (!store.groq?.key) {
      setMsgs(m => [...m, { role: "assistant", text: "(No Groq API key configured — add one in Settings for smarter answers. Built-in analysis:)\n\n" + fallbackAnswer() }]);
      return;
    }
    setBusy(true);
    try {
      const reply = (await callGroq(store.groq, [
        ...history.slice(-8).map(m => ({ role: m.role, content: m.text })),
        {
          role: "user",
          content: "SYSTEM CONTEXT (not from the user): You are the built-in operations assistant of ZIU Connect, an enterprise task manager where every task moves through a 9-stage pipeline (Task assigned → PRD creation → Prototype creation → Prototype demo → Feedback finalised → Build → Final Demo → Deployment → Go Live) and can carry a Blocked flag. The person asking is " + user.name + " (" + rlabel(user) + "). Answer their last message above using ONLY this live data — tasks, every person's performance, and the activity timeline. Be concise and actionable (under 160 words), reference tasks as #number and people by name, plain text lines only. Current date: " + new Date().toDateString() + ". TASK DATA: " + JSON.stringify(buildContext(visTasks)) + " PEOPLE & PERFORMANCE (roles, workload, deliveries, doubts, comments, weekly stage-move counts oldest→now): " + JSON.stringify(buildPeople(store.tasks, user.role === "member" ? user.id : null)) + " RECENT ACTIVITY TIMELINE (newest first): " + JSON.stringify(buildTimeline(visTasks, user.role === "member" ? 15 : 30)),
        },
      ])).trim();
      if (!reply) throw new Error("empty");
      setMsgs(m => [...m, { role: "assistant", text: reply }]);
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", text: "(AI service unreachable — here's my built-in analysis instead)\n\n" + fallbackAnswer() }]);
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Card style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 320 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
              {m.role === "assistant"
                ? <span style={{ width: 28, height: 28, borderRadius: "50%", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={14} color={T.accent} /></span>
                : <Avatar id={user.id} size={28} />}
              <div style={{
                maxWidth: "80%", padding: "9px 13px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: m.role === "user" ? T.accentSoft : T.raise,
                border: `1px solid ${m.role === "user" ? T.liftBorder : T.line}`, color: T.body,
              }}>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={14} color={T.accent} /></span>
              <div style={{ padding: "9px 13px", borderRadius: 14, background: T.raise, border: `1px solid ${T.line}`, color: T.faint, fontSize: 13, fontStyle: "italic" }}>Reading the pipeline…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div style={{ borderTop: `1px solid ${T.line}`, padding: "10px 14px 14px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} disabled={busy} style={{
                fontSize: 11.5, padding: "4px 11px", borderRadius: 99, border: `1px solid ${T.line}`,
                background: T.raise, color: T.mut, cursor: busy ? "wait" : "pointer", fontFamily: "'Inter',sans-serif",
              }}>{s}</button>
            ))}
          </div>
          <ChatInput value={input} setValue={setInput} onSend={() => send()} placeholder="Ask about tasks, progress, deadlines… (😊 · 🎤)" sendIcon={Sparkles} />
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Team chat — WhatsApp-style group for the whole workspace            */
