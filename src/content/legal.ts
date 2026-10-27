// DRAFT policy content. Nothing here is legal advice. Items in [DRNK TO PROVIDE: ...] are deliberately left blank:
// legal entity details, addresses, licences, officers and commitments must come from DRNK and be reviewed by qualified Indian counsel.

export type LegalSection = { heading: string; body: string[] };
export type LegalPage = { slug: string; title: string; summary: string; sections: LegalSection[] };

const TBD = (what: string) => `[DRNK TO PROVIDE: ${what}]`;

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "The rules for using DRNK.",
    sections: [
      { heading: "Who we are", body: [`${TBD("registered legal entity name, CIN/registration number, registered office address")}`] },
      { heading: "Using DRNK", body: ["You log in with a mobile number verified by a one-time code. You are responsible for activity on your account.", "DRNK lists venues, events and talent in Bengaluru. Listings are provided by venues and hosts; DRNK shows what they have submitted and approved."] },
      { heading: "Alcohol", body: ["You must be of legal drinking age in Karnataka to purchase or consume alcohol. Online ordering of alcohol is not available in this version.", `${TBD("age policy, applicable excise rules and venue licence statement, reviewed by counsel")}`] },
      { heading: "Bookings and payments", body: ["Prices and availability are set by the server at the time you book. A ticket booking is held for a limited time while payment completes and is confirmed only after the payment provider confirms payment.", "See the Payment Terms and the Refund and Cancellation Policy."] },
      { heading: "Liability, governing law and disputes", body: [`${TBD("limitation of liability, governing law, jurisdiction and dispute-resolution wording")}`] },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What personal data DRNK handles and why.",
    sections: [
      { heading: "What we collect", body: ["Mobile number (to log you in), optional name and email, reservations, orders, event bookings and tickets, support requests, consent records, and payment references returned by our payment provider.", "We do not store card numbers or CVV. Card details are entered with the payment provider, not on DRNK."] },
      { heading: "Why we use it", body: ["To verify your identity, run your bookings and orders, provide support, prevent abuse, and keep audit records of sensitive actions."] },
      { heading: "Cookies", body: ["We use one session cookie to keep you logged in. See the Cookie and Tracking Notice."] },
      { heading: "Your rights", body: ["You can request a copy of your data or deletion of your account from your account page. See Privacy and Data Rights Requests."] },
      { heading: "Details that need legal input", body: [TBD("data fiduciary identity, purposes and retention periods, processors and cross-border transfers, children's data position, DPDP Act 2023 compliance review")] },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie and Tracking Notice",
    summary: "The cookies DRNK sets.",
    sections: [
      { heading: "Cookies in use", body: ["drnk_session: keeps you logged in. It is HttpOnly (not readable by page scripts), SameSite=Lax, and expires when you log out or after its lifetime ends."] },
      { heading: "Analytics and advertising", body: ["No analytics or advertising trackers are included in this version.", TBD("update this notice before adding any analytics, advertising or third-party scripts")] },
    ],
  },
  {
    slug: "refunds",
    title: "Refund and Cancellation Policy",
    summary: "When bookings can be cancelled and refunded.",
    sections: [
      { heading: "Unpaid bookings", body: ["You can cancel an unpaid ticket booking at any time. Held tickets are released automatically if payment is not completed in time."] },
      { heading: "Paid bookings", body: [TBD("refund windows, per-event host policies, fees retained, timelines, and the process for cancelled or rescheduled events")] },
      { heading: "Payments that cannot be matched to a booking", body: ["If a payment is captured after your hold expired, we flag it for refund rather than confirming the booking. The refund process and timeline are to be confirmed with DRNK and the payment provider."] },
    ],
  },
  {
    slug: "payment-terms",
    title: "Payment Terms",
    summary: "How payments work.",
    sections: [
      { heading: "How you pay", body: ["Payments are processed by our payment provider. Amounts are calculated by DRNK's server from the listed ticket prices; they cannot be changed from your browser."] },
      { heading: "Confirmation", body: ["A booking is confirmed only when the provider's signed confirmation reaches DRNK, not when your browser returns from checkout."] },
      { heading: "Provider and fees", body: [TBD("payment provider legal name, applicable taxes (GST), convenience fees, settlement terms")] },
    ],
  },
  {
    slug: "merchant-terms",
    title: "Merchant Terms",
    summary: "Terms for venues listing on DRNK.",
    sections: [
      { heading: "Applying", body: ["Venues apply through their account. A venue appears publicly only after DRNK approves it. DRNK can suspend a listing."] },
      { heading: "Your responsibilities", body: ["Keep menus, prices, hours and availability accurate. Hold all licences required to serve food and alcohol.", TBD("commission, settlement schedule, licence-verification requirements, indemnities, termination")] },
    ],
  },
  {
    slug: "host-talent-terms",
    title: "Event Host and Talent Terms",
    summary: "Terms for event hosts and performers.",
    sections: [
      { heading: "Events", body: ["Events are created by approved venues and appear publicly after DRNK approval. Ticket capacity is enforced by DRNK and cannot be exceeded."] },
      { heading: "Talent", body: ["Talent profiles appear after approval. Enquiries are messages to the talent; DRNK does not guarantee a booking, fee or availability.", TBD("fees, contracts, cancellation, content licences and conduct rules")] },
    ],
  },
  {
    slug: "rewards-terms",
    title: "Loyalty and Rewards Terms",
    summary: "How DRNK Points and Alcometer credits work.",
    sections: [
      { heading: "What exists today", body: ["DRNK Points and Alcometer credits are tracked in separate, append-only ledgers. They are not money, are not transferable, and cannot be withdrawn.", "Membership tiers are Silver, Gold and Black."] },
      { heading: "Rates and rules", body: [TBD("approved earning rates, tier thresholds and multipliers, redemption options, expiry rules, and what Alcometer credits can be used for")] },
    ],
  },
  {
    slug: "grievance",
    title: "Grievance and Contact Information",
    summary: "How to reach DRNK and escalate a complaint.",
    sections: [
      { heading: "Support", body: ["Raise a support request from your account page. Requests are visible to DRNK's support team."] },
      { heading: "Grievance officer", body: [TBD("grievance officer name, designation, postal address, email, response timelines as required under Indian law")] },
    ],
  },
  {
    slug: "about",
    title: "About DRNK",
    summary: "What DRNK is.",
    sections: [
      { heading: "DRNK", body: ["DRNK helps people in Bengaluru find restaurants, pubs and microbreweries, book tables and event tickets, and discover DJs, bands and other hospitality talent.", TBD("company story, team and contact details")] },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility Statement",
    summary: "Our accessibility approach.",
    sections: [
      { heading: "Our approach", body: ["DRNK aims for pages that work with keyboards, show visible focus, respect reduced-motion settings and adapt to small screens."] },
      { heading: "Status", body: ["An independent accessibility audit has not yet been done.", TBD("target standard (e.g. WCAG 2.2 AA), audit results, and an accessibility contact")] },
    ],
  },
  {
    slug: "data-requests",
    title: "Privacy and Data Rights Requests",
    summary: "Ask for your data or ask us to delete your account.",
    sections: [
      { heading: "How to ask", body: ["Log in and open your account page. Choose \"Request a copy of my data\" or \"Request account deletion\"."] },
      { heading: "What happens next", body: ["Requests are recorded and handled by DRNK's team. Some records (for example payment and audit records) may need to be retained.", TBD("response timelines, identity verification steps, legally required retention periods")] },
    ],
  },
];

export const legalBySlug = (slug: string) => LEGAL_PAGES.find((p) => p.slug === slug);
