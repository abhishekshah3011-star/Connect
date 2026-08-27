/* ==================================================================
   ZIU Connect — shared database (Supabase)
   ------------------------------------------------------------------
   Everything here is optional. If no credentials are configured the
   whole module goes quiet and the app keeps using this browser's
   localStorage exactly as before — nothing breaks.

   Credentials are read, in order, from:
     1. window.ZIU_CONFIG  — set in config.js next to index.html.
        Best for Netlify drag-and-drop: edit one small file, no rebuild.
     2. VITE_SUPABASE_URL / VITE_SUPABASE_KEY at build time (.env)
   ================================================================== */
import { createClient } from "@supabase/supabase-js";

const winCfg = (typeof window !== "undefined" && window.ZIU_CONFIG) || {};
/* Vite replaces this with a plain object at build time */
const envCfg = import.meta.env || {};

const DB_URL = (winCfg.supabaseUrl || envCfg.VITE_SUPABASE_URL || "").trim();
const DB_KEY = (winCfg.supabaseKey || envCfg.VITE_SUPABASE_KEY || "").trim();

/* a placeholder left in config.js shouldn't count as configured */
const looksReal = DB_URL.startsWith("http") && DB_KEY.length > 20 && !DB_URL.includes("YOUR_");

export const hasDb = () => looksReal;

