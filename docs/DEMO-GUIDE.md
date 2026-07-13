# HRMS — Demo & Test Walkthrough Guide

A complete, **step-by-step script** for demonstrating and manually testing every
feature of the HRMS application (Phases 0–19). Follow it top-to-bottom for a full
product tour, or jump to any module section to exercise that feature in isolation.

> This guide describes the **real UI flows** (the same flows the 47 Playwright e2e
> specs automate). Button labels, field names, expected values and navigation
> labels are taken from the actual code.

---

## 0. Before you start

### 0.1 Bring the app up (local)

```bash
npm install                # install deps
npx playwright install chromium   # one-time, only if you also want to run e2e
supabase start             # boot local Postgres/Auth/Storage/Realtime (Docker)
npm run env:local          # write .env.local from `supabase status`
npm run db:reset           # apply migrations + seed reference data
npm run seed               # provision the 4 demo users (prints creds to console)
npm run dev                # http://localhost:5173
```

Open **http://localhost:5173**. You should see the login page and a green
**"Backend: online"** health badge. If it says *offline*, re-run `supabase start`,
then `npm run env:local`, then restart `npm run dev`.

> **HTTPS note:** GPS + camera (Attendance) and screen capture (Monitoring) need a
> secure context. `localhost` counts as secure, so they work in local dev. On a
> deployed instance, the app must be served over HTTPS.

### 0.2 Demo users

`npm run seed` provisions these four accounts (credentials print to the **console
only** — never shown in the UI). All four can sign in immediately.

| Name  | Email                | Password         | Roles                     | Notes |
|-------|----------------------|------------------|---------------------------|-------|
| Sunil | `sunil@hrms.local`   | `Sunil#Demo2026` | Employee **+ Super Admin** | Dual view (Admin ↔ Employee). Engineering / Platform. |
| Riya  | `riya@hrms.local`    | `Riya#Demo2026`  | Employee **+ Super Admin** | Dual view. HR / HR Ops. |
| Aarti | `aarti@hrms.local`   | `Aarti#Demo2026` | Employee                  | Reports to Sunil. Engineering / Platform. |
| Raj   | `raj@hrms.local`     | `Raj#Demo2026`   | Employee                  | Reports to Riya. Sales / Field Sales. |

**Roles in one line:** Super Admins (Sunil, Riya) see everything and can flip
between an **Admin View** and an **Employee View** with the toggle in the top bar.
Plain employees (Aarti, Raj) only get the Employee View and are blocked from every
`/admin/*` route at the UI **and** the database (RLS).

### 0.3 How to drive the demo

- **View toggle** (top-left of the header, Super Admins only): switches the whole
  sidebar between **Admin View** and **Employee View**.
- **Two browsers / two windows** are useful for the realtime and approval demos —
  e.g. an admin in one window, an employee in an incognito window. Look for the 🔴
  live indicator; updates appear **without refreshing**.
- **Sign out** is the top-right button in the header.
- A green/red **health badge** in the header shows backend connectivity.

### 0.4 Suggested demo order

The modules below are ordered as a natural narrative: **identity & access →
daily employee life → manager/HR operations → hire-to-retire lifecycle → support
& engagement → monitoring**. Each section is self-contained, so you can also cherry-pick.

---

## 1. Authentication, RBAC & the dual view

**Goal:** show secure login, permission-based access, and the Super Admin's two views.

### 1.1 Login & role-aware landing
1. Go to the app; you are redirected to **/login**.
2. Confirm the page shows **no credentials anywhere** and a **forgot-password** link.
3. Enter a wrong password → an inline error appears (no crash).
4. Sign in as **`sunil@hrms.local` / `Sunil#Demo2026`** → lands on the **Admin
   dashboard**, with the **Admin / Employee view toggle** visible in the header.
