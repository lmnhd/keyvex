# Keyvex Application Directory Structure

This document outlines the general directory structure for the `keyvex_app` application, providing an overview of where key files, components, and logic are located.

```
keyvex_app/
├── .next/                      # Next.js build output (automatically generated)
├── .vercel/                    # Vercel deployment configuration
├── node_modules/               # Project dependencies
├── public/                     # Static assets (images, fonts, etc.)
│   ├── images/
│   └── ...
├── scripts/                    # Utility and maintenance scripts
├── src/                        # Main application source code
│   ├── app/                    # Next.js App Router directory
│   │   ├── (auth)/             # Authentication-related pages (Clerk)
│   │   ├── (dashboard)/        # Main application dashboard layout and pages
│   │   ├── api/                # API routes
│   │   │   ├── ai/             # Core AI agent endpoints
│   │   │   │   ├── product-tool-creation-v2/ # V2 Multi-Agent Orchestration System
│   │   │   │   │   ├── agents/         # Specialized V2 agents
│   │   │   │   │   └── orchestrate/    # Orchestration control endpoints
│   │   │   │   └── ...
│   │   │   ├── data-sources/   # Data integration APIs
│   │   │   └── ...
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main landing page
│   │   └── tests/              # Test pages and workbenches
│   │       └── tool-generation-workbench/ # UI for testing V2 tool creation
│   ├── components/             # Reusable React components
│   │   ├── product-tools/      # Components related to the final generated tools
│   │   │   └── product-tool-renderer.tsx # Dynamically renders generated tools
│   │   ├── shadcn/             # Auto-generated ShadCN UI components
│   │   └── tool-creator-ui/    # UI components for the tool creation process
│   ├── lib/                    # Shared libraries, helpers, and utilities
│   │   ├── ai/                 # Core AI logic, models, and utilities
│   │   ├── data/               # Data integration logic and connectors
│   │   ├── db/                 # Database interaction logic (DynamoDB)
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useProductToolCreationV2.ts # V2 orchestration hook
│   │   ├── prompts/            # All AI prompts, separated by agent
│   │   ├── types/              # TypeScript type definitions
│   │   │   └── tcc.ts          # Tool Construction Context (TCC) schema
│   │   └── utils.ts            # General utility functions
│   └── styles/                 # Global styles
├── .env.local                  # Local environment variables (untracked)
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore file
├── components.json             # ShadCN UI configuration
├── next.config.js              # Next.js configuration
├── package.json                # Project dependencies and scripts
├── postcss.config.mjs          # PostCSS configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration