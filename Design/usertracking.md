4. User Tracking Without Accounts
On first visit, generate a UUID and store it in localStorage. This acts as the anonymous user ID. You'll track:

Whether they've played today's daily puzzle (store date + UUID in DB or just localStorage)
Their streak (consecutive days played)
Past scores per game type

You can optionally offer a "save progress" feature later by letting them link an email to their UUID, without requiring a full account at launch.