let sb = null;
if (looksReal) {
  try {
    sb = createClient(DB_URL, DB_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  } catch (e) {
    console.warn("[ziu] Supabase client failed to start — staying offline.", e);
    sb = null;
  }
}

export const dbStatus = () => (!looksReal ? "off" : sb ? "on" : "error");

/* one place to swallow network errors: the app must never hard-fail
   because the database is unreachable */
const guard = async (label, fn, fallback = null) => {
  if (!sb) return fallback;
  try {
    const { data, error } = await fn();
    if (error) { console.warn(`[ziu] ${label}:`, error.message); return fallback; }
    return data ?? fallback;
  } catch (e) {
    console.warn(`[ziu] ${label}:`, e?.message || e);
    return fallback;
  }
};

/* ---------- row <-> app shape ---------- */

const iso = v => (v ? new Date(v).toISOString() : undefined);
const arr = v => (Array.isArray(v) ? v : []);

export const rowToTask = r => ({
  id: r.id,
  no: r.no,
  title: r.title || "",
  desc: r.descr || "",
  status: r.status,
  blocked: r.blocked || null,
  priority: r.priority || "medium",
  deadline: r.deadline ? String(r.deadline).slice(0, 10) : "",
  effortDays: r.effort_days || "",
  startAt: iso(r.start_at),
  closedAt: iso(r.closed_at),
  createdBy: r.created_by,
  owner: r.owner,
  poc: r.poc || "",
  requirements: r.requirements || "",
  reference: r.reference || "",
  techStack: r.tech_stack || "",
  remarks: r.remarks || "",
  productUrl: r.product_url || "",
  assignees: arr(r.assignees),
  stageHistory: arr(r.stage_history),
  attachments: arr(r.attachments),
  links: arr(r.links),
  comments: arr(r.comments),
  queries: arr(r.queries),
  history: arr(r.history),
});

export const taskToRow = t => ({
  id: t.id,
  no: t.no,
  title: t.title || "",
  descr: t.desc || "",
  status: t.status,
  blocked: t.blocked || null,
  priority: t.priority || "medium",
  deadline: t.deadline || null,
  effort_days: t.effortDays ? String(t.effortDays) : null,
  start_at: t.startAt || null,
  closed_at: t.closedAt || null,
  created_by: t.createdBy || null,
  owner: t.owner || null,
  poc: t.poc || "",
  requirements: t.requirements || "",
  reference: t.reference || "",
  tech_stack: t.techStack || "",
  remarks: t.remarks || "",
  product_url: t.productUrl || "",
  assignees: arr(t.assignees),
  stage_history: arr(t.stageHistory),
  attachments: arr(t.attachments),
  links: arr(t.links),
  comments: arr(t.comments),
  queries: arr(t.queries),
  history: arr(t.history),
  updated_at: new Date().toISOString(),
});

const rowToNotif = r => ({ id: r.id, to: r.recipient, text: r.body, at: iso(r.at), read: !!r.read, task: r.task_id });
const rowToChat  = r => ({ id: r.id, by: r.by_id, text: r.body, at: iso(r.at) });
const rowToEmail = r => ({ from: r.sender, to: arr(r.send_to), subject: r.subject, at: iso(r.at), task: r.task_id });
const requestFieldNames = ["processDescription", "futureProcess", "functionalNeed", "obligations", "links", "useCase", "justification", "currentProcess", "painPoints", "proposedSolution", "functionalRequirements", "stepProcess", "integrationRequirements", "systems", "dataInputsOutputs", "acceptanceCriteria", "regulatory", "keyRisks", "otherBenefits", "priority", "integrationApplicable", "benefitsApplicable", "riskApplicable", "requestType", "requiredDate", "dataClassification", "securityReview", "manualEffort", "effortReduction", "productivity", "currentCost", "costReduction"];
const toSnake = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const rowToAudit = r => ({ at: iso(r.at), by: r.by_id, task: r.task_id, title: r.title, ev: r.event });
const rowToPerson= r => ({ id: r.id, name: r.name, email: r.email, role: r.role, initials: r.initials });

/* ---------- reads ---------- */

export async function loadAll() {
  if (!sb) return null;
  const [people, tasks, notifs, chat, reads, emails, audit, settings] = await Promise.all([
    guard("load people",   () => sb.from("people").select("*").order("sort_order"), []),
    guard("load tasks",    () => sb.from("tasks").select("*").order("no"), []),
    guard("load notifications", () => sb.from("notifications").select("*").order("at", { ascending: false }).limit(300), []),
    guard("load chat",     () => sb.from("chat_messages").select("*").order("at").limit(300), []),
    guard("load chat reads", () => sb.from("chat_reads").select("*"), []),
    guard("load emails",   () => sb.from("email_log").select("*").order("at", { ascending: false }).limit(200), []),
    guard("load audit",    () => sb.from("audit_log").select("*").order("at", { ascending: false }).limit(500), []),
    guard("load settings", () => sb.from("app_settings").select("*").eq("id", 1).maybeSingle(), null),
  ]);
  const chatRead = {};
  (reads || []).forEach(r => { chatRead[r.person_id] = iso(r.at); });
  return {
    people:  (people || []).map(rowToPerson),
    tasks:   (tasks || []).map(rowToTask),
    notifs:  (notifs || []).map(rowToNotif),
    chat:    (chat || []).map(rowToChat),
    chatRead,
    emails:  (emails || []).map(rowToEmail),
    audit:   (audit || []).map(rowToAudit),
    groq: settings?.groq && Object.keys(settings.groq).length ? settings.groq : null,
    mail: settings?.mail && Object.keys(settings.mail).length ? settings.mail : null,
    formUrl: settings?.form_url || null,
  };
}

/* ---------- writes ---------- */

export const upsertTask = t  => guard("save task", () => sb.from("tasks").upsert(taskToRow(t)));
export const deleteTask = id => guard("delete task", () => sb.from("tasks").delete().eq("id", id));

export const insertNotifs = (toIds, text, taskId) =>
  guard("save notifications", () =>
    sb.from("notifications").insert(toIds.map(id => ({ recipient: id, body: text, task_id: taskId || null }))));

export const markNotifsRead = recipient =>
  guard("mark read", () => sb.from("notifications").update({ read: true }).eq("recipient", recipient).eq("read", false));

export const insertChat = (byId, text) =>
  guard("save chat", () => sb.from("chat_messages").insert({ by_id: byId, body: text }));

export const setChatRead = personId =>
  guard("save chat read", () => sb.from("chat_reads").upsert({ person_id: personId, at: new Date().toISOString() }));

export const insertEmail = ({ from, to, subject, task }) =>
  guard("log email", () => sb.from("email_log").insert({ sender: from, send_to: to, subject, task_id: task || null }));

export const insertAudit = ({ by, task, title, ev, at }) =>
  guard("save audit", () => sb.from("audit_log").insert({ by_id: by, task_id: task, title, event: ev, at }));

export const savePeople = list =>
  guard("save people", () =>
    sb.from("people").upsert(list.map((u, i) => ({
      id: u.id, name: u.name, email: u.email, role: u.role, initials: u.initials, sort_order: i + 1,
    }))));

export const removePerson = id => guard("remove person", () => sb.from("people").delete().eq("id", id));

export const saveSettings = patch => guard("save settings", () => sb.from("app_settings").upsert({ id: 1, ...patch }));

/* ---------- file storage ---------- */

export const BUCKET = "ziu-files";
export const FORM_BUCKET = "automation-need-files";
export const MAX_FILE_MB = 25;

/* Uploads one file and returns { name, size, url, path } — or null if the
   upload failed, in which case the caller records the file name only. */
export async function uploadFile(taskId, file) {
  if (!sb) return null;
  const safe = (file.name || "file").replace(/[^\w.\- ]+/g, "_").slice(-80);
  const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  try {
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600", upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) { console.warn("[ziu] upload:", error.message); return null; }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { name: file.name, size: file.size, url: data?.publicUrl || "", path };
  } catch (e) {
    console.warn("[ziu] upload:", e?.message || e);
    return null;
  }
}

export const fileDownloadUrl = file => {
  const url = file?.path
    ? sb?.storage.from(BUCKET).getPublicUrl(file.path).data?.publicUrl
    : file?.url;
  if (!url) return "";
  try {
    const result = new URL(url);
    result.searchParams.set("download", file.name || "download");
    return result.href;
  } catch {
    return url;
  }
};

/* Best-effort tidy-up when someone removes an attachment. */
export async function deleteFile(path) {
  if (!sb || !path) return;
  try { await sb.storage.from(BUCKET).remove([path]); }
  catch (e) { console.warn("[ziu] delete file:", e?.message || e); }
}

/* ---------- requirement submissions ---------- */

const rowToReq = (r, source = "requirements") => ({
  id: `${source}:${r.id}`, dbId: r.id, source, publicId: r.public_id || r.publicId || r.request_id || r.reference || `REQ-${r.id}`, title: r.title || r.name || r.process_name || "Untitled request", department: r.department || r.team || "",
  requestor: r.requestor || r.requester || r.requested_by || r.requestor_name || r.poc || "", email: r.email || r.requestor_email || r.poc_email || "",
  payload: r.payload || r.fields || r.data || r.form_data || Object.fromEntries(requestFieldNames.map(key => [key, r[key] ?? r[toSnake(key)]]).filter(([, value]) => value != null)), files: files: arr(r.files || r.attachments).map(file => ({
  ...file,
  bucket: source === "automation_requests" ? FORM_BUCKET : BUCKET
})),
  score: r.priority_score ?? r.priorityScore ?? null, band: r.priority_band || r.priorityBand || "",
  status: ({ pending: "submitted", new: "submitted", submitted: "submitted", approved: "approved", rejected: "rejected" })[String(r.status || "submitted").toLowerCase()] || "submitted", rejectReason: r.reject_reason || r.rejectReason || "",
  decidedBy: r.decided_by || r.decidedBy, decidedAt: iso(r.decided_at || r.decidedAt),
  taskId: r.task_id || r.taskId, createdAt: iso(r.created_at || r.createdAt || r.submitted_at || r.submittedAt || r.timestamp || r.at || r.created),
});

export const loadAutomationRequests = () =>
  guard("load automation requests", () =>
    sb.from("automation_requests").select("*").limit(300), [])
    .then(rows => (rows || []).map(r => rowToReq(r, "automation_requests"))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));

