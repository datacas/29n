<template>
  <div class="coverage-page">
    <div class="page-header">
      <h1>Matriz de cobertura</h1>
      <p>Cobertura documental por entidad y dimensión.</p>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="selectedEntity" @change="fetchCoverage">
        <option value="">Todas las entidades</option>
        <option v-for="entity in entities" :key="entity.id" :value="entity.id">
          {{ entity.name }}
        </option>
      </select>
    </div>

    <!-- Coverage matrix -->
    <div v-if="coverage.length" class="coverage-matrix">
      <table>
        <thead>
          <tr>
            <th>Entidad</th>
            <th v-for="dim in dimensions" :key="dim.code">{{ dim.name }}</th>
            <th>Total</th>
            <th>Cobertura</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in coverage" :key="row.entity_id">
            <td>{{ row.entity_name }}</td>
            <td v-for="dim in dimensions" :key="dim.code">
              <div class="coverage-cell">
                <span class="count">{{ getDimensionCount(row, dim.code) }}</span>
                <span class="total">/{{ getDimensionTotal(row, dim.code) }}</span>
              </div>
            </td>
            <td class="total-cell">{{ row.total_positions }}</td>
            <td>
              <div class="coverage-bar">
                <div
                  class="bar"
                  :style="{ width: row.coverage_pct + '%' }"
                  :class="coverageClass(row.coverage_pct)"
                ></div>
                <span class="pct">{{ row.coverage_pct }}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty-state">No hay datos de cobertura disponibles.</p>

    <!-- Warnings -->
    <div v-if="warnings.length" class="warnings">
      <h3>Advertencias de cobertura</h3>
      <ul>
        <li v-for="(warn, i) in warnings" :key="i">{{ warn }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const coverage = ref([])
const entities = ref([])
const dimensions = ref([])
const selectedEntity = ref('')

const warnings = computed(() => {
  const w = []
  for (const row of coverage.value) {
    if (row.coverage_pct < 20) {
      w.push(`${row.entity_name}: cobertura muy baja (${row.coverage_pct}%)`)
    } else if (row.coverage_pct < 50) {
      w.push(`${row.entity_name}: cobertura limitada (${row.coverage_pct}%)`)
    }
  }
  return w
})

function getDimensionCount(row, dimCode) {
  const dim = row.dimensions?.find(d => d.dimension_code === dimCode)
  return dim?.position_count || 0
}

function getDimensionTotal(row, dimCode) {
  const dim = row.dimensions?.find(d => d.dimension_code === dimCode)
  return dim?.question_count || 0
}

function coverageClass(pct) {
  if (pct < 20) return 'low'
  if (pct < 50) return 'medium'
  return 'high'
}

async function fetchEntities() {
  const res = await $fetch('/api/entities')
  entities.value = res
}

async function fetchDimensions() {
  const res = await $fetch('/api/dimensions')
  dimensions.value = res
}

async function fetchCoverage() {
  const params = {}
  if (selectedEntity.value) {
    params.entity_ids = selectedEntity.value
  }
  const res = await $fetch('/api/coverage', { query: params })
  coverage.value = res
}

onMounted(async () => {
  await Promise.all([fetchEntities(), fetchDimensions(), fetchCoverage()])
})
</script>

<style scoped>
.coverage-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
.filters {
  margin: 1rem 0;
}
.filters select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 0.5rem;
  border: 1px solid #ddd;
  text-align: center;
}
th {
  background: #f5f5f5;
}
.coverage-cell {
  display: inline;
}
.coverage-cell .count {
  font-weight: bold;
}
.coverage-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.bar {
  height: 16px;
  min-width: 2px;
  border-radius: 3px;
  background: #28a745;
}
.bar.low { background: #dc3545; }
.bar.medium { background: #ffc107; }
.bar.high { background: #28a745; }
.pct {
  font-size: 0.85rem;
  min-width: 3rem;
}
.warnings {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
}
.warnings ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.empty-state {
  text-align: center;
  color: #666;
  padding: 2rem;
}
</style>
