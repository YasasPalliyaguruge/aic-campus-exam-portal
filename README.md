this is out intende app: A comprehensive, web-based assessment solution designed to facilitate secure, remote examinations. The platform features a modern, high-fidelity frontend and a robust backend architecture. It is divided into two distinct portals: a Management Dashboard for Administrators and Lecturers, and a locked-down Secure Exam Environment for Students.

2. User Roles & Permissions

Administrator (Superuser): Has global access to the system. Responsible for infrastructure management, including the creation of academic programs, modules, user accounts, and high-level exam oversight.

Lecturer (Collaborator): Once assigned to specific programs or modules, they can author exams, schedule sessions, monitor live exams, and grade student submissions.

Student (Examinee): Restricted access users. Can only log in to take scheduled exams within a secured interface.

3. Functional Modules (Management Dashboard)

This dashboard is accessible only to Admins and Lecturers.

A. Academic Hierarchy Management

Program Administration: Capabilities to create, edit, and delete academic programs (e.g., "Computer Science B.Sc").

Module Management: Manage specific courses or modules within programs.

Collaborator Assignment: Assign Lecturers to specific programs, granting them scoped privileges to manage content within those areas.

Curriculum Overview: A hierarchical view of all active programs and their associated modules.

B. Student Registry & Enrollment

User Database: Centralized management to create, edit, and delete student profiles.

Cohort Assignment: Enroll students into specific academic programs.

Exam Eligibility: Assign enrolled students to specific exam sessions.

Status Tracking: Visual indicators of student enrollment status and active/inactive states.

C. Exam Authoring Suite

Metadata Configuration: Define exam titles, strict duration timers, and pass/fail thresholds.

Diverse Question Bank: Support for multiple formats:

Multiple Choice (Single Select)

Multiple Choice (Multi-Select)

True/False

Short Answer

Essay/Long Text

Security & Randomization: Options to enable question shuffling (randomization) per student and configure sensitivity thresholds for tab-switching violations.

Lifecycle Management: Save exams as "Drafts" for collaboration or "Publish" them for scheduling.

D. Scheduling & Credential Distribution

Session Management: Schedule published exams for specific modules with defined activation windows (Start Date/Time to End Date/Time).

Secure Access Logic: Automatically generate unique, one-time passwords (OTP) or access tokens for every enrolled student.

Automated Dispatch: System-triggered emails sending access credentials and instructions to students.

Roster View: Monitor the list of scheduled exams and current enrollment counts.

E. Live Proctoring Command Center

Real-Time Surveillance: Grid view displaying live, low-latency video streams from every active student's webcam (ephemeral streaming; no video storage required).

Violation Telemetry: Automated alerting system for integrity breaches, including:

Browser tab switching.

Exiting fullscreen mode.

Status Monitoring: Real-time tracking of exam progress, remaining time, and connection status for each candidate.

Incident Logging: Per-student counters for detected violations to assist in academic integrity reviews.

F. Evaluation & Analytics

Submission Review: Interface for Lecturers/Admins to review individual student answers.

Manual Grading: Input fields for grading essay/short-answer questions and overriding auto-graded marks if necessary.

Audit Trails: Detailed logs of session metadata (Login time, Submission time, Duration) and a record of all security violations.

Reporting: Export functionality to generate result summaries for entire cohorts.

4. Functional Modules (Student Exam Interface)

This interface is isolated from the main dashboard to prevent unauthorized navigation.

A. Authentication & Onboarding

Credential Login: Entry permitted only via the unique secure password emailed to the student.

Lobby: Display of exam instructions, rules, and a countdown to the start time.

B. Secure Examination Environment

Locked-Down UI: The interface restricts students strictly to the exam questions. No access to dashboard features (UserProfile, Home, etc.) is permitted.

Fullscreen Enforcement: The application forces fullscreen mode upon entry. Escaping fullscreen triggers an immediate warning and logs a violation.

Question Navigation: Options for sequential (one-way) or navigable (back-and-forth) question flow based on exam settings.

Media Streaming: Background process that captures and streams the webcam feed to the Proctoring Dashboard without local recording.

Submission Logic: Auto-submit functionality when the timer expires, or manual submission upon completion.

5. Non-Functional Requirements

UI/UX Design: A modern, clean, and intuitive interface