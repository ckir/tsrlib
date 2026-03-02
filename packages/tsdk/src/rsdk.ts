/**
 * @file packages/tsdk/src/rsdk.ts
 * @description Class-based wrapper for the native Rust SDK bindings.
 */

import { nativeBinding } from './rsdk-loader.js';

/**
 * RSdk Class
 * Manages the connection to the native Rust layer via FFI.
 */
export class RSdk {
  /**
   * The underlying native binding loaded via NAPI-RS.
   * @private
   */
  private binding: any;

  constructor() {
    // Initialized from the environment-aware loader
    this.binding = nativeBinding;
  }

  /**
   * Maintains compatibility with internal FFI calls.
   * @param method - The name of the Rust function to call.
   * @param params - The arguments to pass.
   */
  public async callInternal(method: string, params: any): Promise<any> {
    if (!this.binding || typeof this.binding[method] !== 'function') {
      throw new Error(`[RSdk] Method '${method}' not found or native binding not loaded.`);
    }
    
    try {
      return await this.binding[method](params);
    } catch (err) {
      console.error(`[RSdk] Error calling native method ${method}:`, err);
      throw err;
    }
  }

  /**
   * Directly exposes the binding for advanced internal use cases.
   */
  public getNativeBinding(): any {
    return this.binding;
  }
}