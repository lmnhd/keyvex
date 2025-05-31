TenantArmor: Project Context & Guiding Specifications (7-Day MVP)
Version: 1.0
Date: October 26, 2023
1. Project Mission & MVP Goal:
Mission: To empower renters by providing rapid, AI-driven lease analysis and eviction notice assistance.
MVP Goal (7 Days): Launch a functional web application that allows users to:
Upload a text-based PDF lease agreement, select their state (initially CA, NY, TX), and receive an AI-generated risk analysis.
Upload a text-based PDF eviction notice, select their state, and receive relevant information/links (with a longer-term goal of templated responses).
Implement a basic freemium model managed by Clerk auth.
2. Core Technologies & Stack:
Frontend: Next.js 14 (App Router) + React + Tailwind CSS (in `tenantarmor/`)
Backend Logic/API: Next.js 14 API Routes (Serverless Functions on Vercel, in `tenantarmor/`)
AI Model: OpenAI GPT-3.5 Turbo (via Vercel AI SDK or direct API calls)
PDF Text Extraction: AWS Lambda (Python 3.12 with PyMuPDF layer)
Database: AWS DynamoDB (Serverless NoSQL)
File Storage: AWS S3
Authentication: Clerk
Hosting: Vercel (Frontend/Next.js API), AWS (Lambda, S3, DynamoDB)
Development Environment: Windows 11 (PowerShell for CLI commands)
3. Data & Process Flow Architecture (Confirmed: Option B):
User Upload (Client): User uploads a PDF lease or eviction notice and selects their state via the Next.js frontend.
Presigned URL (Next.js API -> S3): Frontend requests a secure, pre-signed S3 URL from a Next.js API endpoint.
Direct S3 Upload (Client -> S3): Frontend uploads the file directly to the S3 bucket (`tenant-defender-uploads`) using the pre-signed URL (from `tenantarmor/` app).
S3 Trigger (S3 -> Lambda): S3 upload triggers the Python AWS Lambda function.
Text Extraction (Lambda): Lambda uses PyMuPDF to extract text from the PDF.
Initial DB Record (Lambda -> DynamoDB): Lambda creates/updates an item in the LeaseAnalyses DynamoDB table with:
analysisId (Primary Key, e.g., S3 object key or a UUID)
userId (from Clerk, passed via S3 metadata or inferred if possible)
s3Key
uploadTimestamp
status: TEXT_EXTRACTION_COMPLETE (or PENDING_AI_ANALYSIS)
userSelectedState
documentType: (LEASE or EVICTION_NOTICE)
Optionally, the extracted text if small, or a flag indicating text is ready.
Trigger AI Processing (Lambda -> Next.js API): Lambda makes a lightweight HTTP POST request to a specific Next.js API endpoint (e.g., `tenantarmor/app/api/initiate-analysis`), passing the `analysisId`.
AI Interaction (Next.js API -> OpenAI):
The Next.js API route receives the analysisId.
It fetches the corresponding record (and potentially text if not passed directly) from DynamoDB or S3.
It updates the DynamoDB status to AI_PROCESSING.
It constructs a specialized prompt based on documentType and userSelectedState.
It calls the OpenAI GPT-3.5 Turbo API.
Store AI Results (Next.js API -> DynamoDB):
The Next.js API route receives the response from OpenAI.
It processes/structures the AI response.
It updates the LeaseAnalyses table item with the AI-generated analysis content and sets status to COMPLETED or FAILED.
Display Results (Client -> Next.js API -> DynamoDB): Frontend polls a Next.js API endpoint (e.g., /api/analysis-status?analysisId=...). This API checks DynamoDB for the status and returns the analysis when COMPLETED.
4. AI Strategy:
Model: GPT-3.5 Turbo (prioritize cost-effectiveness for MVP).
Prompt Engineering:
CRITICAL: Develop separate, specific prompts for:
Lease Analysis: Focus on risk identification, clause explanation, and cross-referencing with key state-specific laws (from hardcoded JSON).
Eviction Notice Data Extraction: Focus on extracting structured data (names, dates, reasons) before attempting any response generation.
Prompts should be clear, concise, and provide context (like user-selected state).
Output Handling: Store AI responses in DynamoDB. For the MVP, storing the AI's raw text output for lease analysis is acceptable. For eviction notices, aim to store extracted structured data.
Cost Optimization: Cache GPT-3.5 responses if identical documents (based on a hash of content, if feasible, or S3 key for simplicity in MVP) are re-uploaded, though this is a Day 6 optimization.
5. Database (AWS DynamoDB):
Primary Table: LeaseAnalyses
Partition Key: analysisId (String - e.g., S3 object key, or a UUID generated upon upload record creation)
Sort Key: (Optional for MVP, could be uploadTimestamp if complex queries per user are needed later)
Key Attributes:
userId (String - from Clerk, for data ownership and filtering)
s3Key (String - path to the original file in S3)
documentType (String Enum: LEASE, EVICTION_NOTICE)
userSelectedState (String Enum: CA, NY, TX)
status (String Enum: UPLOADED, TEXT_EXTRACTION_PENDING, TEXT_EXTRACTION_COMPLETE, AI_PROCESSING_LEASE, AI_PROCESSING_EVICTION_DATA, COMPLETED, FAILED)
extractedText (String - consider S3 for very large texts post-MVP, for MVP can be in DynamoDB if typically small enough, or omit and fetch from S3 on demand by Next.js API)
aiAnalysisResult (String or Map - for lease reports or structured eviction data)
errorDetails (String - if status is FAILED)
uploadTimestamp (Number - Unix epoch)
lastUpdatedTimestamp (Number - Unix epoch)
Secondary Table (Eviction Templates - Day 4): EvictionResponseTemplates
Partition Key: state (String Enum: CA, NY, TX)
Sort Key: templateName (String - e.g., "3-Day Notice to Pay or Quit Response")
Attributes: templateContent (String - with placeholders like {tenantName}), guidance (String).
Alternative for MVP: Store templates as JSON/text files within the Next.js project if simpler than managing in DynamoDB initially.
6. Frontend (Next.js 14 / React / Tailwind CSS):
Key Pages/Views:
/upload: File input (PDF), state selection dropdown. Clear instructions.
/analysis/[analysisId]: Results display page. Shows status (polling), then the AI report or eviction info.
/dashboard (or similar protected route): List of user's past analyses.
Auth pages (handled by Clerk: /sign-in, /sign-up).
Pricing/Upgrade Page (Day 7).
User Experience:
Provide immediate feedback on actions (e.g., "Uploading...", "Processing...").
Clear loading states while polling for results.
Graceful error messages.
Responsive design for mobile/desktop.
7. Backend (Next.js 14 API Routes):
/api/upload-url: (POST in `tenantarmor/app/api/`) Generates a pre-signed S3 URL for uploading. Requires auth.
/api/initiate-analysis: (POST in `tenantarmor/app/api/`) Triggered by Lambda. Takes `analysisId`. Starts AI processing. Not directly user-facing.
/api/analysis-status: (GET in `tenantarmor/app/api/`) Takes `analysisId`. Pollable. Returns status and results. Requires auth.
/api/process` (OLD NAME - Day 3 plan): To be refactored/renamed into `tenantarmor/app/api/initiate-analysis` or similar, and the actual OpenAI call logic will reside here, triggered by the Lambda notification.
/api/download-eviction-letter: (GET in `tenantarmor/app/api/`) Takes `analysisId` (or `evictionNoticeId`). Fetches data, populates template, returns file for download. Requires auth. (Day 4)
8. PDF Handling:
MVP (7 Days): Strictly text-based (born-digital) PDFs. PyMuPDF in Lambda will handle text extraction.
Error Handling: If PyMuPDF fails to extract significant text (e.g., image-only PDF), the status in DynamoDB should be set to FAILED with an appropriate errorDetails message ("Could not extract text. Please ensure it's a text-based PDF.").
Post-MVP (Week 2+):
Client-side OCR (Tesseract.js) for scanned printed documents.
Further exploration for handwritten documents (Tesseract.js or server-side OCR like AWS Textract).
9. Security & Authentication:
User Authentication: Clerk will manage user sign-up, sign-in, and session management.
API Route Protection: Protect Next.js API routes that require user context using Clerk's backend SDK.
S3 Security:
Use pre-signed URLs for uploads to limit direct write access to the bucket.
S3 bucket should NOT be publicly writable.
Consider S3 object ownership and lifecycle policies.
API Keys (OpenAI, AWS): Store securely using environment variables (Vercel for Next.js, Lambda environment variables). NEVER commit keys to the repository.
Data Segregation: Ensure users can only access their own analysis data (via userId checks in API routes querying DynamoDB).
10. Error Handling & Logging:
Frontend: Display user-friendly error messages.
Backend (Next.js API & Lambda):
Implement try-catch blocks for all external calls (AWS SDK, OpenAI).
Log errors to Vercel Functions logs and AWS CloudWatch Logs (for Lambda).
Update DynamoDB status to FAILED with errorDetails upon failure.
Critical Bugs (Day 6 focus): Prioritize fixing bugs that break the core user flow.
11. Deployment:
Next.js Frontend & API: Vercel (connect GitHub repo for CI/CD). vercel --prod for production.
AWS Lambda: Manual zip upload or AWS SAM/Serverless Framework for more robust deployment post-MVP. Configure S3 trigger.
AWS S3 & DynamoDB: Create via AWS Management Console or Infrastructure as Code (e.g., CloudFormation/Terraform) post-MVP.
12. Scope Management for 7-Day MVP:
Strict Adherence: Only features explicitly outlined for the 7-day plan.
"No Fluff": Postpone aesthetic perfection, advanced features (OCR for handwritten, lawyer marketplace, renewal alerts), and extensive state law variations beyond CA, NY, TX.
Focus on Core Loop: Upload -> Text Extraction -> AI Analysis (Lease) / Data Extraction (Eviction) -> Display Results.
If a feature proves too complex within the timeline (e.g., .docx generation), have a simpler fallback (e.g., formatted text).
13. Development Environment Reminder:
All terminal commands assume Windows PowerShell. Adjust syntax if using WSL or other shells.
Ignore .txt files or files with "copy" in the name; they are for reference only.
DO NOT REMOVE TODO: comments.

TenantArmor_SASS/
├── next-app/                   # Next.js 14 Frontend & API Application
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Route group for authentication pages (Clerk)
│   │   │   ├── sign-in/        # Clerk sign-in page structure
│   │   │   │   └── [[...sign-in]]/
│   │   │   │       └── page.tsx
│   │   │   └── sign-up/        # Clerk sign-up page structure
│   │   │       └── [[...sign-up]]/
│   │   │           └── page.tsx
│   │   ├── api/                # API Routes (Backend for Frontend)
│   │   │   ├── upload-url/     # Generates pre-signed S3 URLs
│   │   │   │   └── route.ts
│   │   │   ├── initiate-analysis/ # Triggered by Lambda to start AI processing
│   │   │   │   └── route.ts
│   │   │   ├── analysis-status/ # Polled by frontend for results
│   │   │   │   └── route.ts    # Takes query param ?analysisId=...
│   │   │   └── download-eviction-letter/ # Generates and serves eviction letters
│   │   │       └── route.ts    # Takes query param ?analysisId=...
│   │   ├── upload/             # Lease/Eviction Notice Upload Page
│   │   │   └── page.tsx
│   │   ├── analysis/
│   │   │   └── [analysisId]/   # Dynamic route for displaying analysis results
│   │   │       └── page.tsx
│   │   ├── dashboard/          # User dashboard (list of analyses)
│   │   │   └── page.tsx
│   │   ├── layout.tsx          # Root layout (e.g., with ClerkProvider)
│   │   └── page.tsx            # Home/Landing page
│   ├── components/             # Shared React components
│   │   ├── ui/                 # UI primitives (e.g., buttons, inputs, cards - potentially from shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── dropdown.tsx
│   │   ├── layout/             # Layout components (Navbar, Footer, Sidebars)
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── specific/           # Components specific to features (e.g., UploadForm, AnalysisReport)
│   │       ├── UploadForm.tsx
│   │       └── AnalysisDisplay.tsx
│   ├── lib/                    # Utility functions, SDK clients, helper modules
│   │   ├── aws-clients.ts      # AWS SDK v3 client initializations (S3, DynamoDB for Next.js API)
│   │   ├── openai-client.ts    # OpenAI client setup (using Vercel AI SDK or direct)
│   │   ├── clerk-config.ts     # Clerk client/server configurations
│   │   ├── prompts.ts          # Centralized AI prompt templates
│   │   └── utils.ts            # General utility functions (formatting, etc.)
│   ├── public/                 # Static assets (images, fonts, favicons)
│   ├── styles/                 # Global styles (if any beyond Tailwind)
│   │   └── globals.css
│   ├── .env.local              # Local environment variables for Next.js app (API keys, etc.)
│   ├── .eslintrc.json
│   ├── .gitignore
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── aws-infra/                 # AWS CDK Infrastructure as Code Project
│   ├── bin/
│   │   └── tenant-armor-infra.ts # CDK App entry point
│   ├── lib/                    # CDK Stacks and Constructs
│   │   ├── tenant-armor-stack.ts # Main stack defining all resources
│   │   ├── s3-construct.ts     # Custom construct for S3 bucket setup
│   │   ├── dynamodb-construct.ts # Custom construct for DynamoDB tables
│   │   └── lambda-construct.ts # Custom construct for Lambda function(s)
│   ├── lambda-fns/             # Source code for Lambda functions
│   │   └── pdf-processor/      # Lambda for PDF text extraction
│   │       ├── index.py        # Lambda handler code
│   │       └── requirements.txt # Python dependencies for this Lambda
│   ├── .env                    # Environment variables for CDK deployment (AWS_PROFILE, AWS_REGION)
│   ├── .gitignore
│   ├── cdk.json                # CDK toolkit configuration
│   ├── jest.config.js          # For testing CDK constructs (optional for MVP)
│   ├── package.json            # CDK project dependencies (aws-cdk-lib, constructs, etc.)
│   └── tsconfig.json
│
├── documents/                  # Project-related, non-code assets
│   ├── design-assets/          # (Optional) UI mockups, logos, branding
│   ├── legal-templates-source/ # Raw source for eviction response templates (e.g., markdown, text)
│   │   ├── CA/
│   │   │   └── ca_3_day_pay_or_quit_response.md
│   │   ├── NY/
│   │   └── TX/
│   └── state-law-summaries.json # Hardcoded JSON for key state law points
│
├── scripts/                    # Utility scripts (e.g., for seeding data, testing)
│   └── seed-dynamodb.ts        # TypeScript script to seed DynamoDB (e.g., eviction templates from legal-templates-source)
│
├── .gitignore                  # Root gitignore (node_modules, .DS_Store, .env*, etc.)

└── README.md                   # Project overview, setup instructions, architecture notes