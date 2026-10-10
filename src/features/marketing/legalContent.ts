export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};
// Do not mark these documents final until the operator confirms the items in LEGAL_REVIEW.md.
export const legalStatus = { updated: "October 9, 2026", final: false };
export const privacySections: LegalSection[] = [
  {
    id: "scope",
    title: "Who this notice covers",
    paragraphs: [
      "This notice describes the Revbaze website, business workspace, public review cards, and contact form. It covers business account holders, people visiting a review card, and people contacting us.",
      "Revbaze operates from the Philippines and serves customers internationally. The business name supplied by the operator is Revbaze Inc.; company registration is planned, and the service is currently individually operated. The business address and dedicated privacy contact remain to be confirmed. Use our Contact page for privacy enquiries. This document is a draft based on the current product implementation.",
      "A business using Revbaze chooses the information displayed on its review card and the external destinations it links to. That business is responsible for its own customer communications and applicable privacy obligations. Revbaze’s role in processing business data must be confirmed in the operator’s final policies and any required data-processing agreement.",
    ],
  },
  {
    id: "information",
    title: "Information we collect",
    paragraphs: [
      "We receive information you provide to create an account, operate your workspace, purchase a plan, or contact us. We also record limited interactions with published review cards.",
    ],
    bullets: [
      "Account information: email, authentication information managed by Supabase, optional profile name and image, account preferences, and selected plan.",
      "Business and card information: business identity and branding, category and website where supplied, card names and public slugs, invitation text, appearance settings, platform URLs, publication settings, and onboarding drafts.",
      "Workspace records: ownership or membership, changes to business content, plan status, saved integration destinations and selected event types.",
      "Review-card activity: page views and outbound clicks, event time, relevant card and destination, referrer hostname, a supplied sharing-source tag, and a business-scoped browser identifier.",
      "Billing records: Stripe customer and subscription identifiers, checkout and subscription state, billing period end, cancellation state, and processed billing-event identifiers.",
      "Contact information: your name, email, selected topic, message, submission time, and rate-limit records. Contact abuse prevention uses a hashed source address rather than retaining a raw IP address in the contact tables.",
    ],
  },
  {
    id: "purposes",
    title: "How we use information",
    paragraphs: [
      "We use account and workspace information to authenticate you, save your work, publish the cards you activate, apply access permissions and plan limits, and provide your selected features.",
      "We use review-card activity to report visits, outbound clicks, traffic sources, and browser-based visitor counts to the business that owns the card. These metrics do not identify verified individual people or prove that a review was posted.",
      "We use billing records to reconcile subscription access with Stripe. We use contact submissions to receive and respond to enquiries, and rate-limit records to reduce repeated or abusive submissions. The current contact form saves messages to a private inbox; it does not automatically email them.",
      "The app currently stores notification preferences, but does not implement product or activity notification delivery. The final operator policy must identify the legal bases relied on for processing in each applicable jurisdiction.",
    ],
  },
  {
    id: "public-information",
    title: "What is public",
    paragraphs: [
      "An active, published review card is available to anyone who has or discovers its URL. Its business identity, invitation text, enabled review destinations, and selected branding are intended for public display. Deactivating a card prevents normal public-card access, but does not recall screenshots, printed QR codes, or copies already shared.",
      "Business logos, QR logo assets, and profile images are uploaded to publicly readable storage. Anyone with an asset URL may be able to access it, including after a card is paused. Do not upload confidential images or material you do not have permission to publish.",
      "Onboarding drafts, contact messages, billing tables, and private workspace records are not intended for public access. Authorized workspace members may see business records and analytics according to their access permissions.",
    ],
  },
  {
    id: "browser-storage",
    title: "Browser storage and visitor analytics",
    paragraphs: [
      "The app uses browser storage for sign-in sessions, theme and display preferences, profile preferences, selected business, analytics timezone, QR design settings, and local demonstration data when cloud storage is not configured. A pending account-confirmation email may be kept in session storage.",
      "On a published review card, Revbaze generates a random browser identifier and stores it locally. The event endpoint transforms it into a business-scoped identifier before saving analytics. It remains pseudonymous information, not a guarantee of anonymity. If local storage is unavailable, the app uses a temporary in-memory identifier.",
      "The random visitor identifier has no built-in browser expiry. You can clear site storage through your browser settings; doing so may sign you out, remove local preferences, and cause later visits to be counted as a different browser. Clearing browser data does not delete records already saved on the server.",
      "The current app does not provide a visitor tracking opt-out or consent management panel. Whether such controls are required must be assessed before launch in the regions served. No advertising pixels or data-sale mechanism were found in the audited application code.",
    ],
  },
  {
    id: "providers",
    title: "Service providers and external destinations",
    paragraphs: [
      "Supabase provides authentication, database storage, public image storage, and server functions. Stripe provides hosted checkout and subscription management. Payment details entered in Stripe’s hosted screens are handled by Stripe; the Revbaze database stores subscription identifiers and state rather than full payment-card details.",
      "The site loads fonts from Google Fonts. Browser requests to font services, hosting infrastructure, and other service providers can include network information such as an IP address and user agent. Infrastructure logging and provider retention settings are separate from the application’s analytics tables.",
      "When you follow a review-platform link, that external platform processes information under its own policies. Revbaze does not collect the review text or rating you submit there through the current review-card implementation.",
      "Integration setup stores the destination URL and selected event types, but automatic event delivery is not enabled by this implementation. Do not treat a saved connection as an active data-sharing workflow.",
      "Service providers may process information in different countries. The operator must confirm hosting locations, contractual safeguards, and any legally required international-transfer information before this notice is finalized.",
    ],
  },
  {
    id: "retention",
    title: "How long information is kept",
    paragraphs: [
      "Growth analytics expose activity within the preceding 12 months and Pro within the preceding 24 months. Free Overview exposes daily totals within the preceding 180 days. These are access windows, not automatic deletion schedules: older underlying event records may remain in the database.",
      "Downgrading a plan preserves saved businesses, cards, settings, and destinations while restricting access to items above the new limits. Cancellation does not automatically erase account information or saved workspace content.",
      "Contact rate-limit records older than two days are cleaned during a successful submission; cleanup is not a scheduled expiry job. Contact messages currently have no automatic deletion schedule. Public image uploads are not automatically removed when a logo is replaced or a card is deleted.",
      "The selected policy is to retain inactive-account data for no more than two years of inactivity. The definition of inactivity, how it is measured, and the deletion process still require implementation before this deadline can be enforced. Records required for legal, tax, payment-dispute, or security obligations may need different handling. Contact-message retention and provider log/backup schedules still need confirmation. The current app does not automatically delete inactive accounts after two years.",
    ],
  },
  {
    id: "choices",
    title: "Access, correction, and deletion requests",
    paragraphs: [
      "You can edit your profile and business content in the workspace. Settings → Data lets you download the current workspace’s business, cards, links, and loaded activity. This is not a complete export of all account information, billing records, contact submissions, or provider logs.",
      "You can delete cards and platform links using their workspace controls. The current dashboard has no self-service account-deletion control. Removing a database record does not necessarily remove associated public images, Stripe records, backups, or legal recordkeeping obligations.",
      "Use Contact to request access, correction, deletion, or to raise a privacy concern. Identify the relevant account or card without sending passwords or full payment details. Identity verification may be needed before private information can be disclosed or changed.",
      "Your rights, any restrictions on them, and the relevant complaint authority depend on applicable law. The final notice must identify the responsible operator and the process for responding to those requests.",
    ],
  },
  {
    id: "security",
    title: "Security and limitations",
    paragraphs: [
      "The implementation uses authenticated workspace permissions, row-level database access controls, server-side validation, private billing and contact tables, verified Stripe webhooks, and submission limits. Public review cards intentionally expose a limited public projection of card content.",
      "These measures reduce risk but do not guarantee absolute security. Keep your login credentials private, use permitted workspace roles carefully, and avoid putting confidential information in public card content, asset uploads, URLs, or contact messages.",
    ],
  },
  {
    id: "updates",
    title: "Updates and contact",
    paragraphs: [
      "This draft was reviewed against the application on October 9, 2026. If the product’s data practices change, this notice should be updated with an appropriate date and any required notice to affected people.",
      "Send privacy enquiries through the Contact page. The business is identified as Revbaze Inc., operating from the Philippines with company registration planned. A formal privacy contact and business address will be added when confirmed.",
    ],
  },
];
export const termsSections: LegalSection[] = [
  {
    id: "service",
    title: "About the service and these terms",
    paragraphs: [
      "Revbaze provides a workspace for creating branded review cards, organizing review destinations, generating QR codes, and viewing activity analytics. Customers leave reviews on the external platforms linked from a card, not in Revbaze itself.",
      "These terms are a draft for review. Revbaze operates from the Philippines and serves customers internationally under the supplied business name Revbaze Inc. Company registration is planned; the service is currently individually operated. The business address, applicable-law provisions, and final contractual provisions still need confirmation. This page must not be treated as a finalized agreement until those details are approved.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and business authority",
    paragraphs: [
      "You must be at least 18 years old, legally able to enter into an agreement, and authorized to manage the business information, branding, and review destinations you publish. Provide accurate information and protect your sign-in credentials.",
      "Use workspace access only for businesses you are authorized to manage. Do not access another account, impersonate a business, share credentials to evade plan limits, or misrepresent the source of a review invitation.",
    ],
  },
  {
    id: "content",
    title: "Your content and public cards",
    paragraphs: [
      "You retain your rights in the business content you provide. You must have permission to use uploaded images, names, logos, and other material. Operating your card requires Revbaze and its providers to store, process, and display that material for the features you use.",
      "You are responsible for the accuracy of card text and destination URLs. Published cards and public asset URLs can be viewed or shared by others. Do not publish confidential information, unlawful material, or personal data you are not entitled to disclose.",
      "Test your public link and downloaded QR code before sharing them. Changing a card’s slug can break previously shared links and printed QR destinations. Pausing or deleting a card does not recall printed or copied material.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Responsible use",
    paragraphs: [
      "Use the service to invite honest, optional customer feedback. Offer consistent review choices rather than routing customers according to whether their experience was positive.",
    ],
    bullets: [
      "Do not create fake reviews, impersonate reviewers, harass customers, or mislead people about ratings or review completion.",
      "Do not use the service for phishing, malware, unlawful activity, unsolicited bulk messaging, or infringement of others’ rights.",
      "Do not bypass ownership checks, access controls, rate limits, subscription restrictions.",
      "Do not tamper with analytics, submit fabricated activity, or disrupt the service or connected providers.",
      "Follow the policies of the external review platforms and any laws applicable to your business’s communications.",
    ],
  },
  {
    id: "plans",
    title: "Plans and feature access",
    paragraphs: [
      "Free supports one business, one review card, and one review platform per business/card, with basic QR generation and daily Overview performance. Growth supports two businesses, five review cards, and five invited members across all businesses with role-based access, unlimited platform destinations, QR customization, and 12-month detailed analytics. Pro supports unlimited businesses and review cards, twenty invited members across all businesses with role-based access, and 24-month detailed analytics. See Pricing for the current feature list.",
      "Access is determined by verified server-side plan status, not browser settings or a successful-return URL alone. Preview features are illustrative, and connection setup does not promise automatic integration delivery.",
    ],
  },
  {
    id: "billing",
    title: "Subscriptions and charges",
    paragraphs: [
      "The current monthly prices are USD $10 for Growth and USD $29 for Pro. Checkout shows the applicable amount, any taxes or adjustments, and payment terms before you confirm. Stripe processes checkout and billing.",
      "New Growth and Pro subscriptions require the first payment at checkout. No free trial is offered. Existing subscriptions retain their previously agreed billing terms.",
      "Paid subscriptions renew monthly unless cancelled. Manage payment details and cancellation through Plans & billing and Stripe’s customer portal. Read the confirmation screen when changing plans: an upgrade can result in an immediate prorated charge.",
      "Verified payment provides the selected paid-plan access. An active paid subscription must satisfy the app’s payment and period checks; failed, expired, or otherwise ineligible subscriptions may lose paid access.",
    ],
  },
  {
    id: "cancellation",
    title: "Cancellation and downgrade behavior",
    paragraphs: [
      "The cancellation confirmation shows whether access ends immediately or at the end of the current trial or paid period. Where cancellation is scheduled for period end, eligible paid access continues until that period ends. Cancelling a subscription does not itself delete your account.",
      "When the account returns to Free, only one business, one card, and one platform remain available under Free limits. Other saved items are paused rather than erased. Their public pages show an unavailable message. The account owner can select which eligible items remain available through Plans & billing.",
      "Paid analytics, QR customization controls, and integrations are restricted on Free. Existing downloaded or printed materials are not recalled. Resubscribing restores eligible saved items within the new plan’s limits, but does not reactivate cards you manually deactivated.",
      "Plan access and available items are enforced on the server. Attempts to bypass those checks are prohibited.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds and billing questions",
    paragraphs: [
      "You may request a refund of your first subscription charge within seven days of that charge. This policy covers the first subscription charge only; renewal charges and subsequent subscription charges are not covered by this seven-day offer. The refund window starts with the first actual subscription charge. Use Contact to request a refund and identify the relevant account and charge without sharing full payment-card details. Refund requests are handled manually; Stripe does not automatically apply this policy and cancellation alone does not issue a refund.",
      "Approved refunds are processed through Stripe to the original payment method where supported. Bank and payment-provider processing times can vary. This first-charge refund policy does not remove consumer or payment rights that cannot lawfully be waived, including rights concerning incorrect or unauthorized charges.",
    ],
  },
  {
    id: "external-services",
    title: "External platforms and integrations",
    paragraphs: [
      "External review platforms, payment services, and other linked services have their own terms, availability, and privacy practices. A saved review link does not imply affiliation with or endorsement by that platform.",
      "You are responsible for choosing correct business destinations. Revbaze cannot guarantee that an external platform will accept, publish, retain, or display a customer’s review. Saved integration details are connection setup only; event delivery is not enabled in the current implementation.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics and service limits",
    paragraphs: [
      "Page views measure visits, unique visitor counts estimate distinct browsers, and outbound clicks measure destination interactions. A click is not proof of a completed review. Browser storage, repeat interactions, blocked requests, and network conditions can affect counts.",
      "The service does not guarantee a number of reviews, higher ratings, sales, or other business outcomes. No uptime or service-level guarantee has been established in these draft terms. Public URLs, third-party dependencies, and features can be affected by outages or maintenance.",
    ],
  },
  {
    id: "data",
    title: "Data responsibilities and account closure",
    paragraphs: [
      "Review the Privacy page before publishing cards or uploading images. You are responsible for your own customer-facing privacy information and for using business and customer data lawfully.",
      "Use Settings → Data to download the current workspace’s loaded records. This export is limited and is not a complete account archive. The app does not currently provide self-service account closure; use Contact to request account or data assistance.",
      "The selected inactive-account retention policy is two years, but an inactivity definition and deletion process have not yet been implemented. Final account-closure procedures, legally required retention exceptions, suspension and termination terms, liability provisions, and dispute-resolution rules still require confirmation. No automatic account-deletion workflow or liability limit is created by this draft.",
    ],
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    paragraphs: [
      "Pricing and feature information should be reviewed before purchasing. Any finalized agreement should set out how contractual changes are communicated and how applicable legal rights are preserved.",
      "For product, billing, or account questions, use Contact. These draft terms were reviewed against the application on October 9, 2026; the business address, formal contact details, and final legal provisions remain to be confirmed.",
    ],
  },
];
