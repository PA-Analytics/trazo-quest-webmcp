import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Quest, QuestProgress, QuestProposal } from '../../domain/quest.ts'
import { validateQuest } from '../../domain/questValidation.ts'
import { FirestoreQuestRepository } from './firestoreQuestRepository.ts'
import { getStorageBackendType, type StorageBackendType } from '../repository.ts'

export class StaleQuestVersionError extends Error {
  readonly code = 'STALE_QUEST_VERSION'
  readonly expectedVersion: number
  readonly currentVersion: number

  constructor(questId: string, expectedVersion: number, currentVersion: number) {
    super(
      `[StaleQuestVersionError] Quest "${questId}" update rejected: expected version ${expectedVersion}, but current version is ${currentVersion}.`
    )
    this.name = 'StaleQuestVersionError'
    this.expectedVersion = expectedVersion
    this.currentVersion = currentVersion
  }
}

export class QuestNotFoundError extends Error {
  readonly code = 'QUEST_NOT_FOUND'

  constructor(questId: string) {
    super(`[QuestNotFoundError] Quest "${questId}" was not found.`)
    this.name = 'QuestNotFoundError'
  }
}

export class ProposalNotFoundError extends Error {
  readonly code = 'PROPOSAL_NOT_FOUND'

  constructor(questId: string, proposalId: string) {
    super(`[ProposalNotFoundError] Proposal "${proposalId}" for Quest "${questId}" was not found.`)
    this.name = 'ProposalNotFoundError'
  }
}

export interface IQuestRepository {
  createQuest(quest: Quest): Promise<Quest>
  getQuest(id: string): Promise<Quest | null>
  updateQuest(id: string, expectedVersion: number, updater: (quest: Quest) => Quest): Promise<Quest>
  saveProgress(progress: QuestProgress): Promise<QuestProgress>
  getProgress(questId: string): Promise<QuestProgress | null>
  createProposal(proposal: QuestProposal): Promise<QuestProposal>
  getProposal(questId: string, proposalId: string): Promise<QuestProposal | null>
  updateProposalStatus(
    questId: string,
    proposalId: string,
    status: 'accepted' | 'rejected'
  ): Promise<QuestProposal>
}

// ─── MEMORY QUEST REPOSITORY ────────────────────────────────────────────────
export class MemoryQuestRepository implements IQuestRepository {
  private quests = new Map<string, Quest>()
  private progresses = new Map<string, QuestProgress>()
  private locks = new Map<string, Promise<void>>()

  private clone<T>(val: T): T {
    return structuredClone(val)
  }

  private async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(key) ?? Promise.resolve()
    let release: () => void
    const nextLock = new Promise<void>((resolve) => {
      release = resolve
    })
    this.locks.set(key, currentLock.then(() => nextLock))

    try {
      await currentLock
      return await fn()
    } finally {
      release!()
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key)
      }
    }
  }

  async createQuest(quest: Quest): Promise<Quest> {
    validateQuest(quest)
    return this.runExclusive(quest.id, async () => {
      const existing = this.quests.get(quest.id)
      if (existing) {
        throw new Error(`Quest "${quest.id}" already exists.`)
      }
      const record = this.clone(quest)
      this.quests.set(quest.id, record)
      return this.clone(record)
    })
  }

  async getQuest(id: string): Promise<Quest | null> {
    const quest = this.quests.get(id)
    return quest ? this.clone(quest) : null
  }

  async updateQuest(
    id: string,
    expectedVersion: number,
    updater: (quest: Quest) => Quest
  ): Promise<Quest> {
    return this.runExclusive(id, async () => {
      const existing = this.quests.get(id)
      if (!existing) {
        throw new QuestNotFoundError(id)
      }

      if (existing.version !== expectedVersion) {
        throw new StaleQuestVersionError(id, expectedVersion, existing.version)
      }

      const draft = this.clone(existing)
      const updated = updater(draft)
      updated.version = existing.version + 1
      updated.updatedAt = new Date().toISOString()
      validateQuest(updated)

      this.quests.set(id, this.clone(updated))
      return this.clone(updated)
    })
  }

  async saveProgress(progress: QuestProgress): Promise<QuestProgress> {
    return this.runExclusive(`progress:${progress.questId}`, async () => {
      const record = this.clone(progress)
      record.updatedAt = new Date().toISOString()
      this.progresses.set(progress.questId, record)
      return this.clone(record)
    })
  }

  async getProgress(questId: string): Promise<QuestProgress | null> {
    const progress = this.progresses.get(questId)
    return progress ? this.clone(progress) : null
  }

  async createProposal(proposal: QuestProposal): Promise<QuestProposal> {
    return this.runExclusive(proposal.questId, async () => {
      const quest = this.quests.get(proposal.questId)
      if (!quest) {
        throw new QuestNotFoundError(proposal.questId)
      }
      const record = this.clone(proposal)
      quest.proposals.push(this.clone(record))
      quest.updatedAt = new Date().toISOString()
      return this.clone(record)
    })
  }

  async getProposal(questId: string, proposalId: string): Promise<QuestProposal | null> {
    const quest = this.quests.get(questId)
    if (!quest) return null
    const proposal = quest.proposals.find((p) => p.id === proposalId)
    return proposal ? this.clone(proposal) : null
  }

  async updateProposalStatus(
    questId: string,
    proposalId: string,
    status: 'accepted' | 'rejected'
  ): Promise<QuestProposal> {
    return this.runExclusive(questId, async () => {
      const quest = this.quests.get(questId)
      if (!quest) {
        throw new QuestNotFoundError(questId)
      }
      const proposal = quest.proposals.find((p) => p.id === proposalId)
      if (!proposal) {
        throw new ProposalNotFoundError(questId, proposalId)
      }
      proposal.status = status
      proposal.decidedAt = new Date().toISOString()
      quest.updatedAt = new Date().toISOString()
      return this.clone(proposal)
    })
  }

  getAllQuests(): Quest[] {
    return Array.from(this.quests.values()).map((q) => this.clone(q))
  }

  getAllProgresses(): QuestProgress[] {
    return Array.from(this.progresses.values()).map((p) => this.clone(p))
  }
}

