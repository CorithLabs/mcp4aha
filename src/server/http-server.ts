import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import startServer, { performHealthCheck, serverStatus } from "./server.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bearerAuth, isAuthEnabled } from "./middleware/auth.js";

// Environment variables
const PORT = parseInt(process.env.MCP_PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

console.error(`Configured to listen on ${HOST}:${PORT}`);

// Setup Express
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Aha-Api-Key'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
}));

app.options('*', cors());

// Keep track of active connections with session IDs
const connections = new Map<string, SSEServerTransport>();

// Initialize the MCP server
let server: McpServer | null = null;
startServer().then(s => {
  server = s;
  console.error("MCP Server initialized successfully");
}).catch(error => {
  console.error("Failed to initialize server:", error);
  process.exit(1);
});

// Async-aware bearer auth wrapper for Express route handlers
function withAuth(handler: (req: Request, res: Response) => Promise<void> | void) {
  return async (req: Request, res: Response) => {
    await bearerAuth(req, res, async () => {
      await handler(req, res);
    });
  };
}

// SSE endpoint — requires Bearer token + optional X-Aha-Api-Key
app.get("/sse", withAuth(async (req: Request, res: Response) => {
  console.error(`Received SSE connection request from ${req.ip}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Aha-Api-Key');

  if (!server) {
    return res.status(503).send("Server not initialized");
  }

  const sessionId = generateSessionId();
  console.error(`Creating SSE session with ID: ${sessionId}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const transport = new SSEServerTransport("/messages", res);
    connections.set(sessionId, transport);

    req.on("close", () => {
      console.error(`SSE connection closed for session: ${sessionId}`);
      connections.delete(sessionId);
    });

    await server.connect(transport);
    console.error(`SSE connection established for session: ${sessionId}`);
    res.write(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`);
  } catch (error) {
    console.error(`Error creating SSE transport: ${error}`);
    connections.delete(sessionId);
    res.status(500).send(`Internal server error: ${error}`);
  }
}));

// Messages endpoint — requires Bearer token
app.post("/messages", withAuth(async (req: Request, res: Response) => {
  let sessionId = req.query.sessionId?.toString();

  if (!sessionId && connections.size === 1) {
    sessionId = Array.from(connections.keys())[0];
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!server) {
    return res.status(503).json({ error: "Server not initialized" });
  }

  if (!sessionId) {
    return res.status(400).json({
      error: "No session ID provided",
      activeConnections: connections.size
    });
  }

  const transport = connections.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (error) {
    res.status(500).json({ error: `Internal server error: ${error}` });
  }
}));

// Health check endpoint (no auth required)
app.get("/health", async (_req: Request, res: Response) => {
  try {
    if (!server) {
      return res.status(503).json({
        status: "unavailable",
        message: "Server not initialized",
        timestamp: new Date().toISOString()
      });
    }

    const healthCheck = await performHealthCheck();
    const httpStatus = healthCheck.status === "healthy" ? 200 :
                      healthCheck.status === "degraded" ? 200 : 503;

    res.status(httpStatus).json({
      ...healthCheck,
      http: {
        activeConnections: connections.size,
        port: PORT,
        host: HOST
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint (no auth required)
app.get("/status", (_req: Request, res: Response) => {
  res.status(200).json({
    ...serverStatus,
    http: {
      activeConnections: connections.size,
      port: PORT,
      host: HOST
    }
  });
});

// Root info endpoint
app.get("/", async (_req: Request, res: Response) => {
  const authEnabled = await isAuthEnabled();
  res.status(200).json({
    name: "Aha.io MCP Server",
    version: serverStatus.version,
    endpoints: { sse: "/sse", messages: "/messages", health: "/health", status: "/status" },
    status: server ? "ready" : "initializing",
    activeConnections: connections.size,
    authentication: {
      enabled: authEnabled,
      type: authEnabled ? "Bearer token" : "none",
      note: authEnabled ? "Pass Authorization: Bearer <token> and X-Aha-Api-Key: <key> headers" : "No auth configured — open portal at port 3000"
    }
  });
});

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

process.on('SIGINT', () => {
  console.error('Shutting down MCP server...');
  process.exit(0);
});

const httpServer = app.listen(PORT, HOST, () => {
  console.error(`🤖 Aha.io MCP Server running at http://${HOST}:${PORT}`);
  console.error(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.error(`💬 Messages endpoint: http://${HOST}:${PORT}/messages`);
  console.error(`❤️  Health check: http://${HOST}:${PORT}/health`);
}).on('error', (err: Error) => {
  console.error(`Server error: ${err}`);
});
