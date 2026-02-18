import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

export interface MCPServerConfig {
    name: string;
    url: string;
    headers?: Record<string, string>;
    enabled: boolean;
    description: string; // When to use this server, e.g. "Web search for current news and statistics"
}

interface MCPConnection {
    client: Client;
    transport: StreamableHTTPClientTransport | SSEClientTransport;
}

interface OpenRouterToolFunction {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

interface OpenRouterTool {
    type: 'function';
    function: OpenRouterToolFunction;
}

/**
 * Converts a JSON Schema property definition into a Zod schema type.
 */
function jsonSchemaPropertyToZod(prop: any, required: boolean): z.ZodType {
    let field: z.ZodType;
    switch (prop.type) {
        case 'string':
            field = z.string();
            break;
        case 'number':
        case 'integer':
            field = z.number();
            break;
        case 'boolean':
            field = z.boolean();
            break;
        case 'array':
            field = z.array(z.any());
            break;
        default:
            field = z.any();
    }
    if (prop.description) {
        field = field.describe(prop.description);
    }
    return required ? field : field.optional();
}

/**
 * Builds a Zod object schema from a JSON Schema definition.
 */
function buildZodFromJsonSchema(schema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodType> = {};
    if (!schema || !schema.properties) {
        return z.object({});
    }
    const requiredFields: string[] = schema.required || [];
    for (const [key, prop] of Object.entries(schema.properties || {})) {
        shape[key] = jsonSchemaPropertyToZod(prop, requiredFields.includes(key));
    }
    return z.object(shape);
}

/**
 * Converts an MCP tool definition into a Mastra-compatible tool.
 */
function mcpToolToMastra(serverName: string, mcpTool: any, mcpClient: Client) {
    const toolId = `mcp_${serverName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${mcpTool.name}`;
    return createTool({
        id: toolId,
        description: `[${serverName}] ${mcpTool.description || mcpTool.name}`,
        inputSchema: buildZodFromJsonSchema(mcpTool.inputSchema),
        outputSchema: z.any(),
        execute: async (input: any) => {
            const result = await mcpClient.callTool({
                name: mcpTool.name,
                arguments: input,
            });
            // Extract text content from MCP result
            if (Array.isArray(result.content)) {
                const textParts = result.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text);
                return textParts.length === 1 ? textParts[0] : textParts.join('\n');
            }
            return result.content;
        },
    });
}

/**
 * Manages MCP client connections, tool caching, and tool execution per tenant.
 */
class MCPManager {
    // tenantId -> serverName -> connection
    private connections: Map<string, Map<string, MCPConnection>> = new Map();
    // tenantId -> Record<toolId, Mastra tool>
    private toolCache: Map<string, Record<string, ReturnType<typeof createTool>>> = new Map();
    // tenantId -> OpenRouter tool definitions
    private openRouterToolCache: Map<string, OpenRouterTool[]> = new Map();

    /**
     * Connect to all enabled MCP servers for a tenant.
     */
    async connectServers(tenantId: string, servers: MCPServerConfig[]): Promise<void> {
        // Disconnect existing connections first
        await this.disconnectAll(tenantId);

        const connectionMap = new Map<string, MCPConnection>();
        const mastraTools: Record<string, ReturnType<typeof createTool>> = {};
        const orTools: OpenRouterTool[] = [];

        for (const server of servers) {
            if (!server.enabled || !server.url) continue;

            try {
                const { client, transport } = await this.connectToServer(server);
                connectionMap.set(server.name, { client, transport });

                // Fetch tool definitions
                const toolsResult = await client.listTools();
                const tools = toolsResult.tools || [];

                console.log(`[MCPManager] Server "${server.name}" connected, ${tools.length} tools available`);

                for (const tool of tools) {
                    // Build Mastra tool
                    const mastraTool = mcpToolToMastra(server.name, tool, client);
                    const toolId = `mcp_${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${tool.name}`;
                    mastraTools[toolId] = mastraTool;

                    // Build OpenRouter-compatible tool definition
                    orTools.push({
                        type: 'function',
                        function: {
                            name: toolId,
                            description: `[${server.name}] ${tool.description || tool.name}`,
                            parameters: tool.inputSchema || { type: 'object', properties: {} },
                        },
                    });
                }
            } catch (error: any) {
                console.error(`[MCPManager] Failed to connect to "${server.name}" (${server.url}):`, error.message);
                // Continue with other servers
            }
        }

        this.connections.set(tenantId, connectionMap);
        this.toolCache.set(tenantId, mastraTools);
        this.openRouterToolCache.set(tenantId, orTools);
    }

