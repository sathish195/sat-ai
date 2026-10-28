/**
 * Model Context Protocol (MCP) Client Manager
 * Connects backend to external MCP servers (Filesystem, GitHub, PostgreSQL, etc.)
 * allowing LLMs to access tools and data sources securely.
 */

let mcpClient = null;
let registeredTools = [];

/**
 * Initialize connection to an MCP server.
 * Example MCP servers:
 *   - Stdio: npx -y @modelcontextprotocol/server-filesystem /path/to/dir
 *   - Stdio: npx -y @modelcontextprotocol/server-postgres postgresql://...
 */
async function initializeMCP(options = {}) {
  try {
    let MCP;
    try {
      MCP = require("@modelcontextprotocol/sdk/client/index.js");
    } catch {
      console.log("ℹ️ MCP SDK not installed yet (npm i @modelcontextprotocol/sdk to enable external MCP servers)");
      return { connected: false, tools: [] };
    }

    const { Client } = MCP;
    const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

    const command = options.command || "npx";
    const args = options.args || ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()];

    const transport = new StdioClientTransport({ command, args });
    mcpClient = new Client(
      { name: "rag-gemini-backend", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await mcpClient.connect(transport);
    const toolsResponse = await mcpClient.listTools();
    registeredTools = toolsResponse.tools || [];

    console.log(`🔌 MCP Connected! Available tools: ${registeredTools.length}`);
    return { connected: true, tools: registeredTools };
  } catch (err) {
    console.warn("⚠️ MCP connection skipped or error:", err.message);
    return { connected: false, error: err.message, tools: [] };
  }
}

/**
 * Execute a tool on the connected MCP server
 */
async function callMCPTool(name, parameters) {
  if (!mcpClient) {
    throw new Error("MCP client is not connected.");
  }
  return await mcpClient.callTool({ name, arguments: parameters });
}

function getAvailableMCPTools() {
  return registeredTools;
}

module.exports = {
  initializeMCP,
  callMCPTool,
  getAvailableMCPTools,
};
