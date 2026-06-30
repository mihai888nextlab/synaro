# Synaro MCP Server

Exposes Synaro project lifecycle and AI tasks as [MCP](https://modelcontextprotocol.io) tools for Cursor, Claude Desktop, and other MCP clients.

## Tools

| Tool | Description |
|------|-------------|
| `create_project` | Create project + Docker environment |
| `deploy_project` | Start container and run app process |
| `get_logs` | Runtime logs or AI task progress |
| `create_agent` | Start AI coding/Q&A task |
| `run_agent` | Poll task until done |
| `get_system_status` | Platform + optional project health |

## Prerequisites (app)

Set on the **Next.js app** (`app/.env.local`):

```env
SYNARO_API_KEY=your-long-random-secret
SYNARO_MCP_USER_ID=<your-user-uuid-from-database>
```

Find your user id:

```sql
SELECT id, email FROM "User" LIMIT 5;
```

## Install & build

```bash
cd services/mcp-server
npm install
npm run build
```

## Cursor configuration

Add to `.cursor/mcp.json` (repo root or home):

```json
{
  "mcpServers": {
    "synaro": {
      "command": "node",
      "args": ["/absolute/path/to/synaro/services/mcp-server/dist/index.js"],
      "env": {
        "SYNARO_API_KEY": "your-long-random-secret",
        "SYNARO_APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

For production, set `SYNARO_APP_URL` to your deployed app URL (e.g. `https://synaro.tech`).

## Development

```bash
npm run dev
```

Uses stdio transport — intended to be launched by an MCP client, not run interactively.

## API routes (app)

The MCP server calls authenticated routes under `/api/mcp/*`:

- `POST /api/mcp/projects`
- `POST /api/mcp/projects/:id/deploy`
- `GET /api/mcp/projects/:id/logs`
- `POST /api/mcp/projects/:id/agents`
- `GET /api/mcp/agents/:taskId`
- `GET /api/mcp/system/status`
