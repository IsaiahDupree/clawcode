# ClawCode

Agentic Discord bot — multi-channel AI assistant with autonomous tool execution.

## Requirements

- Node.js >= 22
- A Discord bot token + client ID
- An Anthropic (or OpenAI) API key

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`)

Optional (see `.env.example`): `DISCORD_GUILD_ID`, `CLAWCODE_STATE_DIR`,
`CLAWCODE_LOG_LEVEL`, `CLAWCODE_MAX_ITERATIONS`, `CLAWCODE_ALLOWED_GUILDS`,
`CLAWCODE_ALLOWED_USERS`.

## Run

Development (TypeScript via `tsx`):

```bash
npm run dev -- start
```

Production build + start:

```bash
npm run build
npm start
```

Other commands:

```bash
npx tsx src/entry.ts --version       # print version
npx tsx src/entry.ts --help          # list commands
npx tsx src/entry.ts status          # show resolved config
npm run deploy-commands              # register Discord slash commands
```

## Test

```bash
npm test
```

## Lint

```bash
npm run lint
```