export const decideRequirement = (id, patch) =>
  guard("save requirement", () => sb.from(patch.source || "requirements").update({
    status: patch.status,
    reject_reason: patch.rejectReason ?? "",
    decided_by: patch.decidedBy,
    decided_at: new Date().toISOString(),
    task_id: patch.taskId ?? null,
  }).eq("id", patch.dbId ?? id));

/* ---------- realtime ---------- */

/* Calls the handlers whenever anyone else changes something.
   Returns an unsubscribe function; safe to call when offline. */
export function subscribe(h = {}) {
  if (!sb) return () => {};
  const ch = sb.channel("ziu-connect");
  const on = (table, cb) => ch.on("postgres_changes", { event: "*", schema: "public", table }, cb);

  on("tasks", p => {
    if (p.eventType === "DELETE") h.onTaskDelete?.(p.old?.id);
    else if (p.new) h.onTask?.(rowToTask(p.new));
  });
  on("notifications", p => { if (p.eventType !== "DELETE" && p.new) h.onNotif?.(rowToNotif(p.new)); });
  on("chat_messages", p => { if (p.eventType === "INSERT" && p.new) h.onChat?.(rowToChat(p.new)); });
  on("chat_reads",    p => { if (p.new) h.onChatRead?.(p.new.person_id, iso(p.new.at)); });
  on("people",        () => h.onPeople?.());
  on("app_settings",  p => { if (p.new) h.onSettings?.({ groq: p.new.groq, mail: p.new.mail, formUrl: p.new.form_url }); });
  on("automation_requests", p => {
    if (p.eventType === "DELETE") h.onReqDelete?.(`automation_requests:${p.old?.id}`);
    else if (p.new) h.onRequirement?.(rowToReq(p.new, "automation_requests"));
  });

  ch.subscribe(status => {
    if (status === "SUBSCRIBED") h.onStatus?.("live");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") h.onStatus?.("retrying");
    else if (status === "CLOSED") h.onStatus?.("offline");
  });

  return () => { try { sb.removeChannel(ch); } catch {} };
}

/* refetch just the people list — used after a realtime people event */
export const loadPeople = () =>
  guard("load people", () => sb.from("people").select("*").order("sort_order"), [])
    .then(rows => (rows || []).map(rowToPerson));
