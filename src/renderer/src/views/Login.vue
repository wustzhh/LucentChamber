<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">LucentChamber</h1>
      <p class="auth-subtitle">小说创作辅助工具</p>
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large"
            @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="handleLogin" style="width:100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="auth-footer">
        还没有账号？<el-link type="primary" @click="$router.push('/register')">注册</el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  const result = await window.api.login(form.username, form.password)
  loading.value = false
  if (result.success) {
    userStore.setUser(result.userId!, result.username!)
    router.push('/projects')
  } else {
    ElMessage.error(result.error || '登录失败')
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.auth-card {
  width: 400px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.auth-title {
  text-align: center;
  color: #e0e0e0;
  margin-bottom: 4px;
  font-size: 28px;
}
.auth-subtitle {
  text-align: center;
  color: #888;
  margin-bottom: 32px;
  font-size: 14px;
}
.auth-footer {
  text-align: center;
  color: #888;
  font-size: 14px;
}
</style>
