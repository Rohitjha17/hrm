# HRMS User Manual

A complete guide to using the HRMS application — attendance, planning, tasks,
leave, salary, appraisals, and every supporting module. Written for both
**employees** (self-service) and **admins / HR** (management view).

> This manual describes the current application. Names in **bold** are the
> actual buttons, labels, and menu items you'll see on screen.

---

## Table of contents

1. [Core concepts](#1-core-concepts)
2. [Getting started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Attendance](#4-attendance)
5. [Planning & daily updates](#5-planning--daily-updates)
6. [Tasks](#6-tasks)
7. [Leave](#7-leave)
8. [Salary & payroll](#8-salary--payroll)
9. [Appraisals](#9-appraisals)
10. [Reports & exports](#10-reports--exports)
11. [Policies](#11-policies)
12. [Workflows (personal rulebooks)](#12-workflows-personal-rulebooks)
13. [Recruitment](#13-recruitment)
14. [Communication Templates](#14-communication-templates)
15. [Doc Vault & joining checklist](#15-doc-vault--joining-checklist)
16. [Assets](#16-assets)
17. [Lifecycle & exit management](#17-lifecycle--exit-management)
18. [Training](#18-training)
19. [Helpdesk](#19-helpdesk)
20. [Notice Board, Recognition, Visitors & Meetings](#20-notice-board-recognition-visitors--meetings)
21. [Monitoring (opt-in screen capture)](#21-monitoring-opt-in-screen-capture)
22. [People administration](#22-people-administration)
23. [Navigation map](#23-navigation-map)
24. [Troubleshooting & FAQ](#24-troubleshooting--faq)

---

## 1. Core concepts

### Accounts, roles and permissions

- Every person signs in with an **email + password** provisioned by an admin.
  The app never displays anyone's credentials — passwords are shared
  out-of-band by your admin.
- Access is **permission-based**. Roles (Employee, Manager, HR, Super Admin,
  or any custom role) bundle permissions such as `leave.approve` or
  `salary.manage`. What you see in the sidebar and what buttons appear on each
  page depend entirely on the permissions your roles grant.
- A **Super Admin** holds the `*` wildcard and can see and do everything.
- Permissions are enforced twice: in the UI (hidden pages/buttons, an
  **"Access denied"** page for blocked routes) **and** at the database with
  Row Level Security — typing an admin URL by hand never exposes data you're
  not entitled to.

### Admin View vs Employee View

Users with admin access see a toggle in the top header with two buttons:
**Admin View** and **Employee View**.

- **Admin View** shows the management sidebar (Attendance monitor, Leave
  approvals, Salary, Reports, Users, Roles, …).
- **Employee View** shows the self-service sidebar (My Attendance, Planning,
  Leave, My Assets, …) — the same thing a regular employee sees.
- It's a lens, not a re-login: your permissions don't change, only the menu.
  Admin-capable users start in Admin View each session. Regular employees
  never see the toggle and are always in Employee View.

### Realtime sync

All data lives in one central database. Most lists (attendance monitor,
tasks, leave, tickets, meetings, planning) update **live** — when an employee
punches in on a phone, an admin watching the monitor sees the row change
within seconds, no refresh needed. If the live connection drops, a polling
fallback refreshes every few seconds.

### The header

On every page the top header shows:

- The **Admin View / Employee View** toggle (admin users only).
- A **Backend health badge**: green **"Backend: connected"** when everything
  is fine, red **"Backend: offline"** if the app can't reach its database.
- Your signed-in **email**.
- The **Sign out** button.

---

## 2. Getting started

### Signing in

1. Open the app URL (must be HTTPS — the camera and GPS features require it).
2. Enter your **Email** and **Password**, then click **Sign in**.
3. A wrong email/password shows **"Invalid email or password."** — try again.
4. On success you land on your Dashboard (Admin or Employee, depending on
   your role).

### Forgot your password?

1. On the login page, type your email into the **Email** field first.
2. Click **Forgot password?** — you'll see **"Password reset email sent —
   check your inbox for the link."**
3. If you clicked without typing your email, the page asks you to enter it
   first. If no email arrives, contact your admin, who can set a new password
   for you directly.

### The layout

- **Sidebar (left):** all modules you have access to. On mobile, open it with
  the menu (hamburger) button.
- **Header (top):** view toggle, health badge, your email, **Sign out**.
- **404 / Access denied:** an unknown URL shows *"Page not found"*; a page
  you lack permission for shows *"Access denied"* with a **Back to
  dashboard** button.

---

## 3. Dashboard

Route: `/` — the landing page after login. Its content depends on your view.

### Employee Dashboard

Header: **"Welcome, \<your name\>"**. Four stat cards, each clickable:

| Card | Shows | Click goes to |
|---|---|---|
| **Attendance today** | Punched in / Not punched in / today's day status, plus hours worked | My Attendance |
| **Open tasks** | Your open task count (and total) | Tasks |
| **Leave remaining** | Days left across all leave types | Leave |
| **Today's plan** | Average completion % of today's planned slots | Planning |

Below the cards:

- **Leave balances** — per leave type, days left with a progress bar, plus a
  note if you have requests pending approval. **Apply** links to Leave.
- **Latest announcements** — the four newest notices. **Notice board** opens
  the full feed.

### Admin Dashboard

Header: **"Admin Dashboard — Organisation overview"**. Stat cards (each
clickable): **Employees**, **Present today (of N)**, **Late arrivals today**,
**Pending leave approvals**, **Open tasks**, **Open tickets** (turns red with
a count when any SLA is breached), **Departments**.

Below: a **Pending leave approvals** card (up to 5 requests, with a
**Review** link to Leave Approvals) and **Latest announcements**.

---

## 4. Attendance

Attendance is GPS-gated, selfie-verified, and classified automatically from
the hours you actually work.

### 4.1 My Attendance (employee)

Sidebar: **My Attendance** → `/attendance`.

The page shows two cards: **Today's status** (with the punch button) and
**Today's punches** (every punch with time, distance from office, and a 📷
marker when a selfie was stored).

**To punch in:**

1. Click the large **Punch In** button. A modal opens with a **live selfie
   preview** and your location status.
2. Allow **location** and **camera** when the browser asks. While locating,
   you'll see *"Acquiring location…"*; then your distance appears:
   **"X m from office (max 50 m)"** — green when inside the allowed radius,
   red when outside.
3. Click **Capture & Punch In**. The app snaps a selfie, checks the radius
   (the server re-checks it independently — this is not just a UI check), and
   records the punch. You'll see a **"Punched in"** toast.

**To punch out:** the same flow — the button reads **Punch Out**, and the
modal button reads **Capture & Punch Out**.

Notes:

- If your camera is unavailable or denied, the punch still works with a
  placeholder image. Location, however, is mandatory.
- If you're outside the radius you'll see **"You are outside the office
  radius. Move closer and try again."** and no punch is recorded.
- Other errors you may see: *"You are already punched in."*, *"You need to
  punch in first."*, *"Your network is not allowed for attendance."* (when an
  IP allowlist is configured).

**Day classification.** Your day status is computed from total worked time
(sum of all in→out segments):

| Status | Meaning (default thresholds) |
|---|---|
| **Full Day** | ≥ 8 hours worked |
| **Half Day** | ≥ 4 hours |
| **Quarter Day** | ≥ 2 hours |
| **Absent / Short** | under 2 hours |
| **Present (in progress)** | currently punched in, day not yet complete |

Two flags can also appear: an amber **Late** badge (first punch-in after the
official start time plus a grace period, default 10 minutes) and a blue
**OT** badge (overtime — time worked beyond 9 hours by default).

### 4.2 The punch-in lock (planning gate)

Punching **in** is blocked if your **last worked day wasn't fully planned**
on the Planning page. When locked, an amber banner appears on My Attendance:

> **Punch-in locked.** Your planning for *\<date\>* is incomplete — add slots
> on the Planning page covering the full working day (10:00–18:30). Punch-in
> stays blocked every day until that day is fully planned or an admin
> unlocks it.

Two ways to clear it:

1. **Self-clear:** open **Planning**, pick the blocking date, and add slots
   until they cover the whole working window. The lock lifts automatically
   within seconds.
2. **Admin unlock:** an admin unlocks you from the Planning Monitor (with a
   mandatory remark — see §5.3).

Punching **out** is never blocked.

### 4.3 Attendance Monitor (admin)

Sidebar (Admin View): **Attendance** → `/admin/attendance`. Requires
`attendance.view_all`.

- A **live** table (pulsing green "live" dot) of everyone's day: Employee,
  Status, Worked, First In, Last Out, and Flags (**Late**, **OT**). New
  punches appear in real time.
- **From / To date pickers** — pick a single day or a range. For a range you
  also get a **Per-employee summary** table (Days present, Total worked,
  Late count, Overtime) sorted by hours worked.
- **Summary tiles** across the top: Employees, Records, Full / Present,
  Half / Quarter, Absent, Late arrivals, Total worked.
- **Settings** (gear button; requires `attendance.manage`): adjust
  **Radius (m)**, **Late grace (min)**, **Full day (hrs)**, **Half day
  (hrs)**, **Quarter day (hrs)**, then **Save**.

There is no manual punch editing — attendance is what was actually punched.

---

## 5. Planning & daily updates

Employees plan their whole working day as time slots and keep them updated as
work progresses. A fully planned day is one whose slots **cover the entire
working window** (default **10:00–18:30**). An unplanned day locks your next
punch-in (§4.2).

### 5.1 Planning (employee)

Sidebar: **Planning** → `/planning`.

The header badge shows your day at a glance: green **"All hours planned"** or
amber **"Planning pending"**. While hours are uncovered, an amber hint tells
you exactly where the gap starts, e.g. *"…your slots don't cover 14:00
onwards yet."*

**To plan a day:**

1. Pick the date in the **Plan for** date picker (a **Today** badge confirms
   when you're on today). You can plan past or future dates.
2. Click **Add slot**. In the form set:
   - **Start** and **End** times (End auto-advances by the default 2-hour
     interval; End must be after Start).
   - **Planning** — what you intend to work on.
   - **Working** — what you're actually doing (fill/update during the day).
   - **Completion %** — 0–100.
   - **Challenges** — anything blocking you.
3. Click **Add slot** / **Save slot**. Repeat until your slots cover the full
   window — the badge turns green.

Each slot row shows its time range, planning text, a **completion badge**
(green at 100%), and your **Working**/**Challenges** notes. Use the pencil to
**edit**, the clock to view the slot's **edit history** (every change is
recorded as before → after with a timestamp), and the trash to **delete**.

A **"Your open tasks"** panel on the right lists up to 10 of your open tasks
(title, priority, status, due date) so you can plan against real work.

### 5.2 Planning Monitor (admin)

Sidebar (Admin View): **Planning** → `/admin/planning`. Requires
`planning.view_all`.

- **Filters:** a **Date** picker and an **Employee** dropdown.
- The compliance table shows, per employee:
  - **Planning (\<date\>)** — green **planned** or amber **pending from
    \<time\>** (where their coverage gap begins).
  - **Punch Lock** — red **locked (\<date\>)** naming the blocking day, or
    green **clear**.
  - **View plan** (eye icon) — opens that person's slots for the selected
    date, including Working, Completion % and Challenges.
  - **Unlock** — enabled only when the person is locked.

### 5.3 Unlocking an employee

1. Click **Unlock** on the locked row.
2. Enter a **Remark** — it is mandatory; the button stays disabled until you
   type one (e.g. why the exception was granted).
3. Click **Unlock**. The lock lifts immediately (their attendance page
   updates within seconds).

Every unlock is recorded in the **Unlock history** table at the bottom of the
page: **When, Employee, Unlocked day, By, Remark** — a permanent audit trail.

---

## 6. Tasks

Sidebar: **Tasks** → `/tasks` (same page in both views; abilities depend on
your permissions).

### 6.1 Creating tasks

Click **New task** and fill in:

- **Title** (required)
- **Date of creation** (auto-filled, read-only)
- **Priority** — Low / Medium / High
- **Due date** (optional)
- **Assignee** — defaults to **Myself**. Only users with the `tasks.assign`
  permission (typically managers) can pick someone else; everyone else sees
  *"Only managers can assign to others."*
- **Remarks** (optional notes)

Click **Create task**. New tasks start in the first status of the status
master (e.g. *To Do*). Assigned tasks appear on the assignee's list within
seconds — no refresh needed.

### 6.2 Working with tasks

The table shows Task (with due date and latest remark), Assignee, Created
by, Created date, Priority, and Status. Toolbar options:

- **My tasks / All tasks** toggle and an **Employee** filter — visible to
  users with `tasks.view_all` (admins/managers). Everyone else sees only
  tasks they created or are assigned.
- **Show completed (N) / Hide completed** — completed (terminal-status) tasks
  are hidden by default.

Per-row actions:

- **Update** — change **New status** (with optional **Remarks** attached to
  the change) and/or the **Due date** (only the assignee, creator, or a task
  manager may change the due date).
- **Remark** (message icon) — add remarks any time; the **Remark history**
  below shows every remark with author and timestamp.
- **History** (clock icon) — the full status trail: *from → to*, who changed
  it, when, and the remark given.
- **Delete** (trash icon, admins with `tasks.manage` only) — permanently
  deletes the task **and** its remarks and history, after a confirmation.

### 6.3 Task statuses (admin)

Admins with `tasks.manage` see a **Statuses** button. The status master lists
all statuses: seeded ones are tagged **system** and can't be deleted; add
your own (e.g. `Blocked`) by typing a name and clicking **Add** — it becomes
selectable on every task immediately.

---

## 7. Leave

### 7.1 Applying for leave (employee)

Sidebar: **Leave** → `/leave`.

The page opens with five insight cards — **Total entitled, Used, Remaining,
Approved, Pending** — and a **Balance by leave type** section showing days
left per type ("Used X of Y").

**To apply:**

1. Click **Apply for leave**.
2. Choose the **Type** (Casual, Sick, … as configured), the **Duration** —
   **Full day**, **Half day** (counts 0.5/day), or **Quarter day** (0.25/day)
   — and the **From** / **To** dates.
3. The form shows live how much it costs: *"Counts as N day(s) against your
   balance"*.
4. Add an optional **Reason** and click **Submit**.

Your request appears in **My requests** with status **pending**. You can
**Cancel** a request while it's still pending. When an admin decides, the row
flips to **approved** (balance updates immediately) or **rejected** (no
balance consumed) — live, without a refresh. Any **Admin remark** they leave
is visible on your row.

### 7.2 Leave Approvals (admin)

Sidebar (Admin View): **Leave** → `/admin/leave`. Requires `leave.approve`
(or `leave.view_all`).

- Insight cards: **Pending, Approved, Rejected, On leave today, Approved days
  (total)**.
- The **Pending approvals** table lists each request (Employee, Type, dates,
  Duration, Days) with **Approve** and **Reject** buttons. Approving deducts
  the days from the employee's balance instantly.
- **All leave requests** below shows the full history with a **Status
  filter** (All / Pending / Approved / Rejected / Cancelled). Use the remark
  icon on any row to write an **Admin remark** the employee will see (reason,
  conditions, follow-up).

### 7.3 Holiday calendar (admin)

At the bottom of Leave Approvals (requires `holidays.manage`): type a
**Holiday name**, pick the **date**, click **Add**. Holidays appear in the
table and can be deleted with the trash button.

### 7.4 Per-employee leave quotas

Annual quotas are set **per person** in **Users** (Admin View): both the
**Add employee** and **Edit employee** forms include a **"Leave quotas
(days / year)"** section with one field per leave type (defaults come from
each type's standard quota; unpaid types are marked **(unpaid)**). When
editing, each field shows *"Used N this year"* so you can adjust safely.
See §22.1.

---

## 8. Salary & payroll

Salary is computed **server-side** from policy + real attendance, leave,
planning and adjustment data. Employees see only their own summary; all
management requires the `salary.manage` permission.

### 8.1 My Salary (employee)

Sidebar: **Salary** → `/salary`. Requires the `salary.view_own` permission —
by default salary is hidden from employees entirely until an admin grants it.

- **Salary structure (monthly):** your components, each tagged **earning** or
  **deduction**, with **Gross** and **Net** totals.
- **Payslips table:** one row per finalized month — **Month, Present, Gross,
  Net**. (The detailed statutory breakdown and PDF download are admin-side.)

### 8.2 Salary administration

Sidebar (Admin View): **Salary** → `/admin/salary`. Viewing requires
`salary.view`; editing and computing require `salary.manage`.

**Salary breakdown (left card).** Pick an **Employee**, then build their
monthly structure: each row has a **Component** name, a kind (**Earning** /
**Deduction**) and an **amount**; use **Add component** for more rows (new
profiles start with Basic, HRA, Special allowance + Provident fund). The
summary shows **Gross (earnings)**, **Deductions**, and **Net (in-hand)**.
Click **Save breakdown**. The sum of earnings becomes the monthly CTC that
payroll prorates.

**Adjustments.** In the same card, add month-specific one-offs: pick
**Incentive / Penalty / Increment**, enter the amount, click **+**. They're
listed with colored badges and feed the next computation of that month.

**Computing a payslip (right card).**

1. Select the **Employee** and the **Month**.
2. Click **Compute**. The engine runs server-side and the payslip appears:
   big **Gross** and **Net** figures plus the full grid — Present, Half,
   Quarter, Absent, Paid leave, Late, Overtime (min), Planning gaps, Base
   earned, Overtime pay, Incentives, Increments, Penalties, PF, ESIC,
   Prof. tax, TDS.
3. Click **Download payslip** for a PDF salary slip.

Recomputing the same month overwrites that month's run.

**How the math works (summary).** Base pay is prorated per paid day —
present days count 1, half days 0.5, quarter days 0.25, and approved *paid*
leave counts if the policy says so. Overtime pays per hour at the policy
rate. Penalties accrue per late day and per planning-non-compliant day, plus
any manual penalty adjustments. Statutory deductions (PF % of base, ESIC % of
gross, flat professional tax, TDS % of gross) apply only if configured in the
salary policy — they default to zero.

### 8.3 Full & Final settlement

At the bottom of the admin Salary page:

1. Pick the **Employee** and their **Last working day**.
2. Click **Compute F&F** — you get **Final salary, Leave encashment, Dues,**
   and **Net payable**.
3. Click **Generate F&F letter** for the settlement PDF.

---

## 9. Appraisals

Appraisals score employees **from real data** — attendance, task completion
and planning compliance — for a named review period, alongside a manual
performance rating and written feedback.

### 9.1 Managing appraisals (admin)

Sidebar (Admin View): **Appraisals** → `/admin/appraisal`. Viewing requires
`appraisal.view`; all changes require `appraisal.manage`.

**Create a review period:** click **New period**, give it a **Name** (e.g.
"April 2026 Review") and **From / To** dates, click **Create**. Periods are
listed on the left; select one to work in it.

**Add people:** click **Add appraisal** to enroll one employee (with an
optional starting **Performance rating (1–5)**, **KRA**, **KPI**, **Manager
feedback**, **HR feedback**) — or click **Add all employees** to enroll
everyone at once.

**Compute scores:** click **Compute** on a row (or **Compute all**). Scores
fill in, 0–100 each:

- **Att** — attendance score: weighted presence over the period (full day =
  1, half = 0.5, quarter = 0.25, absent = 0).
- **Task** — % of the period's tasks (assigned to or created by the person)
  that reached a completed status.
- **Plan** — % of working days whose planning was compliant (fully planned or
  admin-unlocked).
- **Overall** — the average of the three.

**Review and edit:** click **Details** on a row to see the four score tiles
and edit the **Performance rating**, **KRA**, **KPI**, **Manager feedback**
and **HR feedback**. Every edit to these fields is recorded in the **Change
history** at the bottom of the modal (old value → new value, by whom, when).

**Removing things:** the trash icon on a row removes that employee from the
period (their scores, feedback and history for the period are deleted); the
trash next to the period name deletes the whole period and everything in it.
Both ask for confirmation.

### 9.2 My Appraisals (employee)

Sidebar: **Appraisals** → `/appraisal`. Requires `appraisal.view_own`.

One card per review you've received: period name and dates, **Overall**
score badge, your **Performance** star rating, and the three component
scores (**Attendance, Tasks, Planning**), plus any manager feedback quote.
Click **Full details** for the complete read-only view including KRA, KPI,
HR feedback and the change history.

---

## 10. Reports & exports

Sidebar (Admin View): **Reports** → `/admin/reports`. Requires `reports.view`.

One page, **17 reports**, selected via tabs:

**Attendance · Leave · Salary · Task · Performance / Appraisal · Planning ·
Recruitment · Communication · Doc Vault · Assets · Lifecycle · Helpdesk ·
Visitors · Meetings · Training · Policies · Workflows**

- **Filters** (top of page): **From** date, **To** date, and **Employee** —
  they apply to whichever report is open (Recruitment and Policies have no
  employee column, so the employee filter is ignored there). **Clear** resets
  all filters.
- **Export:** with data loaded, click **Excel** for an `.xlsx` file or
  **PDF** for a formatted PDF — both export exactly the filtered rows shown.
- Each report renders up to 1,000 rows.

Highlights of what each contains: Attendance (status/worked/late/OT per
day), Leave (requests + status), Salary (per-month Gross/Net), Task
(assignee/status/priority/due), Appraisal (all four scores), Planning
(slots with progress and challenges), Assets (allotment history with serials),
Helpdesk (tickets + escalation), Meetings (invitees and acceptances),
Training (assignment → completion → acknowledgement), Workflows (owner,
steps, active).

---

## 11. Policies

### 11.1 Policy management (admin)

Sidebar (Admin View): **Policies** → `/admin/policies`. Requires
`policy.manage`.

- **Create:** click **New policy**, pick a **Category** (attendance, leave,
  salary, planning, wfh, appraisal, general) and a **Title**. A new policy
  starts unpublished (version 0) — employees can't see it yet.
- **Publish:** select the policy, click **Publish new version**, paste the
  **Content** and an optional **Change note**, click **Publish**. Each
  publish creates an immutable version (v1, v2, …) listed in **Version
  history** with its note and full text.
- **Attachments:** use **Add file** to attach documents (PDFs etc.); they're
  stored privately and download via short-lived signed links.
- **Delete** removes the policy with all versions and attachments (confirmed
  first).

### 11.2 Reading & acknowledging (employee)

Sidebar: **Policies** → `/policies` (available to everyone).

Each published policy appears as a card with its category, version badge,
current content and any attachments. Click **Acknowledge** to confirm you've
read it — the button becomes a green **Acknowledged** badge.
Acknowledgement is **per version**: when a new version is published, the
policy asks for acknowledgement again.

---

## 12. Workflows (personal rulebooks)

Workflows are **documented step-by-step reference plans** — each user's
personal rulebook for how they run their processes. They are documentation,
not automations: there are no approvers or approval inboxes.

### 12.1 My Workflows (employee)

Sidebar: **My Workflows** → `/my-workflows` (available to everyone).

1. Click **New workflow**, give it a **Name** and an **Entity type**
   (General, Employee, Recruitment, Onboarding, Offboarding, Leave, Expense,
   Payroll, Asset, Document, Training, Compliance), click **Create**.
2. Select it and add steps: type a **Step name**, click **Add step**. Steps
   are numbered automatically.
3. Hover a step for controls: **move up / move down** (reorder), **edit**
   (rename), **delete** (remaining steps renumber automatically).
4. The trash next to the workflow name deletes the whole workflow (with a
   confirmation that notes how many steps go with it).

You always own the workflows you create; only you (and workflow managers)
can see them.

### 12.2 Workflows (admin)

Sidebar (Admin View): **Workflows** → `/admin/workflows`. Requires
`workflow.manage`.

The same builder, plus an **Employee** filter to review any person's
workflows ("All employees" or one owner). Admins can edit or delete any
workflow.

---

## 13. Recruitment

Sidebar (Admin View): **Recruitment** → `/admin/recruitment`. Requires
`recruitment.view` (managing requires `recruitment.manage`).

The page is two panels: **openings** on the left, the selected opening's
**candidates** on the right.

**Create an opening:** click **New opening**, pick the **Department**, type
the **Designation** (e.g. "Senior Frontend Engineer"), click **Create**.

**Add a candidate:** click **Add candidate** — **Full name**, **Email**,
optional **Phone**, and optional **Attachments** (resume and documents,
multiple files allowed). The row appears with status **applied**.

**Manage a candidate** (click **Manage** on the row):

- **Status** — move them through the pipeline: `applied → shortlisted →
  interview_scheduled → selected → joined` (or `rejected`).
- **Schedule interview** — pick the **Interview date** and an optional
  **Interviewer**; the status flips to `interview_scheduled` automatically.
  Each interview row then takes feedback: **Rating** (1–5),
  **Recommendation** (Proceed / Hold / Reject) and **Feedback** text —
  click **Save**.
- **Offer flow** — click **Send offer for approval** (offer becomes
  *pending*), then **Approve offer** or **Reject**. Once approved, click
  **Generate offer letter** to download the offer PDF.
- **Documents** — upload more files anytime; **View** opens them via a
  short-lived secure link.
- **Communication checklist** — click **Start checklist** to track documents
  exchanged with the candidate; each item moves through **pending → sent →
  received → verified**.

When the hire joins, set their status to **joined**, then create their
employee account in **Users** (§22.1).

---

## 14. Communication Templates

Sidebar (Admin View): **Communication Templates** → `/admin/onboarding`.
Requires `onboarding.manage`.

A library of reusable letter templates — offer, appointment, joining, NDA,
contract, confidentiality, welcome — that generate personalised PDFs for any
employee. (The joining checklist itself lives in Doc Vault, §15.)

- **Create a template:** click **New template**, choose the **Document
  type**, give it a **Title** and a **Body**. The body supports placeholders:
  `{{full_name}}`, `{{employee_code}}`, `{{date}}`.
- **Generate a letter:** pick the person in the **Generate for** dropdown,
  then click **Generate** on any template — a PDF downloads with the
  placeholders filled in.

---

## 15. Doc Vault & joining checklist

Sidebar (Admin View): **Doc Vault** → `/admin/documents`. Requires
`documents.view` (deleting requires `documents.manage`).

A versioned, access-controlled document repository per employee, plus the
joining checklist.

**Upload a document:** in the top bar choose the **Employee**, a **Category**
(aadhaar, pan, passport, driving_license, resume, offer, appointment,
salary_revision, warning, promotion, experience, relieving), an optional
**Title** (falls back to the filename), pick the **File**, click **Upload**.

**The table** lists the selected employee's documents with Category, Title
and **Version** (uploading again in the same category creates the next
version — all versions stay listed, newest first). **Open** downloads via a
short-lived signed link (files live in a private bucket); the trash icon
permanently deletes a document and its file (confirmed first).

**Joining checklist (right panel):** for a newly joined employee click
**Start onboarding** — a checklist of joining items appears (ID proofs,
bank details, etc.). Move each item through **pending → submitted →
verified** with its dropdown; changes save instantly.

---

## 16. Assets

### 16.1 Asset registry (admin)

Sidebar (Admin View): **Assets** → `/admin/assets`. Requires `assets.view`
(assign/transfer/return/delete require `assets.manage`).

- **Create:** click **New asset** — **Type** (laptop, desktop, mobile, sim,
  id_card, headset, other), **Name**, optional **Serial no** and **Batch
  no**. New assets start **available**.
- **Search** by name, serial or batch number. The table shows each asset's
  Type, Serial no, Batch no, **Status** (available / assigned / retired) and
  current **Assigned to** holder.
- **Manage** an asset:
  - **Assign:** pick an **Employee**, click **Assign**.
  - **Transfer:** with an asset already assigned, pick the new employee and
    click **Transfer** — the old assignment is closed and a new one opened.
  - **Return:** click **Return** — the asset goes back to **available**.
  - Every movement is preserved in **Assignment history** (who, from when,
    to when).
  - **Delete asset** removes the asset and its history after an inline
    *"Yes, delete"* confirmation.

### 16.2 My Assets (employee)

Sidebar: **My Assets** → `/my-assets` (available to everyone).

A read-only list of company assets ever assigned to you: Asset, Type, Serial
no, Batch no, Assigned on, and Status — **with you** (green) or **returned
\<date\>**.

---

## 17. Lifecycle & exit management

Sidebar (Admin View): **Lifecycle** → `/admin/lifecycle`. Requires
`lifecycle.manage`.

Pick the **Employee** at the top; the page shows their career **Timeline**
(left) and **Exit management** (right).

### Timeline

- **Add an event:** choose the **Event type** (joining, confirmation,
  promotion, transfer, department_change, salary_revision, exit), pick the
  **Date**, click **Add**.
- Each event can be **edited** (type, date, optional note) or **deleted**
  individually; **Clear all** wipes the whole timeline (exit records are not
  affected). All destructive actions ask for confirmation.

### Exit management

1. Enter the **Last working day** and click **Start exit**.
2. A clearance checklist appears — click **Mark cleared** on each item
   (HR, IT, Finance, …) until everything shows a green **cleared** badge.
3. Generate the exit documents with one click each: **Experience**,
   **Relieving**, **No-Due** — each downloads a PDF naming the employee and
   last working day.

**Exit document templates** (bottom): create custom templates (types:
experience, relieving, no_due, exit_other) via **New template** — these
support the standard placeholders plus `{{last_working_date}}` — and
**Generate** them for the selected employee.

---

## 18. Training

### 18.1 Training management (admin)

Sidebar (Admin View): **Training** → `/admin/training`. Requires
`training.manage`.

- **Create a module:** click **New module** — **Title** + **Content**
  (instructions, links, material).
- **Attachments:** upload files to the module (**Upload**); trainees view
  them via secure links.
- **Assign:** click **Assign** and tick people from the directory
  (already-assigned people are shown checked and disabled). Click **Assign**.
- **Track:** the **Assignments** list shows each person's live status —
  **assigned** (slate) → **completed** (blue) → **acknowledged** (green).
- The trash icon deletes a module.

### 18.2 My Training (employee)

Sidebar: **My Training** → `/training` (available to everyone).

Each assigned training is a card with the material, its attachments, and one
action based on where you are:

1. **Mark complete** — after you've gone through the material.
2. **Acknowledge** — confirms completion formally.
3. Done — the card shows *"Acknowledged on \<date\>"*.

---

## 19. Helpdesk

Sidebar: **Helpdesk** → `/helpdesk` (everyone; management controls appear
for users with `helpdesk.manage`).

**Raise a ticket (everyone):** at the top of the page choose a **Category**
(it, hr, salary, leave, asset) and **Priority** (low, medium, high), type the
**Subject**, click **Raise**.

**SLA:** every ticket gets a due time from its priority — **high: 4 hours**,
**medium: 24 hours**, **low: 72 hours**. The **SLA** column shows grey **"on
track"**, or a red **"breached"** badge once a ticket is overdue and still
unresolved.

**Ticket handling (admins):** each row gains a status dropdown — **open →
in_progress → resolved → closed** — and an **escalate** button that pins a
red **escalated** badge to the ticket.

You always see your own tickets; admins see everyone's.

---

## 20. Notice Board, Recognition, Visitors & Meetings

### 20.1 Notice Board (announcements)

Sidebar: **Notice Board** → `/announcements` (everyone can read).

A company-wide feed of announcement cards (title, category badge, body,
timestamp). Users with `announcements.manage` see a **Publish** button:
choose a **Category** (holiday, meeting, policy, birthday, news, alert), a
**Title** and **Body**, click **Publish** — everyone sees it instantly.

### 20.2 Recognition & rewards

Sidebar: **Recognition** → `/recognition` (everyone can view the feed).

A feed of recognition cards: employee name, award type badge, points and an
optional note. Users with `recognition.manage` see an **Award** button:
pick the **Employee**, an **Award** (star_performer, employee_of_month,
appreciation), **Points** (default 50), an optional **Note**, click
**Award**.

### 20.3 Visitors

**Employee self-service** — Sidebar: **Visitors & Meetings** → `/visitors`.
Register visitors you're hosting: **Visitor name**, **Company**, **Purpose**,
**Visit date** → **Register**. Each visitor gets an auto-generated pass code;
click **Pass** to download the visitor-pass PDF. You see only your own
visitors.

**Admin** — Sidebar (Admin View): **Visitors & Meetings** →
`/admin/visitors` (requires `visitors.manage`). Register visitors for any
**Host** and see the full visitor log; the same **Pass** button prints the
pass PDF (visitor, company, host, date, pass code).

### 20.4 Meetings

The **Meetings** section appears on both Visitors pages. Anyone can host.

- **Host a meeting:** click **Host a meeting** — **Title**, optional
  **Description** and **Meeting link** (e.g. a video-call URL), **Starts**
  and optional **Ends** times, then tick colleagues under **Invite
  colleagues**. Click **Create meeting**.
- Invitees see the meeting immediately with **Accept** / **Decline** buttons;
  their responses show as colored badges on the meeting card for everyone.
- Hosts can cancel their own meetings (trash icon). Past meetings collapse
  into a **"Past meetings (N)"** section.

---

## 21. Monitoring (opt-in screen capture)

Monitoring is **opt-in and consent-based**. Browsers cannot capture your
screen silently — every capture requires you to approve the browser's
screen-share prompt. (True background monitoring would require a native
desktop agent, which this app doesn't include.)

### Employee — Sidebar: **Monitoring** → `/monitoring`

Click **Capture screenshot**, approve the browser prompt, and a capture is
recorded. Your own captures are listed with **Captured at**, **System**
(browser info) and **Activity**.

### Admin — Sidebar (Admin View): **Monitoring** → `/admin/monitoring` (requires `monitoring.view`)

A report of all captures, filterable by **Period** (Daily / Weekly /
Monthly) and **Employee**. Admins with `monitoring.config` can also set the
**Capture interval** (10/15/20/30 min) — a setting reserved for a future
desktop agent; it does not make the browser capture automatically. Note the
storage caveat: screenshots consume storage quota quickly.

---

## 22. People administration

All four pages live in the Admin View sidebar.

### 22.1 Users

**Users** → `/admin/users`. Viewing requires `users.view`; add/edit/delete
require `users.manage`.

The table lists everyone: Name (+email), Code, Department, Team, Manager,
Roles (badges), Status (**active** / **inactive**).

**Add an employee:** click **Add employee** —

- **Email** and **Temporary password** (share it out-of-band; the app never
  displays credentials afterwards)
- **Full name**, optional **Employee code**
- **Department**, **Team**, **Reporting manager**
- **Roles** (tick any combination)
- **Leave quotas (days / year)** — per leave type, pre-filled with defaults

Click **Create employee**. The new person can sign in immediately and change
their password via **Forgot password?**.

**Edit an employee** (pencil icon): change any of the above, plus:

- **New password** — set one directly (leave blank to keep current)
- **Status** — set **Inactive** to deactivate (keeps the record and history;
  reactivate any time by setting **Active**)
- **Leave quotas** — shows *"Used N this year"* per type as a guide

**Delete an employee** (trash icon): permanently removes the person **and
their login** after confirmation — *"This cannot be undone."* Prefer
deactivation for leavers you may need history for.

### 22.2 Roles & Permissions

**Roles** → `/admin/roles`. Viewing requires `roles.view`; changes require
`roles.manage`.

- Roles are **unlimited and permission-based** — create as many as you need,
  no code required. Click **New role**, give it a **Name** (slug is
  auto-generated) and optional description.
- Select a role to see the full **permission catalog**, grouped by category,
  as checkboxes with descriptions. Tick/untick to grant/revoke — changes
  apply immediately to everyone holding the role.
- Seeded **system** roles (badge "system") cannot be deleted; custom roles
  have a **Delete** button.

### 22.3 Departments & Teams

**Departments & Teams** → `/admin/hierarchy`. Viewing requires
`hierarchy.view`; changes require `hierarchy.manage`.

- **Departments:** click **New**, name it, **Create**. Delete with the trash
  icon.
- **Teams:** click **New**, pick its department, name it. Each team row has
  a **Manager** dropdown — changing it reassigns the team's reporting
  manager instantly.

### 22.4 Audit Log

**Audit Log** → `/admin/audit`. Requires `audit.view`.

An append-only, tamper-evident trail of sensitive changes — the 100 most
recent entries with **When**, **Actor**, **Action** (color-coded insert /
update / delete) and **Entity**. Nothing here can be edited or deleted.

---

## 23. Navigation map

| Module | Employee View | Admin View | Routes |
|---|---|---|---|
| Dashboard | Dashboard | Dashboard | `/` |
| Attendance | My Attendance | Attendance (monitor + settings) | `/attendance`, `/admin/attendance` |
| Planning | Planning | Planning (monitor + unlock) | `/planning`, `/admin/planning` |
| Tasks | Tasks | Tasks (+ Statuses, delete) | `/tasks` |
| Leave | Leave | Leave (approvals + holidays) | `/leave`, `/admin/leave` |
| Salary | Salary* | Salary (+ F&F) | `/salary`, `/admin/salary` |
| Appraisals | Appraisals | Appraisals | `/appraisal`, `/admin/appraisal` |
| Reports | — | Reports (17 reports) | `/admin/reports` |
| Policies | Policies | Policies | `/policies`, `/admin/policies` |
| Workflows | My Workflows | Workflows | `/my-workflows`, `/admin/workflows` |
| Recruitment | — | Recruitment | `/admin/recruitment` |
| Templates | — | Communication Templates | `/admin/onboarding` |
| Documents | — | Doc Vault (+ joining checklist) | `/admin/documents` |
| Assets | My Assets | Assets | `/my-assets`, `/admin/assets` |
| Lifecycle | — | Lifecycle | `/admin/lifecycle` |
| Training | My Training | Training | `/training`, `/admin/training` |
| Helpdesk | Helpdesk | Helpdesk (manage) | `/helpdesk` |
| Notice Board | Notice Board | — (publish via permission) | `/announcements` |
| Recognition | Recognition | Recognition (award) | `/recognition` |
| Visitors | Visitors & Meetings | Visitors & Meetings | `/visitors`, `/admin/visitors` |
| Monitoring | Monitoring | Monitoring (report) | `/monitoring`, `/admin/monitoring` |
| People admin | — | Users, Roles, Departments & Teams, Audit Log | `/admin/users`, `/admin/roles`, `/admin/hierarchy`, `/admin/audit` |

\* Salary is hidden from employees unless an admin grants `salary.view_own`.

---

## 24. Troubleshooting & FAQ

**The health badge says "Backend: offline".**
The app can't reach its database. Check your connection; if it persists,
contact your admin (on a local/dev setup: restart the Supabase stack and the
dev server).

**My punch was rejected with "outside the office radius".**
That's by design — attendance requires you to be physically within the
configured radius (default 50 m) of the office. Move closer and retry. The
distance shown in the punch modal tells you how far away you are.

**My punch-in is locked.**
Your last worked day wasn't fully planned. Open **Planning**, select that
date (the lock banner names it), and add slots until they cover the whole
working window — the lock lifts automatically. In a genuine exception, ask
an admin to unlock you (they must record a remark).

**The camera or location prompt never appears.**
The app must run over HTTPS (or `localhost` in development) for the browser
to allow camera/GPS. Also check the site permissions in your browser
settings. A blocked camera doesn't stop a punch (a placeholder is used), but
location is mandatory.

**I can't see the Salary / Reports / Admin pages.**
Those require specific permissions. If you believe you should have access,
ask an admin to check your roles under **Users** and the role's permissions
under **Roles**.

**I applied for leave but my balance didn't change.**
Balances update only when a request is **approved**. Pending and rejected
requests never consume balance. You can cancel a request while it's pending.

**A policy I already acknowledged is asking again.**
A new version was published. Acknowledgement is per version, so re-read the
updated text and acknowledge again.

**Realtime updates aren't appearing.**
Lists fall back to polling and refresh within ~5–20 seconds even without a
live socket. If a page seems stale beyond that, reload it.

**Who can see my data?**
Access is enforced at the database level. Employees see their own records
(attendance, payslips, documents, tickets, assets, trainings); admins see
what their permissions grant. The **Audit Log** records sensitive changes.
