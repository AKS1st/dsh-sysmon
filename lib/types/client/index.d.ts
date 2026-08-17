/**
 * System Monitor browser half: a fixed bottom-right overlay that polls the
 * host route once per second and repaints one monospace line:
 *
 *     CPU 39%/16    MEM 46%    DISK 22%
 *
 * Default color is a quiet light gray; memory/disk above 80% turn orange and
 * above 90% red, CPU follows the lenient total-capacity scale (>=90% of all
 * cores orange, >=98% red). The overlay is click-through and never blocks the
 * app underneath; repaints update only the three value nodes.
 * @module dsh-sysmon/client
 */
/** The subset of the Cordis client context this plugin reads. */
interface ClientContext {
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