5. Sign out. Sign in as **`aarti@hrms.local` / `Aarti#Demo2026`** → lands on the
   **Employee dashboard**, and there is **no view toggle** (she's employee-only).

### 1.2 The Super Admin dual view (Sunil or Riya)
1. As Sunil, note the rich **Admin View** sidebar (Employees, Roles, Reports, …).
2. Click **Employee View** in the header toggle → the sidebar collapses to the
   self-service set (My Attendance, Tasks, Leave, …); admin-only items disappear.
3. Click **Admin View** to switch back.

### 1.3 RBAC is enforced, not cosmetic (Aarti or Raj)
1. Signed in as Aarti, manually type an admin URL into the address bar:
   `/admin/users`, `/admin/roles`, `/admin/salary`, `/admin/audit`.
2. Each shows the **Forbidden** page. The guard is backed by Row-Level Security at
   the database, so the data is unreachable even outside the UI.

### 1.4 Create a role & assign permissions (Sunil, Admin View → **Roles**)
1. Click **Roles** → **New role**. Name it `QA Reviewer`, click **Create role**.
2. Open the new **QA Reviewer** card, tick the **`reports.view`** permission.
3. **Reload the page** and reopen the card — the permission is still ticked (persisted).
4. Note that seeded **system roles** (e.g. *Employee*) have **no delete button**.
5. Delete **QA Reviewer** via its **Delete** button — the card disappears.

### 1.5 Departments & teams (Sunil → **Departments & Teams**)
1. In **Departments**, click **New**, name it `Finance`, **Create** → appears in the table.
2. In **Teams**, click **New**, pick a department, name it `Treasury`, **Create**.

### 1.6 Assign a role to a person (Sunil → **Employees**)
1. Edit **`raj@hrms.local`** (pencil icon), tick the **Manager** role, **Save changes**.
2. Raj's row now shows a **Manager** badge.

### 1.7 Audit log (Sunil → **Audit Log**)
1. Open **Audit Log** → an append-only table of **When / Actor / Action / Entity**.
2. The role/department/user changes you just made appear here (insert/update/delete,
   colour-coded). Nothing can be edited or removed — it's tamper-evident.

---

## 2. Employee management & lifecycle (no-code people admin)

**User:** Sunil (Admin View → **Employees**). Demonstrates the full add→…→delete loop.

### 2.1 Add an employee
1. Click **Add employee**. Fill: Email `neha@hrms.local`, Temp password
   `Neha#Demo2026`, Name `Neha Test`, Code `EMP900`, Department `Engineering`,
   tick role **Employee**.
2. Click **Create employee** → Neha's row appears within a few seconds (created via
   a secure Edge Function using the Admin API).

### 2.2 Assign → deactivate → reactivate
1. Edit Neha: set **Team** `Platform`, **Manager** `Sunil Sharma`, add role
   **Team Leader**, **Save** → badges update.
2. Edit again, set **Status → inactive**, **Save** → row shows **inactive**.
3. Edit again, set **Status → active**, **Save** → back to **active**.

### 2.3 New hire can actually sign in
1. In an **incognito window**, sign in as **`neha@hrms.local` / `Neha#Demo2026`**
   → reaches the Employee dashboard. (Adding people needs **zero code changes**.)

### 2.4 Delete
1. Back as Sunil, click Neha's **delete** (trash) icon, **confirm** → the login and
   profile are removed; her row disappears.

---

## 3. Attendance — GPS + live selfie + realtime

**Feature highlights:** server-side GPS radius gating (50 m), a live selfie per
punch, automatic full/half/quarter-day classification from *actual hours worked*,
and a realtime admin monitor.

> In a real browser you'll be prompted to allow **location** and **camera**. On
> `localhost` this works; allow both when asked.

### 3.1 Employee punch in/out (Aarti → **My Attendance**)
1. Open **My Attendance** — status reads **"Not started"**.
2. Click **Punch In**. A modal shows the **live camera preview** and your distance:
   **"X m from office (max 50 m)"** — green when inside the radius.
3. Click **Capture & Punch In** → it snaps a selfie, uploads it, records the punch,
   and closes. Status becomes **Present (in progress)**; a punch row with a 📷 appears.
4. Later, the button reads **Punch Out** — click it and **Capture & Punch Out**. The
   day is classified (e.g. **Full Day**) from hours worked, with late/overtime flags.

