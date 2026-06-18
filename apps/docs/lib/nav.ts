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
    section: "Getting Started",
    items: [
      { title: "Introduction",        href: "/docs/introduction"  },
      { title: "Quick Start",         href: "/docs/quickstart"    },
      { title: "How It Works",        href: "/docs/how-it-works"  },
    ],
  },
  {
    section: "SDK",
    items: [
      { title: "Installation",        href: "/docs/sdk"           },
      { title: "AuronClient",         href: "/docs/sdk#client"    },
      { title: "getQuote()",          href: "/docs/sdk#getquote"  },
      { title: "Error Handling",      href: "/docs/sdk#errors"    },
    ],
  },
  {
    section: "API Reference",
    items: [
      { title: "Authentication",      href: "/docs/api-reference#auth"  },
      { title: "POST /api/v1/pay",    href: "/docs/api-reference#pay"   },
      { title: "GET /api/quote",      href: "/docs/api-reference#quote" },
      { title: "GET /api/rate",       href: "/docs/api-reference#rate"  },
    ],
  },
  {
    section: "Security",
    items: [
      { title: "6-Layer Model",       href: "/docs/security"            },
      { title: "Rate Limiting",       href: "/docs/security#rate-limit" },
      { title: "Transaction Verify",  href: "/docs/security#verify"     },
    ],
  },
  {
    section: "Examples",
    items: [
      { title: "E-commerce Checkout", href: "/docs/examples"            },
      { title: "Agent Integration",   href: "/docs/examples#agent"      },
    ],
  },
];

// Flat ordered list for prev/next navigation (top-level pages only)
export const PAGE_ORDER: NavItem[] = [
  { title: "Introduction",        href: "/docs/introduction"  },
  { title: "Quick Start",         href: "/docs/quickstart"    },
  { title: "How It Works",        href: "/docs/how-it-works"  },
  { title: "SDK Reference",       href: "/docs/sdk"           },
  { title: "API Reference",       href: "/docs/api-reference" },
  { title: "Security",            href: "/docs/security"      },
  { title: "Examples",            href: "/docs/examples"      },
];