// ─── FILE STORAGE QUEST REPOSITORY ──────────────────────────────────────────
export class FileStorageQuestRepository implements IQuestRepository {
  private questsPath: string
  private progressPath: string
  private memory = new MemoryQuestRepository()
  private initialized = false
  private ioLock = Promise.resolve()

  constructor(baseDir = '.data') {
    this.questsPath = join(baseDir, 'quests.json')
    this.progressPath = join(baseDir, 'quest_progress.json')
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    await mkdir(dirname(this.questsPath), { recursive: true })

    try {
      const rawQuests = await readFile(this.questsPath, 'utf8')
      const parsedQuests = JSON.parse(rawQuests) as Record<string, Quest>
      for (const quest of Object.values(parsedQuests)) {
        await this.memory.createQuest(quest)
      }
    } catch {
      // Clean install / empty file
    }

    try {
      const rawProgress = await readFile(this.progressPath, 'utf8')
      const parsedProgress = JSON.parse(rawProgress) as Record<string, QuestProgress>
      for (const progress of Object.values(parsedProgress)) {
        await this.memory.saveProgress(progress)
      }
    } catch {
      // Clean install
    }

    this.initialized = true
  }

  private async persist(): Promise<void> {
    this.ioLock = this.ioLock.then(async () => {
      const quests = this.memory.getAllQuests()
      const questsMap: Record<string, Quest> = {}
      for (const q of quests) {
        questsMap[q.id] = q
      }

      const progresses = this.memory.getAllProgresses()
      const progressMap: Record<string, QuestProgress> = {}
      for (const p of progresses) {
        progressMap[p.questId] = p
      }

      const atomicWrite = async (path: string, data: unknown) => {
        const tempPath = `${path}.tmp.${Date.now()}`
        await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
        await rename(tempPath, path)
      }

      try {
        await atomicWrite(this.questsPath, questsMap)
        await atomicWrite(this.progressPath, progressMap)
      } catch (err) {
        console.error('[FileStorageQuestRepository] Failed to persist state:', err)
      }
    })
  }

  async createQuest(quest: Quest): Promise<Quest> {
    await this.ensureInitialized()
    const created = await this.memory.createQuest(quest)
    await this.persist()
    return created
  }

  async getQuest(id: string): Promise<Quest | null> {
    await this.ensureInitialized()
    return this.memory.getQuest(id)
  }

  async updateQuest(
    id: string,
    expectedVersion: number,
    updater: (quest: Quest) => Quest
  ): Promise<Quest> {
    await this.ensureInitialized()
    const updated = await this.memory.updateQuest(id, expectedVersion, updater)
    await this.persist()
    return updated
  }

  async saveProgress(progress: QuestProgress): Promise<QuestProgress> {
    await this.ensureInitialized()
    const saved = await this.memory.saveProgress(progress)
    await this.persist()
    return saved
  }

  async getProgress(questId: string): Promise<QuestProgress | null> {
    await this.ensureInitialized()
    return this.memory.getProgress(questId)
  }

  async createProposal(proposal: QuestProposal): Promise<QuestProposal> {
    await this.ensureInitialized()
    const created = await this.memory.createProposal(proposal)
    await this.persist()
    return created
  }

  async getProposal(questId: string, proposalId: string): Promise<QuestProposal | null> {
    await this.ensureInitialized()
    return this.memory.getProposal(questId, proposalId)
  }

  async updateProposalStatus(
    questId: string,
    proposalId: string,
    status: 'accepted' | 'rejected'
  ): Promise<QuestProposal> {
    await this.ensureInitialized()
    const updated = await this.memory.updateProposalStatus(questId, proposalId, status)
    await this.persist()
    return updated
  }
}

export function createQuestRepository(backendType?: StorageBackendType): IQuestRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') {
    return new FirestoreQuestRepository()
  }
  if (selected === 'memory') {
    return new MemoryQuestRepository()
  }
  return new FileStorageQuestRepository()
}