### 3.2 Out-of-radius rejection (Raj, with location set far from office)
1. As Raj, **Punch In** → the distance shows in **red** (outside 50 m).
2. **Capture & Punch In** → rejected with **"You are outside the office radius.
   Move closer and try again."** No punch is recorded. (The server is authoritative —
   this isn't just a UI check.)

### 3.3 Realtime cross-device monitor (two windows)
1. **Window A — Sunil, Admin View → Attendance:** the **Attendance Monitor** lists
   everyone with Status / Worked / First In / Last Out / Flags and a pulsing 🔴 live dot.
2. **Window B — Raj (incognito) → My Attendance:** punch in.
3. **Window A updates within seconds, no refresh** — Raj's row turns **present** with
   a First-In time.
4. Admins with permission can open **Settings** to adjust the radius and hour thresholds.

---

## 4. Tasks — assignment, status history, realtime

**User:** Aarti (employee) and Sunil (manager). Nav label **Tasks**.

### 4.1 Create a self-task (Aarti → **Tasks**)
1. Click **New task**. Title `Aarti self task`, Priority **Medium**, **Create task**.
2. The task appears with assignee **Aarti** and the first status (e.g. *To Do*).

### 4.2 Change status with tracked remarks
1. On the task row, click **Update**. Set **New status → In Progress**, remarks
   `Kicking off the work`, **Save** → the badge updates.
2. Click the task's **history** (clock) icon → the modal shows **both** entries:
   the *To Do → In Progress* change (with your remark + timestamp) **and** the
   auto-recorded creation entry.

### 4.3 Manager assigns, employee sees it live (two windows)
1. **Window A — Raj → Tasks:** no *"Ship the release"* task yet.
2. **Window B — Sunil → Tasks → New task:** Title `Ship the release`, **Assignee →
   Raj**, **Create task**.
3. **Window A updates within seconds** — the task appears, assigned to Raj.

### 4.4 Editable status master (Sunil → **Tasks → Statuses**)
1. Click **Statuses**, type `Blocked`, **Add** → it joins the list. Seeded statuses
   are marked *system* and can't be deleted; new ones can.
2. Now *Blocked* is selectable when updating any task's status.

---

## 5. Planning & the mandatory-update policy

**Feature highlight:** employees plan their day in **2-hour slots**; the system can
**block Punch Out until the day-end update + next-day plan are submitted**, with an
admin override.

### 5.1 Plan the day with edit history (Aarti → **Planning**)
1. Open **Planning** — a badge reads **"Planning pending"** (amber). Today's slots
   are laid out in a grid (e.g. 09:00–11:00, 11:00–13:00 …).
2. In the first slot, fill Task `Draft the report`, Progress `50`, Challenges
   `Writer unavailable`, Remarks `Need to coordinate`, **Save**.
3. Edit the same slot's task to `Draft the report (v2)`, **Save** again. Click the
   slot's **history** icon → the modal shows the old→new change trail.
4. Fill at least one **Next Day** slot (e.g. `Plan sprint meeting`), **Save**.
5. Click **Submit Day-End Update**, then **Submit Next-Day Plan** → the badge turns
   **"Planning complete"** (green).

### 5.2 Mandatory gate blocks punch-out (Raj)
1. As Raj (punched in, planning not submitted), go to **My Attendance → Punch Out →
   Capture & Punch Out**. It's **rejected**: *"Submit your Day-End Update and
   Next-Day Plan before punching out (or ask an admin to unlock)."*

### 5.3 Two ways to clear the gate
- **Self-clear:** Raj fills + submits today's day-end and next-day plans on
  **Planning**, returns to **My Attendance**, and **Punch Out now succeeds**.
- **Admin override:** Sunil → **Admin View → Planning** (Planning Monitor) → find
  Raj's row → **Unlock**. His status flips to **unlocked** and he can punch out even
  without submitting. The monitor also offers a combined plan view per employee.

---

## 6. Leave management

