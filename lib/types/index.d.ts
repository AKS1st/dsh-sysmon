/**
 * System Monitor host half: registers one `GET` route that samples the system
 * once per request. The browser overlay polls it every second. The route
 * carries no session state, so any origin request gets the same fresh sample.
 * @module @dsh-external/dsh-sysmon
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseSysInfoOutput } from './collect.ts';
/** The subset of the Cordis host context this plugin reads. */
interface HostContext {
    webServer: {
        register(route: {
            kind: 'exact';
            path: string;
            handler(req: IncomingMessage, res: ServerResponse): Promise<void> | void;
        }): () => void;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
export declare function apply(ctx: HostContext): void;
export { parseSysInfoOutput };
