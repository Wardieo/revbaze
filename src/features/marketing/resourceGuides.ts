import {
  Link2,
  QrCode,
  Heart,
  BarChart3,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
export const guides = [
  {
    slug: "review-links",
    category: "Getting started",
    title: "Build a thoughtful review invitation",
    text: "A practical guide to business branding, destinations, and your first review card.",
    icon: Link2,
    steps: [
      [
        "Start with your business",
        "Add a recognizable name and logo. Choose your business category and optional website so your card feels familiar.",
      ],
      [
        "Choose official destinations",
        "Add the URLs where customers can leave reviews. Check that each URL belongs to the correct business and opens the destination you expect.",
      ],
      [
        "Make the card yours",
        "Choose a layout, accent, and welcome message. Offer the same review destinations to every customer.",
      ],
      [
        "Publish and test",
        "Open your published card on desktop and mobile, check each link, then share your invitation.",
      ],
    ],
  },
  {
    slug: "qr-codes",
    category: "Sharing your link",
    title: "Take your review invitation offline",
    text: "Make your QR code easy to recognize, scan, and share in the right moment.",
    icon: QrCode,
    steps: [
      [
        "Keep it clear",
        "Use a dark foreground on a light background. Keep the quiet area around the code free of text and decoration.",
      ],
      [
        "Make it your own",
        "Choose Classic, Rounded, or Dots. Add your business logo if you like, and check that it remains readable.",
      ],
      [
        "Scan before you print",
        "Test the actual downloaded QR on more than one phone. Test your printed size and placement too.",
      ],
      [
        "Keep the destination stable",
        "Changing the card slug after printing changes its destination. Plan the URL before producing your materials.",
      ],
    ],
  },
  {
    slug: "honest-feedback",
    category: "Customer experience",
    title: "Make room for every experience",
    text: "Invite feedback with clear choices and respectful, neutral language.",
    icon: Heart,
    steps: [
      [
        "Use a neutral invitation",
        "Ask customers to share their experience. Avoid asking only for positive ratings.",
      ],
      [
        "Offer equal choices",
        "Make the same review destinations available to every customer. Do not use a rating to determine who receives a public review link.",
      ],
      [
        "Keep expectations clear",
        "An invitation is optional. Let customers choose when, where, and whether to respond.",
      ],
      [
        "Understand your metrics",
        "A page view measures a visit. An outbound click measures a link interaction. Neither proves a completed review.",
      ],
    ],
  },
  {
    slug: "understanding-analytics",
    category: "Analytics",
    title: "Turn activity into useful insight",
    text: "Understand views, unique visitors, outbound clicks, and what your click-through rate can tell you.",
    icon: BarChart3,
    steps: [
      [
        "Start with the right question",
        "Decide what you want to understand: whether more customers are opening your card, which destinations they choose, or how sharing channels perform. Choose a date range before comparing results.",
      ],
      [
        "Read each metric in context",
        "Page views count visits. Unique visitors represent distinct browsers, not verified individual people. Outbound clicks count interactions with review destinations. Click-through rate is outbound clicks divided by page views, multiplied by 100; repeated clicks can affect that rate.",
      ],
      [
        "Compare like with like",
        "Use the same reporting timezone and comparable date ranges. Card, platform, and traffic-source filters help you focus the report. A small number of visits can make percentage changes look dramatic.",
      ],
      [
        "Make one change at a time",
        "Try a clearer invitation or a different sharing placement, then watch the next comparable period. Treat changes as signals to investigate. An outbound click does not confirm that a review was completed.",
      ],
    ],
  },
  {
    slug: "sharing-your-link",
    category: "Sharing your link",
    title: "Put your invitation in the right place",
    text: "Make your review link easy to find at moments that feel natural for your customers.",
    icon: MessageSquare,
    steps: [
      [
        "Choose a natural moment",
        "Share your invitation after a customer has had time to experience your business. Keep the message optional and relevant to the interaction.",
      ],
      [
        "Keep the message short",
        "Use plain language: ‘Thanks for visiting. If you’d like, share your experience here.’ Include the review link and give customers room to choose.",
      ],
      [
        "Match the channel to the moment",
        "A link works well in a follow-up message or on your website. A QR code can be useful on a counter, receipt, or printed card. Test the destination before sending or printing.",
      ],
      [
        "Keep the invitation consistent",
        "Offer the same opportunity to every customer. Avoid repeated requests that feel pushy, and review your invitation when business details or destinations change.",
      ],
    ],
  },
  {
    slug: "review-card-checklist",
    category: "Getting started",
    title: "A final check before you share",
    text: "Check the details, destinations, and mobile experience before your invitation goes live.",
    icon: ShieldCheck,
    steps: [
      [
        "Check your business details",
        "Use the business name your customers recognize. Check your logo, welcome text, and spelling. Keep the invitation readable and neutral.",
      ],
      [
        "Open every review destination",
        "Confirm that each enabled platform link opens the correct business listing. Remove outdated URLs and keep only the destinations you want customers to use.",
      ],
      [
        "Try the mobile experience",
        "Open the public card on your phone. Check that the text is readable, buttons are easy to tap, and your logo fits. Also check the card on a desktop browser.",
      ],
      [
        "Test your sharing materials",
        "Copy the public link and open it in a separate browser tab. Scan any downloaded QR code, including a printed test. Keep the card URL stable once you start distributing it.",
      ],
    ],
  },
];
