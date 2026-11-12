# Phase 3 manual test checklist

Run backend and frontend as described in README.md. Sign in with your existing user.

- [ ] Module 13: Add a meal; verify calories and macros in nutrition summary; delete it.
- [ ] Module 14: Add 250 ml water; verify total/progress; delete the entry.
- [ ] Module 15: Load recommendations; verify suggestions are returned for your goals/history.
- [ ] Module 16: Start timer, wait at least 60 seconds, stop it; verify a workout is saved.
- [ ] Module 17: Check provider status; submit a manual activity import; verify it appears in history.
- [ ] Module 18: Load analytics overview and 30-day trend chart.
- [ ] Module 19: Create a reminder one minute in the past or shortly ahead; call check-due; verify a notification appears.
- [ ] Confirm records are scoped to the logged-in user by testing with a second account.
- [ ] Restart backend and verify saved records remain.

Note: Google Fit/Apple Health live OAuth and unattended reminder scheduling are not configured in this starter implementation.
