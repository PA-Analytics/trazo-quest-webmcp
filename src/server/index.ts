import * as http from 'node:http'
import { createRequestListener } from './app.ts'
import {
  createAutonomyAuditRepository,
  createCalibrationRepository,
  createImplementationRepository,
  createProfileRepository,
  createMethodologyRepository,
} from './repository.ts'
import { resolvePack } from '../data/packs/index.ts'
import { CalibrationService } from './calibrationService.ts'
import { IdentityService } from './identityService.ts'
import { ImplementationService } from './service.ts'
import { MethodologyService } from './methodologyService.ts'
import { AutonomyService } from './autonomy/autonomyService.ts'
import { GeminiAutonomyReasoner } from './autonomy/geminiReasoner.ts'
import { createCanonicalGeminiRuntime } from './ai/runtime.ts'

import { createQuestRepository } from './quest/questRepository.ts'
import { QuestService } from './quest/questService.ts'
import { QuestEvaluator } from './quest/questEvaluator.ts'

const port = Number(process.env.PORT || 3001)
const host = '0.0.0.0'
const defaultCourseId = process.env.TRAZO_ACTIVE_PACK?.trim() || undefined
if (defaultCourseId) {
  resolvePack(defaultCourseId)
}
const repository = createImplementationRepository()
const calibrationRepository = createCalibrationRepository()
const methodologyRepository = createMethodologyRepository()
const methodologyService = new MethodologyService(methodologyRepository, calibrationRepository)
const autonomyAuditRepository = createAutonomyAuditRepository()
const service = new ImplementationService(repository, calibrationRepository, methodologyService)
const calibrationService = new CalibrationService(calibrationRepository)
const identityService = new IdentityService(createProfileRepository(), service, defaultCourseId)
const geminiRuntime = createCanonicalGeminiRuntime()
const autonomyService = new AutonomyService(
  service,
  repository,
  autonomyAuditRepository,
  new GeminiAutonomyReasoner(geminiRuntime),
  methodologyService,
)
const questRepository = createQuestRepository()
const questEvaluator = new QuestEvaluator(geminiRuntime)
const questService = new QuestService(questRepository, questEvaluator)

const requestListener = createRequestListener(service, {
  calibrationService,
  identityService,
  autonomyService,
  autonomyAuditRepository,
  methodologyService,
  questService,
})

const server = http.createServer(requestListener)

server.listen(port, host, () => {
  console.log(`[TRAZO Backend] Server listening on http://${host}:${port}`)
  console.log(`[TRAZO Backend] Authoritative Persistence: ${repository.constructor.name}`)
})

export {
  server,
  service,
  repository,
  autonomyService,
  autonomyAuditRepository,
  methodologyService,
  questService,
  questRepository,
  questEvaluator,
}


