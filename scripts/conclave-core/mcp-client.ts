// scripts/conclave-core/mcp-client.ts
// Minimal MCP client over stdio (JSON-RPC 2.0, newline-delimited).
// Reusable for any MCP server we want to consume.

import type { Subprocess } from "bun";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string };
}

export class McpClient {
	private proc: Subprocess<"pipe", "pipe", "pipe">;
	private nextId = 1;
	private pending = new Map<number, (r: JsonRpcResponse) => void>();
	private buffer = "";
	private initialized = false;

	constructor(cmd: string[]) {
		this.proc = Bun.spawn({
			cmd,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		}) as Subprocess<"pipe", "pipe", "pipe">;
		this.readLoop().catch(() => {});
	}

	private async readLoop(): Promise<void> {
		const reader = this.proc.stdout.getReader();
		const decoder = new TextDecoder();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			this.buffer += decoder.decode(value, { stream: true });
			let nl: number = this.buffer.indexOf("\n");
			while (nl !== -1) {
				const line = this.buffer.slice(0, nl).trim();
				this.buffer = this.buffer.slice(nl + 1);
				nl = this.buffer.indexOf("\n");
				if (!line) continue;
				try {
					const msg = JSON.parse(line) as JsonRpcResponse;
					if (typeof msg.id === "number" && this.pending.has(msg.id)) {
						const handler = this.pending.get(msg.id);
						if (handler) handler(msg);
						this.pending.delete(msg.id);
					}
					// notifications/events are ignored in v1
				} catch {
					// non-JSON output, ignore
				}
			}
		}
	}

	async initialize(clientInfo: { name: string; version: string }): Promise<void> {
		if (this.initialized) return;
		await this.request("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo,
		});
		this.notify("notifications/initialized");
		this.initialized = true;
	}

	async listTools(): Promise<{ name: string }[]> {
		const r = await this.request("tools/list");
		const result = r.result as { tools?: { name: string }[] } | undefined;
		return result?.tools ?? [];
	}

	async callTool(name: string, args: unknown, timeoutMs = 600000): Promise<unknown> {
		const r = await this.request("tools/call", { name, arguments: args }, timeoutMs);
		if (r.error) throw new Error(`tool ${name} error: ${r.error.message}`);
		return r.result;
	}

	private request(method: string, params?: unknown, timeoutMs = 60000): Promise<JsonRpcResponse> {
		const id = this.nextId++;
		const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
		return new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`mcp request timeout: ${method}`));
			}, timeoutMs);
			this.pending.set(id, (r) => {
				clearTimeout(t);
				resolve(r);
			});
			this.proc.stdin.write(`${JSON.stringify(req)}\n`);
		});
	}

	private notify(method: string, params?: unknown): void {
		this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
	}

	close(): void {
		try {
			this.proc.kill();
		} catch {
			// already dead, ignore
		}
	}
}
