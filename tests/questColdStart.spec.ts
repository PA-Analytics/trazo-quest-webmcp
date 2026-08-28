import { expect, test, type Page } from '@playwright/test'

const timestamp = '2026-08-27T00:00:00.000Z'

const quest = {
  id: 'quest-cold-start',
  version: 1,
  goal: {
    rawPrompt: 'Analizar la inflación mexicana con datos reales',
    targetOutcome: 'Análisis de inflación mexicana',
  },
  entryNodeIds: ['M1'],
  missions: [
    {
      id: 'M1',
      title: 'Recolectar datos INPC',
      description: 'Obtén una serie oficial del INPC.',
      nodeType: 'normal',
      mapRole: 'entry',
      position: { x: 0, y: 0 },
      prerequisites: [],
      evidenceType: 'text',
      evidencePrompt: 'Comparte la fuente y el rango temporal.',
      evaluationContract: {
        type: 'rubric',
        description: 'La evidencia usa una fuente oficial y fechas explícitas.',
      },
    },
    {
      id: 'M2',
      title: 'Comparar periodos',
      description: 'Compara dos periodos sin dependencias previas.',
      nodeType: 'optional',
      position: { x: 260, y: 140 },
      prerequisites: [],
      evidenceType: 'text',
      evidencePrompt: 'Comparte la comparación.',
      evaluationContract: {
        type: 'rubric',
        description: 'La comparación usa periodos explícitos.',
      },
    },
  ],
  edges: [],
  proposals: [],
  progress: {
    questId: 'quest-cold-start',
    completedMissionIds: [],
    activeMissionId: 'M1',
    artifacts: {},
    updatedAt: timestamp,
  },
  createdAt: timestamp,
  updatedAt: timestamp,
}

async function installColdBrowserState(page: Page, activeQuestId?: string) {
  await page.addInitScript((questId) => {
    localStorage.clear()
    if (questId) localStorage.setItem('trazo_active_quest_id', questId)

    const registeredTools = new Map<string, unknown>()
    ;(window as typeof window & { __trazoTools: Map<string, unknown> }).__trazoTools = registeredTools
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool: { name: string }, options?: { signal?: AbortSignal }) {
          registeredTools.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => {
            if (registeredTools.get(tool.name) === tool) registeredTools.delete(tool.name)
          })
        },
      },
    })

    const legacySelector = '.entry-shell,.coach-entry-shell,.setup-shell,.calibration-shell,[data-testid="profile-switcher"]'
    const legacyText = [
      '¿Cómo quieres que te llamemos?',
      'Elige tu ruta.',
      'Configura cómo se juzga el trabajo.',
      'Enséñale a TRAZO cómo evalúas.',
      'Cuéntame cómo quieres recorrerlo.',
    ]
    ;(window as typeof window & { __legacyRendered: boolean }).__legacyRendered = false
    new MutationObserver(() => {
      const text = document.body?.textContent ?? ''
      if (document.querySelector(legacySelector) || legacyText.some((value) => text.includes(value))) {
        ;(window as typeof window & { __legacyRendered: boolean }).__legacyRendered = true
      }
    }).observe(document, { childList: true, subtree: true })
  }, activeQuestId)
}

async function expectNoLegacyRender(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __legacyRendered: boolean }
  ).__legacyRendered)).toBe(false)
  await expect(page.locator('.entry-shell,.coach-entry-shell,.setup-shell,.calibration-shell,[data-testid="profile-switcher"]')).toHaveCount(0)
}

