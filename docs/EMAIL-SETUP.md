# Progress emails — setup

One email goes out when a task moves to a new stage. Nothing else sends mail.

## Get the three keys (free, ~5 minutes)

1. Sign up at **https://www.emailjs.com** — the free tier covers 200 emails/month.

2. **Email Services → Add New Service → Gmail.** Connect the Gmail account the mail
   should be sent *from*. Copy the **Service ID** (looks like `service_a1b2c3d`).

3. **Email Templates → Create New Template.** Set the fields to use these variables
   exactly — EmailJS won't deliver if the To field is blank:

   | Template field | Value |
   |---|---|
   | To email | `{{to_email}}` |
   | From name | `{{from_name}}` |
   | Subject | `{{subject}}` |
   | Content | `{{message}}` |

   Set the Content block to **plain text**, not the rich-text editor — the body uses
   line breaks and a progress bar that HTML mode will collapse.

   Save and copy the **Template ID** (`template_x7y8z9`).

4. **Account → General → Public Key.** Copy it.

## Turn it on

In the app: **Settings → Email notifications**. Paste all three, tick
**Send progress emails**. The chip turns green when all three are filled and the
toggle is on.

Only the Assigner account can edit these. They're saved in that browser only —
if you switch machines or browsers, paste them again.

## What sends, and to whom

| Event | Email? |
|---|---|
| Task moves to a new stage | **Yes** |
| Comment posted | No |
| File attached / link pinned | No |
| Task edited, created or deleted | No |
| Task flagged blocked or unblocked | No |
| Team chat message | No |

Recipients are everyone in the workspace **except the person who made the move** —
they already know. So when a team member advances a task, all six others including
you get mail; when you move one yourself, the other six get it.

All of these still raise in-app bell notifications regardless — the email filter
only changes what leaves the browser.

## Sample email

```
Subject: [ZIU Connect #2] 5471 Form → Final Demo

5471 Form has moved forward a stage.

  Was:      Build
  Now:      Final Demo   (stage 7 of 9)
  Progress: ███████░░  78%

  Task:     #2 · T-1002
  Moved by: Krunal Rajput
  Team:     Jaynil Agarwal, Abhishek Shah, Katha Pawale
  Priority: Critical
  Deadline: 23 Aug

— ZIU Connect · 11/08/2026, 5:03:32 PM
```

A task reaching **Go Live** adds a closing line; an overdue task marks the deadline
with `** OVERDUE **`; a blocked task adds a `Blocked:` line with the reason.

## Things worth knowing

**It won't send from a `file://` page.** Opening the preview HTML by double-clicking
gives the browser a null origin, and EmailJS rejects that. Deploy to Vercel/Netlify,
or run `npm run dev` locally, and it works. Until then the app logs every mail it
*would* have sent on each task's Email activity card, so you can verify the wiring
without spending quota.

**Keys are visible to anyone using the app.** EmailJS public keys are designed for
browser use, but anyone who opens DevTools on your deployed site can read them and
send mail through your template. Lock the template down in the EmailJS dashboard
(allowed origins) if that matters.

**Sends are fire-and-forget.** A failed send is logged to the browser console and
the in-app log still records it — the app never blocks or shows an error. If mail
isn't arriving, check the console and the EmailJS dashboard's history tab.

**All three members are on all eight tasks.** Every stage move therefore mails six
people. If that gets noisy, narrowing recipients to just you is a one-line change.
