# Changelog


## 2026-05-12 — c5778a3

feat: ongoing work

Files changed:
   .gitignore                             |    5 +
   package-lock.json                      | 3207 ++++++++++++++++++++++++++++++++
   package.json                           |   42 +
   src/agent/loop.ts                      |  269 +++
   src/agent/session/store.ts             |   86 +
   src/agent/types.ts                     |   67 +
   src/config/index.ts                    |   92 +
   src/config/logger.ts                   |   30 +
   src/cron/manager.ts                    |  123 ++
   src/discord/client.ts                  |   64 +
   src/discord/commands/definitions.ts    |   61 +
   src/discord/commands/deploy.ts         |   31 +
   src/discord/commands/handler.ts        |  219 +++
   src/discord/monitor/message-handler.ts |  191 ++
   src/entry.ts                           |   84 +
   src/index.ts                           |   36 +
   src/tools/builtin/bash.ts              |   77 +
   src/tools/builtin/discord-tools.ts     |  206 ++
   src/tools/builtin/file-ops.ts          |  164 ++
   src/tools/builtin/index.ts             |   36 +
   src/tools/builtin/web.ts               |   62 +
   src/tools/registry.ts                  |   82 +
   src/tools/types.ts                     |   34 +
   tsconfig.json                          |   21 +
   24 files changed, 5289 insertions(+)