**Users:** Aarti (apply) + Sunil (approve). Nav label **Leave**. Best shown in two windows.

### 6.1 Apply → live approve → balance updates
1. **Aarti → Leave:** balance cards show *Used X of Y* per type. Click **Apply for
   leave**: Type **Casual**, From `2026-07-06`, To `2026-07-07`, Reason
   `Family event`, **Submit**. A **pending** (2-day) row appears. Leave the tab open.
2. **Sunil → Admin View → Leave** (Approvals): find Aarti's pending Casual row, click
   **Approve**.
3. **Back on Aarti's tab (no refresh):** the row flips to **approved** and the Casual
   balance card increments **Used** by 2 — realtime.

### 6.2 Rejection
1. Aarti applies for 1 day **Sick**. Sunil clicks **Reject** → row turns **rejected**
   and **no balance is consumed**.

### 6.3 Holiday calendar (Sunil → Admin View → Leave)
1. In the **Holiday calendar** section, add `Company Foundation Day` on `2026-09-09`,
   click **Add** → it appears in the holidays table (and feeds day counts).

---

## 7. Salary / payroll

**Feature highlights:** policy-driven, **server-side** computation (Edge Function),
statutory deductions (PF/ESIC/PT/TDS), payslip + Salary-Slip PDF, and **Full & Final
settlement**. Salary is **hidden from employees by default**.

### 7.1 Compute a payslip (Sunil → Admin View → **Salary**)
1. Pick **Employee → Aarti Patel**, **Month → `2026-05`**, click **Compute** (waits a
   few seconds while the Edge Function runs).
2. A payslip card shows the full breakdown. With the seeded inputs the result is
   **Gross 49,600 / Net 48,800** (present/half/quarter/absent days, paid leave, late,
   overtime, planning gaps, base earned, incentives, increments, penalties, and the
   statutory lines PF/ESIC/PT/TDS — all 0 by default in this policy).
3. Click **Download payslip** → a `payslip-2026-05.pdf` downloads.

### 7.2 Statutory deductions payslip (Sunil → Salary)
1. Compute the seeded statutory case (e.g. **Raj**, month `2026-08`) → with PF/ESIC/
   PT/TDS configured, **Net = 20,080**, shown with each deduction line. Download the
   **Salary Slip PDF**.

### 7.3 Base CTC & adjustments (Sunil → Salary)
1. Edit the **Monthly CTC** and **Save**. Add an **Adjustment** (Incentive / Penalty /
   Increment + amount, click **+**) → it lists above the form and feeds the next
   computation.

### 7.4 Full & Final settlement (Sunil → Salary, bottom section)
1. Pick an **Employee** + **Last working day**, click **Compute F&F** → shows Final
   salary, Leave encashment, Dues recovered and **Net payable** (the seeded case nets
   **45,000**). Click **Generate F&F letter** for the PDF.

### 7.5 Salary is locked down for employees (Aarti)
1. As Aarti, try **/salary** and **/admin/salary** → both show **Forbidden**. The data
   is blocked three ways: UI route guard, database RLS, and the Edge Function returns
   **403**. (An admin can explicitly grant `salary.view_own` to expose self-payslips.)

---

## 8. Appraisals

**Feature highlight:** scores are **computed from real data** — attendance, task
completion and planning compliance — into an overall score with **increment/promotion
recommendations**.

### 8.1 Create cycle, add appraisal, compute (Sunil → Admin View → **Appraisals**)
1. **New cycle**: Name `April Review`, Type `monthly`, From `2026-04-01`,
   To `2026-04-30`, **Create** → it appears in the left list; select it.
2. **Add appraisal**: Employee **Raj Singh**, Performance rating `4`, **Add**.
3. Click **Compute** on Raj's row → from the seeded data the scores fill in:
   **Attendance 90 / Tasks 75 / Planning 50 → Overall 71.7**, **Increment +5%**
   (promotion not recommended at this score).

### 8.2 Employee self-view (Raj → **Appraisals**)
1. As Raj, open **Appraisals** → read-only cards per cycle showing the overall score,
   the three component scores, the increment %, plus any promotion badge / manager
   feedback.

