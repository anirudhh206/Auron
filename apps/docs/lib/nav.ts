export interface NavItem {
  title: string;
  href:  string;
}

export interface NavSection {
  section: string;
  items:   NavItem[];
}

export const NAV: NavSection[] = [
  {
    section: "Overview",
    items: [
      { title: "Introduction",         href: "/docs/introduction"          },
      { title: "Vision & Roadmap",     href: "/docs/vision"                },
    ],
  },
  {
    section: "The App",
    items: [
      { title: "The Auron App",        href: "/docs/the-app"               },
      { title: "Payment Flows",        href: "/docs/how-it-works"          },
      { title: "Solana Blinks",        href: "/docs/the-app#blinks"        },
      { title: "Onboarding & PIN",     href: "/docs/the-app#onboarding"    },
    ],
  },
  {
    section: "Architecture",
    items: [
      { title: "System Architecture",  href: "/docs/architecture"          },
      { title: "Settlement Lifecycle", href: "/docs/architecture#lifecycle"},
      { title: "Internal Ledger",      href: "/docs/architecture#ledger"   },
      { title: "Failure & Recovery",   href: "/docs/architecture#failure"  },
      { title: "Liquidity Model",      href: "/docs/architecture#liquidity"},
    ],
  },
  {
    section: "Company",
    items: [
      { title: "Product Requirements", href: "/docs/prd"            },
      { title: "Business Model",       href: "/docs/business-model" },
      { title: "Compliance",           href: "/docs/compliance"     },
    ],
  },
  {
    section: "Developer",
    items: [
      { title: "Quick Start",          href: "/docs/quickstart"            },
      { title: "SDK Reference",        href: "/docs/sdk"                   },
      { title: "API Reference",        href: "/docs/api-reference"         },
      { title: "Self-Hosting",         href: "/docs/deployment"            },
    ],
  },
  {
    section: "Security",
    items: [
      { title: "6-Layer Model",        href: "/docs/security"              },
      { title: "Rate Limiting",        href: "/docs/security#rate-limit"   },
      { title: "Transaction Verify",   href: "/docs/security#verify"       },
    ],
  },
  {
    section: "Examples",
    items: [
      { title: "E-commerce Checkout",  href: "/docs/examples"              },
      { title: "Agent Integration",    href: "/docs/examples#agent"        },
      { title: "Next.js Server Action",href: "/docs/examples#nextjs"       },
    ],
  },
];

export const PAGE_ORDER: NavItem[] = [
  { title: "Introduction",         href: "/docs/introduction"   },
  { title: "Vision & Roadmap",     href: "/docs/vision"         },
  { title: "The Auron App",        href: "/docs/the-app"        },
  { title: "Payment Flows",        href: "/docs/how-it-works"   },
  { title: "System Architecture",  href: "/docs/architecture"   },
  { title: "Product Requirements", href: "/docs/prd"            },
  { title: "Business Model",       href: "/docs/business-model" },
  { title: "Compliance",           href: "/docs/compliance"     },
  { title: "Quick Start",          href: "/docs/quickstart"     },
  { title: "SDK Reference",        href: "/docs/sdk"            },
  { title: "API Reference",        href: "/docs/api-reference"  },
  { title: "Self-Hosting",         href: "/docs/deployment"     },
  { title: "Security",             href: "/docs/security"       },
  { title: "Examples",             href: "/docs/examples"       },
];
