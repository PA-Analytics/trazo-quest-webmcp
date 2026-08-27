import type { Chapter, Course, Mission, MissionEdge, MissionProgress, ProgressState } from '../domain/course.ts'
import type { Quest, QuestMission } from '../domain/quest.ts'

export interface QuestMapViewModel {
  course: Course
  chapter: Chapter
  progress: MissionProgress
  activeMissionId?: string
}

export function deriveQuestProgressStates(quest: Quest): Record<string, ProgressState> {
  const completedSet = new Set(quest.progress?.completedMissionIds || [])
  const activeId = quest.progress?.activeMissionId
  const result: Record<string, ProgressState> = {}

  for (const mission of quest.missions) {
    if (completedSet.has(mission.id)) {
      result[mission.id] = 'completed'
    } else if (mission.id === activeId) {
      result[mission.id] = 'active'
    } else if (
      !mission.prerequisites ||
      mission.prerequisites.length === 0 ||
      mission.prerequisites.every((prereq) => completedSet.has(prereq))
    ) {
      result[mission.id] = 'available'
    } else {
      result[mission.id] = 'locked'
    }
  }

  return result
}

export function adaptQuestToMap(quest: Quest): QuestMapViewModel {
  const progress = deriveQuestProgressStates(quest)

  const missions: Mission[] = quest.missions.map((qm: QuestMission) => ({
    id: qm.id,
    title: qm.title,
    nodeType: qm.nodeType,
    mapRole: qm.mapRole,
    mapSubtitle: qm.mapSubtitle,
    position: qm.position,
    description: qm.description,
    prerequisites: qm.prerequisites,
    evidenceType: qm.evidenceType || 'text',
    evidencePrompt: qm.evidencePrompt,
    evidenceCriteria: qm.evidenceCriteria || qm.evaluationContract?.description || '',
    producesArtifacts: qm.producesArtifacts,
    consumesArtifacts: qm.consumesArtifacts,
    progressState: progress[qm.id] || 'locked',
  }))

  const edges: MissionEdge[] = quest.edges.map((qe) => ({
    id: qe.id,
    source: qe.source,
    target: qe.target,
    optional: qe.optional,
    via: qe.via,
  }))

  const chapter: Chapter = {
    id: 'quest_chapter_main',
    title: quest.goal.targetOutcome || quest.goal.rawPrompt || 'Recorrido Quest',
    shortTitle: 'Misiones',
    mapPromise: quest.goal.rawPrompt,
    missions,
    edges,
  }

  const course: Course = {
    id: quest.id,
    title: quest.goal.targetOutcome || 'TRAZO Quest',
    chapters: [chapter],
  }

  return {
    course,
    chapter,
    progress,
    activeMissionId: quest.progress?.activeMissionId,
  }
}
