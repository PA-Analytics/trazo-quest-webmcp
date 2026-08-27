import { Firestore } from '@google-cloud/firestore'
import type { Quest, QuestProgress, QuestProposal } from '../../domain/quest.ts'
import { validateQuest } from '../../domain/questValidation.ts'
import {
  type IQuestRepository,
  ProposalNotFoundError,
  QuestNotFoundError,
  StaleQuestVersionError,
} from './questRepository.ts'

export class FirestoreQuestRepository implements IQuestRepository {
  private firestore: Firestore
  private collectionName = 'quests'

  constructor(firestoreOrOptions?: Firestore | { projectId?: string; databaseId?: string }) {
    if (firestoreOrOptions && 'collection' in firestoreOrOptions) {
      this.firestore = firestoreOrOptions
    } else {
      const projectId =
        firestoreOrOptions?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
      const databaseId = firestoreOrOptions?.databaseId || process.env.FIRESTORE_DATABASE_ID
      this.firestore = new Firestore({
        ...(projectId ? { projectId } : {}),
        ...(databaseId ? { databaseId } : {}),
        ignoreUndefinedProperties: true,
      })
    }
  }

  async createQuest(quest: Quest): Promise<Quest> {
    validateQuest(quest)
    const docRef = this.firestore.collection(this.collectionName).doc(quest.id)
    await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef)
      if (doc.exists) {
        throw new Error(`Quest "${quest.id}" already exists.`)
      }
      const clean = JSON.parse(JSON.stringify(quest))
      transaction.set(docRef, clean)
    })
    return structuredClone(quest)
  }

  async getQuest(id: string): Promise<Quest | null> {
    const doc = await this.firestore.collection(this.collectionName).doc(id).get()
    return doc.exists ? (doc.data() as Quest) : null
  }

  async updateQuest(
    id: string,
    expectedVersion: number,
    updater: (quest: Quest) => Quest
  ): Promise<Quest> {
    const docRef = this.firestore.collection(this.collectionName).doc(id)
    const updated = await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef)
      if (!doc.exists) {
        throw new QuestNotFoundError(id)
      }
      const current = doc.data() as Quest
      if (current.version !== expectedVersion) {
        throw new StaleQuestVersionError(id, expectedVersion, current.version)
      }
      const draft = structuredClone(current)
      const next = updater(draft)
      next.version = current.version + 1
      next.updatedAt = new Date().toISOString()
      validateQuest(next)

      const clean = JSON.parse(JSON.stringify(next))
      transaction.set(docRef, clean)
      return next
    })
    return structuredClone(updated)
  }

  async saveProgress(progress: QuestProgress): Promise<QuestProgress> {
    const docRef = this.firestore.collection(this.collectionName).doc(progress.questId)
    await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef)
      if (!doc.exists) {
        throw new QuestNotFoundError(progress.questId)
      }
      const quest = doc.data() as Quest
      quest.progress = structuredClone(progress)
      quest.updatedAt = new Date().toISOString()
      transaction.set(docRef, JSON.parse(JSON.stringify(quest)))
    })
    return structuredClone(progress)
  }

  async getProgress(questId: string): Promise<QuestProgress | null> {
    const quest = await this.getQuest(questId)
    return quest ? structuredClone(quest.progress) : null
  }

  async createProposal(proposal: QuestProposal): Promise<QuestProposal> {
    const docRef = this.firestore.collection(this.collectionName).doc(proposal.questId)
    await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef)
      if (!doc.exists) {
        throw new QuestNotFoundError(proposal.questId)
      }
      const quest = doc.data() as Quest
      quest.proposals = quest.proposals || []
      quest.proposals.push(structuredClone(proposal))
      quest.updatedAt = new Date().toISOString()
      transaction.set(docRef, JSON.parse(JSON.stringify(quest)))
    })
    return structuredClone(proposal)
  }

  async getProposal(questId: string, proposalId: string): Promise<QuestProposal | null> {
    const quest = await this.getQuest(questId)
    if (!quest) return null
    const proposal = (quest.proposals || []).find((p) => p.id === proposalId)
    return proposal ? structuredClone(proposal) : null
  }

  async updateProposalStatus(
    questId: string,
    proposalId: string,
    status: 'accepted' | 'rejected'
  ): Promise<QuestProposal> {
    const docRef = this.firestore.collection(this.collectionName).doc(questId)
    const updatedProp = await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef)
      if (!doc.exists) {
        throw new QuestNotFoundError(questId)
      }
      const quest = doc.data() as Quest
      const proposal = (quest.proposals || []).find((p) => p.id === proposalId)
      if (!proposal) {
        throw new ProposalNotFoundError(questId, proposalId)
      }
      proposal.status = status
      proposal.decidedAt = new Date().toISOString()
      quest.updatedAt = new Date().toISOString()
      transaction.set(docRef, JSON.parse(JSON.stringify(quest)))
      return proposal
    })
    return structuredClone(updatedProp)
  }
}
