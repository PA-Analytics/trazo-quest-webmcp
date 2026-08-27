import { useEffect, useRef } from 'react'

export interface WebMCPToolInputSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
  destructive?: boolean
}

export interface UseWebMCPToolOptions<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string
  description: string
  inputSchema: WebMCPToolInputSchema
  annotations?: WebMCPToolAnnotations
  execute: (input: TInput) => Promise<TOutput> | TOutput
  enabled?: boolean
}

export function useWebMCPTool<TInput = Record<string, unknown>, TOutput = unknown>({
  name,
  description,
  inputSchema,
  annotations,
  execute,
  enabled = true,
}: UseWebMCPToolOptions<TInput, TOutput>): void {
  const executeRef = useRef(execute)
  executeRef.current = execute

  useEffect(() => {
    if (typeof document === 'undefined' || !enabled) return

    // Ensure document.modelContext exists (native in Chrome/ChatGPT or minimal polyfill container)
    if (!(document as any).modelContext) {
      const toolRegistry: any[] = []
      ;(document as any).modelContext = {
        registerTool: (toolDef: any, options?: { signal?: AbortSignal }) => {
          toolRegistry.push(toolDef)
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const idx = toolRegistry.indexOf(toolDef)
              if (idx !== -1) toolRegistry.splice(idx, 1)
            })
          }
          return {
            unregister: () => {
              const idx = toolRegistry.indexOf(toolDef)
              if (idx !== -1) toolRegistry.splice(idx, 1)
            },
          }
        },
        getRegisteredTools: () => [...toolRegistry],
      }
    }

    const modelContext = (document as any).modelContext ?? (navigator as any).modelContext
    if (!modelContext?.registerTool) return

    const controller = new AbortController()

    try {
      modelContext.registerTool(
        {
          name,
          description,
          inputSchema,
          annotations,
          execute: async (input: TInput) => {
            return await executeRef.current(input)
          },
        },
        { signal: controller.signal }
      )
    } catch (err) {
      console.warn(`[WebMCP] Failed to register tool "${name}":`, err)
    }

    return () => {
      controller.abort()
    }
  }, [name, description, JSON.stringify(inputSchema), JSON.stringify(annotations), enabled])
}