---

## 9. Reports & export

**User:** Sunil (Admin View → **Reports**). All data is RLS-gated; export is client-side.

1. Open **Reports** — a tabbed view: **Attendance · Leave · Salary · Task ·
   Appraisal**. Each tab renders a live table built from everything you did above.
2. On any tab, click **Excel** → a non-empty `.xlsx` downloads; click **PDF** → a
   non-empty `.pdf` downloads. Repeat across tabs to show every report exports.
3. Employees hitting `/admin/reports` get **Forbidden**.

---

## 10. Policies & acknowledgement

**Users:** Sunil (author) + Aarti (acknowledge). Nav label **Policies** (both views).

### 10.1 Create & version a policy (Sunil → Admin View → **Policies**)
1. **New policy**: Category `leave`, Title `Leave Policy`, **Create**; open it in the list.
2. **Publish new version**: Content `Apply for leave in advance.`, **Publish** →
   one version row.
3. **Publish new version** again: Content `Apply for leave at least 2 working days in
   advance.`, Change note `Clarified notice period`, **Publish** → now **two** versions
   with a change history.

### 10.2 Employee acknowledges (Aarti → **Policies**)
1. As Aarti, open **Policies** → the **Leave Policy** card. Click **Acknowledge** →
   it becomes a green **Acknowledged** badge (recorded against the published version).

---

## 11. Workflow engine & approvals

**Feature highlight:** a generic, **multi-level, permission-gated** approval engine
with a Builder and an Approvals inbox. (Recruitment offers in §12 ride on this engine.)

### 11.1 Build a 2-level workflow (Sunil → Admin View → **Workflows**)
1. **New workflow**: Name `Expense Approval`, **Create**; select it in the list.
2. Add **Step 1**: Name `Manager`, approver permission **`leave.approve`**, **Add step**.
3. Add **Step 2**: Name `Finance`, approver permission **`salary.manage`**, **Add step**
   → two ordered steps.