    /**
     * Connect to a single MCP server with StreamableHTTP transport, falling back to SSE.
     */
    private async connectToServer(server: MCPServerConfig, retries: number = 2): Promise<{ client: Client; transport: StreamableHTTPClientTransport | SSEClientTransport }> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Try StreamableHTTP first
                const url = new URL(server.url);
                const headers: Record<string, string> = {
                    ...server.headers,
                };

                const transport = new StreamableHTTPClientTransport(url, {
                    requestInit: {
                        headers,
                    },
                });

                const client = new Client({
                    name: 'post-scheduler',
                    version: '1.0.0',
                });

                await client.connect(transport);
                return { client, transport };
            } catch (error: any) {
                // If StreamableHTTP fails, try SSE fallback
                if (attempt === 0) {
                    try {
                        const url = new URL(server.url);
                        const sseTransport = new SSEClientTransport(url, {
                            requestInit: {
                                headers: server.headers || {},
                            },
                        });

                        const client = new Client({
                            name: 'post-scheduler',
                            version: '1.0.0',
                        });

                        await client.connect(sseTransport);
                        console.log(`[MCPManager] Connected to "${server.name}" via SSE fallback`);
                        return { client, transport: sseTransport };
                    } catch (sseError: any) {
                        lastError = sseError;
                    }
                } else {
                    lastError = error;
                }

                // Wait before retry
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        throw lastError || new Error(`Failed to connect to ${server.name}`);
    }

    /**
     * Get Mastra-compatible tools for a tenant. Connects lazily if needed.
     */
    async getTools(tenantId: string, servers?: MCPServerConfig[]): Promise<Record<string, ReturnType<typeof createTool>>> {
        if (this.toolCache.has(tenantId)) {
            return this.toolCache.get(tenantId)!;
        }

        if (servers && servers.length > 0) {
            await this.connectServers(tenantId, servers);
            return this.toolCache.get(tenantId) || {};
        }

        return {};
    }

    /**
     * Get OpenRouter-compatible tool definitions for a tenant.
     */
    async getToolDefinitionsForOpenRouter(tenantId: string, servers?: MCPServerConfig[]): Promise<OpenRouterTool[]> {
        if (this.openRouterToolCache.has(tenantId)) {
            return this.openRouterToolCache.get(tenantId)!;
        }

        if (servers && servers.length > 0) {
            await this.connectServers(tenantId, servers);
            return this.openRouterToolCache.get(tenantId) || [];
        }

        return [];
    }

    /**
     * Execute a tool call by name for a tenant.
     */
    async executeToolCall(tenantId: string, toolName: string, args: Record<string, unknown>): Promise<any> {
        const connections = this.connections.get(tenantId);
        if (!connections) {
            throw new Error(`No MCP connections for tenant ${tenantId}`);
        }

        // toolName format: mcp_{serverName}_{mcpToolName}
        // Find the right connection and original tool name
        for (const [serverName, conn] of connections) {
            const prefix = `mcp_${serverName.replace(/[^a-zA-Z0-9_-]/g, '_')}_`;
            if (toolName.startsWith(prefix)) {
                const originalToolName = toolName.slice(prefix.length);
                const result = await conn.client.callTool({
                    name: originalToolName,
                    arguments: args,
                });
                // Extract text content
                if (Array.isArray(result.content)) {
                    const textParts = result.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text);
                    return textParts.length === 1 ? textParts[0] : textParts.join('\n');
                }
                return result.content;
            }
        }

        throw new Error(`Tool "${toolName}" not found in any connected MCP server`);
    }

    /**
     * Test connectivity to an MCP server and return available tools.
     */
    async testConnection(url: string, headers?: Record<string, string>): Promise<{ success: boolean; tools: string[] }> {
        const server: MCPServerConfig = {
            name: '__test__',
            url,
            headers,
            enabled: true,
            description: '',
        };

        try {
            const { client, transport } = await this.connectToServer(server);
            const toolsResult = await client.listTools();
            const toolNames = (toolsResult.tools || []).map((t: any) => t.name);

            // Clean up test connection
            try {
                await client.close();
            } catch { /* ignore cleanup errors */ }

            return { success: true, tools: toolNames };
        } catch (error: any) {
            return { success: false, tools: [] };
        }
    }

    /**
     * Disconnect all MCP servers for a tenant.
     */
    async disconnectAll(tenantId: string): Promise<void> {
        const connections = this.connections.get(tenantId);
        if (connections) {
            for (const [name, conn] of connections) {
                try {
                    await conn.client.close();
                    console.log(`[MCPManager] Disconnected from "${name}"`);
                } catch (error: any) {
                    console.error(`[MCPManager] Error disconnecting from "${name}":`, error.message);
                }
            }
        }
        this.connections.delete(tenantId);
        this.invalidateCache(tenantId);
    }

    /**
     * Invalidate cached tools for a tenant (call when settings change).
     */
    invalidateCache(tenantId: string): void {
        this.toolCache.delete(tenantId);
        this.openRouterToolCache.delete(tenantId);
    }

    /**
     * Select which MCP servers are relevant to a given user request.
     * Uses a lightweight LLM call to match server descriptions against the task.
     * Returns only the servers that should be connected for this request.
     */
    async selectRelevantServers(
        servers: MCPServerConfig[],
        userContext: string,
        apiKey: string,
        modelId: string
    ): Promise<MCPServerConfig[]> {
        const enabledServers = servers.filter(s => s.enabled && s.url);

        // If 0-2 servers, just use all of them — not worth a selection call
        if (enabledServers.length <= 2) {
            return enabledServers;
        }

        // If no server has a description, we can't do intelligent selection
        const hasDescriptions = enabledServers.some(s => s.description?.trim());
        if (!hasDescriptions) {
            console.log('[MCPManager] No server descriptions configured — using all enabled servers');
            return enabledServers;
        }

        const serverList = enabledServers.map((s, i) => `${i + 1}. "${s.name}" — ${s.description || 'No description'}`).join('\n');

        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: modelId || 'anthropic/claude-sonnet-4',
                    messages: [
                        {
                            role: 'system',
                            content: `You select which external data sources are relevant to a content creation task.
Given a list of available data sources and a user task, return ONLY the numbers of sources that would be useful.
Return a JSON array of numbers, e.g. [1, 3]. Return [] if none are relevant.
Be selective — only pick sources that clearly match the task. When in doubt, leave it out.`
                        },
                        {
                            role: 'user',
                            content: `AVAILABLE DATA SOURCES:\n${serverList}\n\nTASK:\n${userContext.substring(0, 500)}\n\nWhich sources (by number) are relevant? Return ONLY a JSON array.`
                        }
                    ],
                    temperature: 0,
                    max_tokens: 50,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const text = response.data.choices[0]?.message?.content?.trim() || '[]';
            const match = text.match(/\[[\d\s,]*\]/);
            if (match) {
                const indices: number[] = JSON.parse(match[0]);
                const selected = indices
                    .map(i => enabledServers[i - 1]) // 1-indexed
                    .filter(Boolean) as MCPServerConfig[];

                console.log(`[MCPManager] Server selection: ${selected.map(s => s.name).join(', ') || 'none'} (from ${enabledServers.length} available)`);
                return selected;
            }
        } catch (error: any) {
            console.error('[MCPManager] Server selection LLM call failed, using all servers:', error.message);
        }

        // Fallback: return all
        return enabledServers;
    }

    /**
     * Get tools for only the relevant MCP servers (filtered by context).
     * Unlike getTools(), this does NOT use the tenant-wide cache — it connects
     * only to the selected servers and returns their tools.
     */
    async getToolsForContext(
        tenantId: string,
        servers: MCPServerConfig[],
        userContext: string,
        apiKey: string,
        modelId: string
    ): Promise<Record<string, ReturnType<typeof createTool>>> {
        const relevant = await this.selectRelevantServers(servers, userContext, apiKey, modelId);
        if (relevant.length === 0) return {};
        // Use a context-specific cache key to avoid polluting the tenant-wide cache
        const cacheKey = `${tenantId}:${relevant.map(s => s.name).sort().join(',')}`;
        if (this.toolCache.has(cacheKey)) {
            return this.toolCache.get(cacheKey)!;
        }
        await this.connectServers(cacheKey, relevant);
        return this.toolCache.get(cacheKey) || {};
    }

    /**
     * Get OpenRouter tool definitions for only the relevant MCP servers.
     */
    async getToolDefinitionsForContext(
        tenantId: string,
        servers: MCPServerConfig[],
        userContext: string,
        apiKey: string,
        modelId: string
    ): Promise<{ tools: OpenRouterTool[]; cacheKey: string }> {
        const relevant = await this.selectRelevantServers(servers, userContext, apiKey, modelId);
        if (relevant.length === 0) return { tools: [], cacheKey: tenantId };
        const cacheKey = `${tenantId}:${relevant.map(s => s.name).sort().join(',')}`;
        if (this.openRouterToolCache.has(cacheKey)) {
            return { tools: this.openRouterToolCache.get(cacheKey)!, cacheKey };
        }
        await this.connectServers(cacheKey, relevant);
        return { tools: this.openRouterToolCache.get(cacheKey) || [], cacheKey };
    }
}

// Singleton instance
let mcpManagerInstance: MCPManager | null = null;

export function getMCPManager(): MCPManager {
    if (!mcpManagerInstance) {
        mcpManagerInstance = new MCPManager();
    }
    return mcpManagerInstance;
}
