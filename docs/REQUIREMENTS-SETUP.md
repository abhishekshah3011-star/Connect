# Requirement intake form — setup

Three things to do, about 10 minutes. The form is a **separate website** that writes
into the **same Supabase database** as ZIU Connect.

---

## Step 1 — Add the table

Supabase → **SQL Editor** → **New query** → paste all of `requirements-setup.sql` → **Run**.

If the "Potential issue detected" dialog appears, click **Run query** — it's flagging the
`drop policy if exists` line, which exists so the file is safe to re-run.

Check it worked: **Table Editor** should now list a `requirements` table (empty).

---

## Step 2 — Deploy the form

`ZIU-Requirement-Form-netlify-drop.zip` is a complete, already-built site with your
Supabase details baked in.

1. Go to **https://app.netlify.com/drop**
2. Drag the zip on — don't unzip it first.
3. You get a new URL, something like `https://calm-hamster-3f9a1c.netlify.app`.

Rename it under **Site configuration → Change site name** to something people can
type, e.g. `ziu-requirements.netlify.app`.

**That URL is the link you share.** Anyone with it can submit — no sign-in, which is
the point. They never see ZIU Connect.

---

## Step 3 — Update ZIU Connect

Drag `ZIU-Connect-netlify-drop.zip` onto your existing site's **Deploys** tab. This
adds the Requirements section.

---

## How it works day to day

**Someone submits.** They fill the form, attach up to 10 files (20 MB each), and get a
reference number on screen — `REQ-2026-A7951DAE`. Files go to the same `ziu-files`
bucket your task attachments use.

**You review.** A **Requirements** item appears in the ZIU Connect sidebar with a red
count of anything awaiting review. Only **Krunal, Abhishek, Jaynil and Katha** see it —
Vijesh, Ujay and Jigar don't, since the rule is "everyone except the view-only accounts."

Open a submission to see all 28 fields laid out, plus attachments with download links.

**Approve** → a task is created immediately:

| Task field | Comes from |
|---|---|
| Title | Requirement title |
| Description | Use-case + business justification |
| Requirements | Solution, functional reqs, step-wise process, integration, acceptance criteria, as-is process, pain points, regulatory, risks, data classification, security review |
| Priority | The form's priority (Critical/High/Medium/Low) |
| Deadline | Required-by date, or 21 days out if blank |
| POC | Requestor's name |
| Reference | The REQ- number, so you can trace it back |
| Tech stack | Systems involved |
| Assignees | Abhishek, Jaynil and Katha |
| Stage | Task assigned (stage 1 of 9) |
| Attachments | Carried over with working download links |

It lands in Overview straight away and everyone gets a notification. You're taken to
the new task so you can adjust anything.

**Reject** → asks for a reason, which is required. The submission stays on record in
the Rejected tab with who rejected it and why. No task is created.

Tabs across the top: Awaiting review, Approved, Rejected, All.

---

## Worth knowing

**The form link is public by design.** Anyone with it can submit a requirement. They
can't read existing submissions or see anything else — the form only writes. But
someone could submit junk, so don't post the link publicly.

**Voice typing** works in the descriptive fields on Chrome and Edge over https. On
other browsers the form quietly says so and everything can still be typed. This came
with the original form and is unchanged.

**Drafts save locally.** The Save draft button keeps a copy in that person's browser,
not in the database. It clears once they submit.

**Submissions appear live.** If you're looking at the Requirements section when one
arrives, it appears without a refresh.

**No email on submission.** You chose in-app only, so nothing is sent — consistent
with the stage-moves-only email rule. Say the word if you want to change that.
