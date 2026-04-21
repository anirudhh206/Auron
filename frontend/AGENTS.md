<!-- BEGIN:nextjs-agent-rules -->
# Auron Frontend — Agent Guidelines

**What is Auron?** A blockchain consumer app for Initia that enables natural-language intent parsing via Claude AI. Users describe what they want ("send $100 to my friend", "lock my savings for 90 days"), and the system executes on-chain safely with a 6-layer security architecture.

## Next.js Version & Breaking Changes

This is **Next.js 14.2.13** with App Router (not Pages Router). Conventions and APIs may differ from your training data. Key differences:
- `app/` directory structure (not `pages/`)
- Server Components by default (mark with `'use client'` for interactive UI)
- Route handlers in `app/api/` (not `pages/api/`)
- `metadata` object for SEO (not `Head` component)
- Streaming responses require specific handling

Read official docs in `node_modules/next/dist/docs/` before implementing new patterns. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout + SEO metadata
│   ├── providers.tsx      # Client providers (Zustand, React Query, Sentry)
│   ├── page.tsx           # Home page
│   ├── api/               # Route handlers
│   │   ├── parse-intent/  # Claude intent parsing + rate limiting
│   │   └── hash-pin/      # Server-side PIN hashing (argon2id)
│   └── globals.css        # Tailwind + custom CSS variables
├── components/            # React components (all 'use client')
│   ├── WalletWidget.tsx   # InterwovenKit connect integration
│   ├── ChatInterface.tsx  # Main chat UI
│   ├── ConfirmCard.tsx    # 6-layer security confirmation
│   ├── RevealCard.tsx     # Success/reveal screen
│   ├── TransactionHistory.tsx
│   ├── OnboardingFlow.tsx # PIN setup + spend ceiling
│   └── ui/                # Reusable UI primitives
├── lib/
│   ├── stores/            # Zustand state stores
│   ├── api.ts             # API client helpers
│   ├── utils.ts           # Helpers (clsx, etc)
│   └── constants.ts       # App config
├── public/                # Static assets
└── package.json
```

## Technology Stack

- **Framework:** Next.js 14 (App Router)
- **State:** Zustand (lightweight, simple)
- **API Client:** React Query (@tanstack/react-query)
- **UI Framework:** Tailwind CSS + Framer Motion (animations)
- **Blockchain:** Initia SDK + InterwovenKit for wallet connection
- **AI:** Anthropic Claude SDK with prompt caching
- **Security:** Argon2 (PIN hashing), Vercel KV (rate limiting), Sentry (monitoring)
- **Icons:** Lucide React + Initia Icons

## Key Conventions

### 1. Client Components
All interactive components must have `'use client'` at the top. Server Components are restricted to layouts and page.tsx.

```tsx
'use client';
import { useState } from 'react';

export default function MyComponent() {
  // Client-side logic only
}
```

### 2. State Management (Zustand)
Store definitions go in `lib/stores/`. Keep stores focused and slice-based:

```tsx
// lib/stores/chatStore.ts
import { create } from 'zustand';

export const useChatStore = create((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
}));
```

### 3. API Routes
All API endpoints use Route Handlers in `app/api/`. Implement rate limiting and input validation:

- `/api/parse-intent` — Claude intent parsing (Vercel KV rate limiting, prompt caching)
- `/api/hash-pin` — Server-side PIN hashing (argon2id)

Always validate input and return proper HTTP status codes. Use `NextResponse` for responses.

### 4. Component Patterns
- **Container/Presenter:** Logic in one component, UI in another when complex
- **Hooks for logic:** Extract reusable logic into custom hooks in `lib/hooks/`
- **Props over context:** Prefer prop drilling for clarity (context is used only for global state like Zustand)

### 5. Styling
- Primary: **Tailwind CSS** classes
- Secondary: **CSS modules** for complex scoped styles (avoid if possible)
- Animations: **Framer Motion** for smooth transitions
- Dark theme: Already configured (`bg-[#030712]`, `text-white`)

## Security Rules (CRITICAL)

1. **Never store sensitive data in browser:** PIN, private keys, seed phrases must never touch client-side state.
   - PIN hashing: Always happens on server via `/api/hash-pin` 
   - Private keys: Managed by InterwovenKit wallet only

2. **Rate Limiting:** All public API routes must use Vercel KV for distributed rate limiting:
   ```tsx
   import { kv } from "@vercel/kv";
   // Check rate limit before processing
   ```

3. **Input Validation:** Validate all user input, especially intent strings for Claude:
   ```tsx
   if (!intent || intent.length > 500) return 400;
   ```

4. **Anthropic API:** Use prompt caching for cost savings:
   ```tsx
   messages: [{ 
     role: 'user', 
     content: [{ type: 'text', text: intent, cache_control: { type: 'ephemeral' } }]
   }]
   ```

5. **CSP Headers:** Already configured in middleware — don't disable
6. **Environment Variables:** 
   - Public: `NEXT_PUBLIC_*` only
   - Secret: Never commit `.env.local` or `.env.*.local`

## Common Patterns

### Fetching Data with React Query
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';

export function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mydata'],
    queryFn: () => fetch('/api/endpoint').then(r => r.json()),
  });
}
```

### Form Submission with Validation
```tsx
'use client';
export function MyForm() {
  const [error, setError] = useState('');
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/action', { method: 'POST', body: JSON.stringify({...}) });
      if (!res.ok) throw new Error('Request failed');
      // Handle success
    } catch (err) {
      setError(err.message);
    }
  }
}
```

### Animations with Framer Motion
```tsx
import { motion } from 'framer-motion';

export function AnimatedCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

## What NOT to Do

- ❌ Don't use Pages Router (`pages/` directory) — use App Router only
- ❌ Don't store secrets in `public/` or client-side code
- ❌ Don't skip input validation on API routes
- ❌ Don't disable rate limiting
- ❌ Don't use dynamic imports for security-critical code
- ❌ Don't mutate state directly (use Zustand's `set` function)
- ❌ Don't forget `'use client'` in interactive components
- ❌ Don't commit `.env.local` or credentials

## Testing & Quality

- Run `npm run type-check` before commits (catch TypeScript errors)
- Run `npm run lint` (ESLint enforces conventions)
- Test interactive features in browser (type checking doesn't catch UI bugs)
- Check Sentry dashboard for production errors

## Debugging

- **TypeScript errors:** `npm run type-check`
- **Lint errors:** `npm run lint`
- **API issues:** Check browser DevTools Network tab + server logs
- **Rate limit hits:** Check Vercel KV dashboard
- **Anthropic API:** Check usage in Anthropic console, verify prompt caching is working

## Deployment Notes

- **Build:** `npm run build` (must pass type-check + lint)
- **Start:** `npm run start` (production server)
- **Environment:** Set `NEXT_PUBLIC_APP_URL` for SEO and OpenGraph metadata
- **Monitoring:** Sentry already configured — check dashboard for errors

---

**Last Updated:** 2026-04-21 | Questions? Check CLAUDE.md or the project README.
