<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand" aria-hidden="true">A</div>
      <h1>{{ $t('admin.login.title') }}</h1>
      <p class="login-lead">Acceso restringido al administrador.</p>

      <form v-if="!codeSent" class="step" @submit.prevent="requestCode">
        <label for="email">{{ $t('admin.login.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="nombre@dominio.es"
          :disabled="loading"
          required
          autofocus
        />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" class="primary" :disabled="loading || !email.trim()">
          {{ loading ? $t('common.loading') : $t('admin.login.requestCode') }}
        </button>
      </form>

      <form v-else class="step" @submit.prevent="verifyCode">
        <p class="login-help">{{ $t('admin.login.enterCode') }}</p>
        <div v-if="mockCode" class="mock-code">
          <span>Código de desarrollo</span>
          <strong>{{ mockCode }}</strong>
        </div>
        <label for="code">{{ $t('admin.login.code') }}</label>
        <input
          id="code"
          v-model="otpCode"
          class="code-input"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="[0-9]{6}"
          :disabled="loading"
          required
        />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" class="primary" :disabled="loading || otpCode.length !== 6">
          {{ loading ? $t('common.loading') : $t('admin.login.verifyCode') }}
        </button>
        <button type="button" class="secondary" :disabled="loading" @click="reset">{{ $t('common.back') }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: ['admin-guest']
})

const email = ref('')
const otpCode = ref('')
const codeSent = ref(false)
const loading = ref(false)
const error = ref('')
const attemptToken = ref('')
const mockCode = ref('')

async function requestCode() {
  const trimmed = email.value.trim()
  if (!trimmed) return
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ success: boolean; attemptToken?: string; isMock?: boolean; code?: string }>('/api/auth/request-otp', {
      method: 'POST',
      body: { email: trimmed }
    })
    if (data?.success) {
      codeSent.value = true
      if (data.attemptToken) {
        attemptToken.value = data.attemptToken
      }
      if (data.isMock && data.code) {
        mockCode.value = data.code
        otpCode.value = data.code
      }
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || e?.message || 'Error al solicitar código'
  } finally {
    loading.value = false
  }
}

async function verifyCode() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ success: boolean }>('/api/auth/verify-otp', {
      method: 'POST',
      body: { code: otpCode.value, attemptToken: attemptToken.value }
    })
    if (data?.success) {
      useAdminStore().setAuthenticated('cookie')
      await navigateTo('/admin')
    } else {
      error.value = 'Código incorrecto'
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || e?.message || 'Error al verificar código'
  } finally {
    loading.value = false
  }
}

function reset() {
  codeSent.value = false
  otpCode.value = ''
  error.value = ''
  attemptToken.value = ''
  mockCode.value = ''
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.login-brand {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 1.25rem;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.login-lead {
  margin: 0.25rem 0 1.5rem;
  color: var(--ink-3);
  font-size: 0.875rem;
}

.login-help {
  margin: 0;
  color: var(--ink-2);
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}

input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

input:hover:not(:disabled) {
  border-color: #aab1bf;
}

input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
  border-color: var(--accent);
}

input:disabled {
  background: var(--sunken);
}

.code-input {
  font-size: 1.5rem;
  letter-spacing: 0.4em;
  text-align: center;
}

button {
  min-height: 40px;
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font: inherit;
  font-weight: 550;
  cursor: pointer;
  transition: background-color 0.15s ease-out;
}

button.primary {
  background: var(--accent);
  color: #fff;
}

button.primary:hover:not(:disabled) {
  background: var(--accent-ink);
}

button.secondary {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--ink);
}

button.secondary:hover:not(:disabled) {
  background: var(--sunken);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--bad-tint);
  color: var(--bad);
  font-size: 0.875rem;
}

.mock-code {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-radius: 6px;
  background: var(--warn-tint);
  color: var(--warn);
  font-size: 0.8125rem;
}

.mock-code strong {
  font-size: 1.125rem;
  letter-spacing: 0.15em;
}
</style>
