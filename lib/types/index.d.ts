/**
 * System Monitor host half: a background sampler refreshes the cached system
 * snapshot once per second, and one `GET` route serves that cached value — no
 * per-request subprocess, so a flood of requests cannot amplify sampling. The
 * route rejects non-GET methods and cross-origin browsers, so a rogue page
 * cannot read host telemetry either.
 * @module dsh-sysmon
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** The subset of the Cordis host context this plugin reads. */
interface HostContext {
    webServer: {
        register(route: {
            kind: 'exact';
            path: string;
            handler(req: IncomingMessage, res: ServerResponse): Promise<void> | void;
        }): () => void;
    };
    shell: {
        resolve(request: {
            command: string;
            timeoutMs?: number;
            stdoutMaxBytes?: number;
        }): unknown;
        run(spec: unknown): Promise<{
            exitCode: number | null;
            stdout: {
                text: string;
            };
        }>;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
export declare function apply(ctx: HostContext): void;
export {};
