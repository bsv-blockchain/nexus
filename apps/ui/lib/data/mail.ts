/**
 * table: mail_messages — placeholder inbox for the Mail app.
 */
import type { MailMessage } from "./types";

export const mailMessages: MailMessage[] = [
  {
    id: "mail-william",
    from: "William Smith",
    fromEmail: "williamsmith@example.com",
    subject: "Meeting Tomorrow",
    preview:
      "Hi, let's have a meeting tomorrow to discuss the project. I've been reviewing the project details and have some ideas I'd like to share. It's crucial that we align on our next steps to ensure the project's success. Please come prepared with any questions or insights you may have.",
    receivedAt: "2026-07-06T08:12:00.000Z",
    read: false,
    tags: ["meeting", "work", "important"],
  },
  {
    id: "mail-alice",
    from: "Alice Smith",
    fromEmail: "alicesmith@example.com",
    subject: "Re: Project Update",
    preview:
      "Thank you for the project update. It looks great! I've gone through the report, and the progress is impressive. The team has done a fantastic job, and I appreciate the hard work everyone has put in. I have a few minor suggestions that I'll include in the attached document.",
    receivedAt: "2026-07-05T14:40:00.000Z",
    read: true,
    tags: ["work", "important"],
    payment: {
      amountSatoshis: 10_000_000,
      direction: "received",
      memo: "Milestone 2 payment",
    },
  },
  {
    id: "mail-bob",
    from: "Bob Johnson",
    fromEmail: "bobjohnson@example.com",
    subject: "Weekend Plans",
    preview:
      "Any plans for the weekend? I was thinking of going hiking in the nearby mountains. It's been a while since we had some outdoor fun. If you're interested, let me know, and we can plan the details. It'll be a great way to unwind and enjoy nature.",
    receivedAt: "2026-07-04T18:05:00.000Z",
    read: true,
    tags: ["personal"],
  },
  {
    id: "mail-emily",
    from: "Emily Davis",
    fromEmail: "emilydavis@example.com",
    subject: "Re: Question about Budget",
    preview:
      "I have a question about the budget for the upcoming project. It seems like there's a discrepancy in the allocation of resources. I've reviewed the budget report and identified a few areas where we might be able to optimize our spending without compromising quality.",
    receivedAt: "2026-07-03T11:22:00.000Z",
    read: false,
    tags: ["work", "budget"],
    payment: {
      amountSatoshis: 5_000_000,
      direction: "received",
      memo: "Budget top-up",
    },
  },
  {
    id: "mail-michael",
    from: "Michael Wilson",
    fromEmail: "michaelwilson@example.com",
    subject: "Important Announcement",
    preview:
      "I have an important announcement to make during our team meeting. It pertains to a strategic shift in our approach to the upcoming product launch. We've received valuable feedback from our beta testers, and I believe it's time to make some adjustments.",
    receivedAt: "2026-07-02T09:15:00.000Z",
    read: false,
    tags: ["meeting", "work", "important"],
  },
  {
    id: "mail-sarah",
    from: "Sarah Brown",
    fromEmail: "sarahbrown@example.com",
    subject: "Re: Feedback on Proposal",
    preview:
      "Thank you for your feedback on the proposal. It looks great! I'm pleased to hear that you found it promising. The team worked diligently to address all the key points you raised, and I believe we now have a strong foundation for the project.",
    receivedAt: "2026-07-01T16:48:00.000Z",
    read: true,
    tags: ["work"],
  },
  {
    id: "mail-david",
    from: "David Lee",
    fromEmail: "davidlee@example.com",
    subject: "New Project Idea",
    preview:
      "I have an exciting new project idea to discuss with you. It involves expanding our services to target a niche market that has shown considerable growth in recent months. I've prepared a detailed proposal outlining the potential benefits and the strategy for execution.",
    receivedAt: "2026-06-30T13:30:00.000Z",
    read: false,
    tags: ["meeting", "work", "important"],
  },
  {
    id: "mail-olivia",
    from: "Olivia Wilson",
    fromEmail: "oliviawilson@example.com",
    subject: "Vacation Plans",
    preview:
      "Let's plan our vacation for next month. What do you think? I've been thinking of visiting a tropical paradise, and I've put together some destination options. I believe it's time for us to unwind and recharge.",
    receivedAt: "2026-06-28T20:10:00.000Z",
    read: true,
    tags: ["personal"],
  },
  {
    id: "mail-james",
    from: "James Martin",
    fromEmail: "jamesmartin@example.com",
    subject: "Re: Conference Registration",
    preview:
      "I've completed the registration for the conference next month. The event promises to be a great networking opportunity, and I'm looking forward to attending the various sessions and connecting with industry experts.",
    receivedAt: "2026-06-27T10:00:00.000Z",
    read: true,
    tags: ["work", "conference"],
    payment: {
      amountSatoshis: 2_000_000,
      direction: "received",
      memo: "Ticket reimbursement",
    },
  },
  {
    id: "mail-sophia",
    from: "Sophia White",
    fromEmail: "sophiawhite@example.com",
    subject: "Team Dinner",
    preview:
      "Let's have a team dinner next week to celebrate our success. We've achieved some significant milestones, and it's time to acknowledge our hard work and dedication. I've made reservations at a lovely restaurant.",
    receivedAt: "2026-06-25T19:00:00.000Z",
    read: false,
    tags: ["meeting", "work"],
  },
];
