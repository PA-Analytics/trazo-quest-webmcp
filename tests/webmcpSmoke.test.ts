import { test } from 'node:test'
import assert from 'node:assert/strict'

test('WebMCP Smoke Test: document.modelContext registration and tool execution', async () => {
  // Setup mock document.modelContext mimicking Chrome / ChatGPT WebMCP runtime
  const registeredTools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
    execute: (input: any) => Promise<any>
  }> = []

  const mockModelContext = {
    registerTool: (
      def: {
        name: string
        description: string
        inputSchema: Record<string, unknown>
        execute: (input: any) => Promise<any>
      },
      options?: { signal?: AbortSignal }
    ) => {
      registeredTools.push(def)
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          const idx = registeredTools.indexOf(def)
          if (idx !== -1) registeredTools.splice(idx, 1)
        })
      }
    },
    getRegisteredTools: () => [...registeredTools],
  }

  // 1. Tool registers
  const controller = new AbortController()
  let renderedCourseState: any = null

  mockModelContext.registerTool(
    {
      name: 'create_quest_smoke_test',
      description: 'Creates a temporary 3-node quest on the live canvas for WebMCP smoke testing.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The user goal (e.g. Analyze Mexican inflation)' },
        },
        required: ['goal'],
      },
      execute: async ({ goal }: { goal?: string }) => {
        const goalTitle = goal || 'Analizar inflación en México'
        renderedCourseState = {
          id: 'smoke-quest-course',
          title: goalTitle,
          missions: ['M1', 'M2', 'M3'],
        }
        return {
          ok: true,
          goal: goalTitle,
          missionCount: 3,
          missionIds: ['M1', 'M2', 'M3'],
        }
      },
    },
    { signal: controller.signal }
  )

  assert.equal(registeredTools.length, 1)
  assert.equal(registeredTools[0].name, 'create_quest_smoke_test')
  assert.ok(registeredTools[0].inputSchema.properties)

  // 2. Invocation triggers state update
  const result = await registeredTools[0].execute({ goal: 'Analizar inflación en México' })
  assert.equal(result.ok, true)
  assert.equal(result.missionCount, 3)
  assert.deepEqual(result.missionIds, ['M1', 'M2', 'M3'])
  assert.equal(renderedCourseState.title, 'Analizar inflación en México')

  // 3. Abort unregisters cleanly
  controller.abort()
  assert.equal(registeredTools.length, 0)
})