### 11.2 Start an instance & route it through (Sunil)
1. In the start form, Instance title `Laptop purchase`, click **Start**.
2. Go to **Approvals** → the instance shows at **Step 1**. Click **Approve** → it
   advances to **Step 2**. Click **Approve** again → status becomes **approved**.
   (Each step only allows approvers holding that step's permission.)

---

## 12. Recruitment & hiring

**User:** Sunil (Admin View → **Recruitment**). Full pipeline opening → joined, with
the **offer routed through the workflow engine** and an **offer-letter PDF**.

1. **New opening**: Title `Senior Engineer`, Designation `SE-3`, **Create**; select it.
2. **Add candidate**: Name `Cara Diaz`, Email `cara@example.com`, **Add** → row shows
   status **applied**, offer **pending**.
3. **Manage** Cara → **Schedule** an interview (date `2026-07-01 10:00`, Interviewer
   = yourself). In the interview row set Rating `5`, Recommendation `Proceed`,
   Feedback `Strong candidate`, **Save**.
4. Set candidate status **selected**, click **Send offer for approval**.
5. Go to **Approvals** → find **"Offer: Cara Diaz"**, click **Approve**.
6. Back in **Recruitment → Manage Cara**: offer badge is now **approved**. Click
   **Generate offer letter** → `offer-cara-diaz.pdf` downloads. Set status **joined**.

---

## 13. Onboarding

**User:** Sunil (Admin View → **Onboarding**). Templates + a 7-item joining checklist.

1. **New template**: Document type `welcome`, Title `Welcome Letter`, Body
   `Welcome {{full_name}} to the team!` (placeholders supported), **Create**.
2. On the right, pick an **employee** and click **Start onboarding** → a checklist of
   exactly **7 items** appears (Aadhaar, PAN, bank, education, previous-company,
   emergency contact, photograph).
3. Change an item's status (e.g. `pending → verified`) → it updates instantly.
4. With an employee selected, click **Generate** on the *Welcome Letter* template →
   a PDF downloads with the name substituted (`Welcome <employee> to the team!`).

---

## 14. Employee documents (versioned + access-controlled)

**User:** Sunil (Admin View → **Documents**).

1. **Upload**: Employee **Raj**, Category **pan**, Title `PAN Card`, choose a file,
   **Upload** → a row appears at **v1**.
2. **Re-upload** the same category (Title `PAN Card (updated)`, a new file) → it's
   auto-versioned to **v2**; both versions are listed.
3. Click **Open** on a row → downloads via a short-lived **signed URL** (private bucket).
4. **Access control:** sign in as **Aarti** and open **Documents** — she sees **only
   her own** documents, never Raj's. Enforced at the storage/RLS layer, not just the UI.

---

## 15. Asset management

**User:** Sunil (Admin View → **Assets**). Lifecycle: create → assign → transfer →
return, with full history preserved.

1. **New asset**: Type `laptop`, Name `MacBook Pro 16`, **Create** → status **available**.
2. **Manage** it → select **Aarti**, click **Assign** → holder becomes **Aarti Patel**;
   a history row is added.
3. Select **Raj**, click **Transfer** → holder becomes **Raj Singh**; a second history
   row is added.
4. Click **Return** → holder becomes **Unassigned**; **both** history rows remain
   (with their date ranges). Status reverts to **available**.

---

## 16. Lifecycle & exit management

**User:** Sunil (Admin View → **Lifecycle**). Career timeline + a 4-item exit clearance
+ exit-document PDFs.

1. Pick **Employee → Raj**. Add an event: type `promotion`, date `2026-03-01`, **Add**
   → it appears on the **timeline**.
2. Enter **Last working day** `2026-09-30`, click **Start exit** → a **4-item clearance
   checklist** appears (e.g. HR, IT, Finance, Admin).
3. Click **Mark cleared** on each of the four items until all are cleared.
4. Generate the exit documents: **Experience**, **Relieving**, **No-Due** → each
   downloads a PDF naming the employee and last working day.

---

## 17. Helpdesk / ticketing

**Feature highlight:** SLA due dates by priority, status workflow, escalation, and an
**SLA-breach** flag. Nav label **Helpdesk** (both views).

1. **Raise (Aarti → Helpdesk):** Category `it`, Priority `medium`, Subject
   `Laptop will not boot`, **Raise** → the ticket appears.
2. **Update (Sunil → Helpdesk):** find the ticket, set **status → in_progress** →
   the badge updates.
3. **Escalate:** click the **escalate** icon on the row → an **escalated** badge appears.
4. **SLA breach:** the seeded overdue ticket (e.g. *"Overdue payslip query"*) shows a
   red **breached** badge — overdue and still unresolved.

---

## 18. Engagement — Notice Board, Recognition, Visitors

### 18.1 Announcements / Notice Board (Sunil → **Notice Board**)
1. Click **Publish**: Category `news`, Title `Quarterly all-hands`, Body
   `Join us Friday at 4pm.`, **Publish** → a card appears in the org-wide feed.
2. **Aarti → Notice Board** (other window): the same announcement is visible — proves
   org-wide distribution.

### 18.2 Recognition & rewards (Sunil → **Recognition**)
1. Click **Award**: Employee `Aarti`, Award type `star_performer`, Points `50`, Note
   `Outstanding quarter`, **Award** → a recognition card appears in the feed.

### 18.3 Visitors & meetings (Sunil → Admin View → **Visitors**)
1. Register: Name `Jane External`, Company `Acme Inc`, Host = a user, Visit date
   `2026-09-15`, **Register** → a row with an auto-generated **pass code** appears.
2. Click **Pass** on the row → a **visitor-pass PDF** downloads (name, company, host,
   date, pass code).

---

## 19. Employee monitoring (opt-in, feasibility-honest)

**Feature highlight:** opt-in, **consent-based** screen capture — and an explicit,
honest note that browsers **cannot** capture silently in the background (that needs a
separate native desktop agent, out of scope).

### 19.1 Employee capture (Aarti → **Monitoring**)
1. Read the **limitation banner**: capture is opt-in and consent-gated each time.
2. Click **Capture screenshot** → the browser shows the native screen-share consent
   prompt; on grant, a capture row is recorded (Captured-at, System/OS, Activity).

### 19.2 Admin report (Sunil → Admin View → **Monitoring**)
1. The report page repeats the limitation note (plus a storage-cost caveat) and offers
   **Period** (Daily/Weekly/Monthly), **Employee** filter, and a future-agent
   **capture interval** (10/15/20/30 min).
2. The captures you took appear in the report table, filterable by period and employee.

---

## 20. Quick smoke checklist

A 5-minute confidence pass before a demo:

- [ ] App loads; health badge **online**; login rejects a bad password.
- [ ] Sunil logs in → Admin View; toggle to Employee View and back.
- [ ] Aarti is **Forbidden** on `/admin/users`.
- [ ] Aarti punches in (selfie + green radius); Sunil's monitor updates live.
- [ ] Aarti creates a task and changes its status; history shows 2 entries.
- [ ] Aarti applies for leave; Sunil approves; balance updates live.
- [ ] Sunil computes Aarti's `2026-05` salary → **Net 48,800**; downloads payslip PDF.
- [ ] Sunil computes Raj's `April Review` appraisal → **Overall 71.7 / +5%**.
- [ ] Reports tab exports a non-empty Excel and PDF.
- [ ] Workflow `Expense Approval` routes through both steps to **approved**.

---

## 21. Troubleshooting

| Symptom | Fix |
|---|---|
| Health badge **offline** | `supabase start` → `npm run env:local` → restart `npm run dev`. |
| Can't log in / users missing | Re-run `npm run seed` (re-prints credentials to the console). |
| Camera/GPS blocked | Use `localhost` (secure context) and **allow** the browser prompts. Outside-radius punches are *expected* to fail. |
| Demo data drifted | `npm run db:reset && npm run seed` for a clean, deterministic state. |
| Edge Function 404 (Salary/F&F/employee add) | `supabase stop && supabase start` so the edge runtime reloads functions. |
| Realtime not updating | Confirm both windows are signed in; a polling fallback updates within ~15–20 s if the socket is unavailable. |

---

### Appendix — navigation map

| Module | Employee View | Admin View | Route(s) |
|---|---|---|---|
| Dashboard | Dashboard | Dashboard | `/` |
| Attendance | My Attendance | Attendance (monitor) | `/attendance`, `/admin/attendance` |
| Tasks | Tasks | Tasks (+ Statuses) | `/tasks` |
| Planning | Planning | Planning (monitor) | `/planning`, `/admin/planning` |
| Leave | Leave | Leave (approvals + holidays) | `/leave`, `/admin/leave` |
| Salary | Salary* | Salary (+ F&F) | `/salary`, `/admin/salary` |
| Appraisals | Appraisals | Appraisals | `/appraisal`, `/admin/appraisal` |
| Reports | — | Reports | `/admin/reports` |
| Policies | Policies | Policies | `/policies`, `/admin/policies` |
| Workflows | — | Workflows | `/admin/workflows` |
| Approvals | Approvals | Approvals | `/approvals` |
| Recruitment | — | Recruitment | `/admin/recruitment` |
| Onboarding | — | Onboarding | `/admin/onboarding` |
| Documents | — | Documents | `/admin/documents` |
| Assets | — | Assets | `/admin/assets` |
| Lifecycle | — | Lifecycle | `/admin/lifecycle` |
| Helpdesk | Helpdesk | Helpdesk | `/helpdesk` |
| Engagement | Notice Board, Recognition | Visitors | `/announcements`, `/recognition`, `/admin/visitors` |
| Monitoring | Monitoring | Monitoring (report) | `/monitoring`, `/admin/monitoring` |
| People admin | — | Employees, Roles, Departments & Teams, Audit Log | `/admin/users`, `/admin/roles`, `/admin/hierarchy`, `/admin/audit` |

\* Salary is hidden from employees by default; visible only with an explicit `salary.view_own` grant.
</content>
</invoke>
