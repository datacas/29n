import { defineStore } from 'pinia'

export interface SurveyState {
  selectedEntities: string[]
  answers: Record<string, number | null>
  weights: Record<string, 'low' | 'medium' | 'high'>
  currentQuestionIndex: number
  calibrationMode: 'serious' | 'quick' | 'skipped'
  calibrationWeights: Record<string, number>
}

export const useSurveyStore = defineStore('survey', {
  state: (): SurveyState => ({
    selectedEntities: [],
    answers: {},
    weights: {},
    currentQuestionIndex: 0,
    calibrationMode: 'skipped',
    calibrationWeights: {}
  }),

  actions: {
    setSelectedEntities(entities: string[]) {
      this.selectedEntities = entities
    },

    setAnswer(questionId: string, value: number | null) {
      this.answers[questionId] = value
    },

    setWeight(questionId: string, importance: 'low' | 'medium' | 'high') {
      this.weights[questionId] = importance
    },

    setCurrentQuestion(index: number) {
      this.currentQuestionIndex = index
    },

    setCalibration(mode: 'serious' | 'quick' | 'skipped', weights?: Record<string, number>) {
      this.calibrationMode = mode
      if (weights) this.calibrationWeights = weights
    },

    reset() {
      this.$reset()
    }
  }
})