test('fresh storage renders the empty Quest world without legacy onboarding', async ({ page }) => {
  await installColdBrowserState(page)
  await page.goto('/')

  await expect(page.getByLabel('Lienzo del mapa de misiones')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu ruta empieza aquí' })).toBeVisible()
  await expect(page.locator('.quest-node-shell')).toHaveCount(0)
  await expectNoLegacyRender(page)
})

test('fresh storage registers all five WebMCP tools before interaction', async ({ page }) => {
  await installColdBrowserState(page)
  await page.goto('/')

  await expect.poll(() => page.evaluate(() => Array.from((
    window as typeof window & { __trazoTools: Map<string, unknown> }
  ).__trazoTools.keys()).sort())).toEqual([
    'create_quest',
    'focus_mission',
    'get_quest_state',
    'propose_quest_change',
    'submit_evidence',
  ])
  const createToolDefinition = await page.evaluate(() => JSON.stringify((
    window as typeof window & { __trazoTools: Map<string, unknown> }
  ).__trazoTools.get('create_quest')))
  expect(createToolDefinition).toContain('rubricCriteria')
  expect(createToolDefinition).toContain('deterministicRules')
  await expectNoLegacyRender(page)
})

test('create_quest from cold state persists and paints the graph without reload', async ({ page }) => {
  await installColdBrowserState(page)
  let createRequests = 0
  let legacyImplementationRequests = 0
  await page.route('**/api/v1/quests', async (route) => {
    createRequests += 1
    await route.fulfill({ json: quest })
  })
  await page.route('**/api/v1/implementations/**', async (route) => {
    legacyImplementationRequests += 1
    await route.abort()
  })
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as typeof window & { __coldStartSentinel?: string }).__coldStartSentinel = 'same-document'
  })

  const result = await page.evaluate(async () => {
    const tools = (window as typeof window & {
      __trazoTools: Map<string, { execute: (input: unknown) => Promise<unknown> }>
    }).__trazoTools
    return tools.get('create_quest')?.execute({
      goal: {
        rawPrompt: 'Analizar la inflación mexicana con datos reales',
        targetOutcome: 'Análisis de inflación mexicana',
      },
      missions: [],
    })
  })

  expect(result).toMatchObject({ ok: true, questId: quest.id })
  expect(result).toMatchObject({
    missions: expect.arrayContaining([
      expect.objectContaining({ id: 'M2', status: 'available' }),
    ]),
  })
  expect(createRequests).toBe(1)
  expect(legacyImplementationRequests).toBe(0)
  await expect(page.getByRole('button', { name: /Recolectar datos INPC/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu ruta empieza aquí' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('trazo_active_quest_id'))).toBe(quest.id)
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __coldStartSentinel?: string }
  ).__coldStartSentinel)).toBe('same-document')
  await expectNoLegacyRender(page)
})

test('stored active Quest restores directly into the map', async ({ page }) => {
  await installColdBrowserState(page, 'quest-restored')
  await page.route('**/api/v1/quests/quest-restored', async (route) => {
    await route.fulfill({ json: { ...quest, id: 'quest-restored', progress: { ...quest.progress, questId: 'quest-restored' } } })
  })
  await page.goto('/')

  await expect(page.getByRole('button', { name: /Recolectar datos INPC/ })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('trazo_active_quest_id'))).toBe('quest-restored')
  await expectNoLegacyRender(page)
})

test('stale stored Quest is cleared and returns to the empty Quest world', async ({ page }) => {
  await installColdBrowserState(page, 'quest-missing')
  await page.route('**/api/v1/quests/quest-missing', async (route) => {
    await route.fulfill({ status: 404, json: { code: 'QUEST_NOT_FOUND' } })
  })
  await page.goto('/')

  await expect.poll(() => page.evaluate(() => localStorage.getItem('trazo_active_quest_id'))).toBeNull()
  await expect(page.getByRole('heading', { name: 'Tu ruta empieza aquí' })).toBeVisible()
  await expect(page.locator('.quest-node-shell')).toHaveCount(0)
  await expectNoLegacyRender(page)
})

test('Quest cold start exposes no Programs surfaces or wording', async ({ page }) => {
  await installColdBrowserState(page)
  await page.goto('/')

  await expectNoLegacyRender(page)
  for (const wording of [
    '¿Cómo quieres que te llamemos?',
    'Elige tu ruta.',
    'Configura cómo se juzga el trabajo.',
    'Enséñale a TRAZO cómo evalúas.',
    'Cuéntame cómo quieres recorrerlo.',
  ]) {
    await expect(page.getByText(wording, { exact: true })).toHaveCount(0)
  }
})
