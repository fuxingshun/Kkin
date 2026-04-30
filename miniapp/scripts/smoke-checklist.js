const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const miniappRoot = path.resolve(__dirname, '..');
const requireApi = process.argv.includes('--require-api');
const liveUserCrud = process.argv.includes('--live-user-crud');
const apiBaseUrl = process.env.KINECHO_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const apiToken = process.env.KINECHO_API_TOKEN || process.env.VITE_API_TOKEN || process.env.TARO_APP_API_TOKEN || '';

const checks = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
}

function includesAll(text, values) {
  return values.every((value) => text.includes(value));
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, { headers: authHeaders() });
    const data = await response.json();
    addCheck('java api health', response.ok && data.status === 'ok', `${response.status} ${data.status || ''}`.trim());
  } catch (error) {
    addCheck('java api health', !requireApi, requireApi ? error.message : `skipped (${error.message})`);
  }
}

function authHeaders(json = false) {
  const headers = {};
  if (apiToken.trim()) {
    headers.Authorization = `Bearer ${apiToken.trim()}`;
    headers['X-KinEcho-Token'] = apiToken.trim();
  }
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${pathname}`, {
    ...options,
    headers: {
      ...authHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status} ${data?.error || text || response.statusText}`);
  }
  return data;
}

async function checkLiveUserCrud() {
  if (!liveUserCrud) {
    addCheck('live user crud', true, 'skipped (pass --live-user-crud to mutate dev data)');
    return;
  }

  const familyId = process.env.KINECHO_SMOKE_FAMILY_ID || 'family_001';
  const name = `Smoke家属${Date.now()}`;
  const created = await apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify({
      user_type: 'family',
      family_id: familyId,
      name,
      phone: '13900000000',
      operator: 'smoke',
    }),
  });
  const userId = created.user_id;
  await apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      family_id: familyId,
      name: `${name}编辑`,
      phone: '13900000001',
      operator: 'smoke',
    }),
  });
  await apiRequest(`/users/${userId}?family_id=${encodeURIComponent(familyId)}&operator=smoke`, {
    method: 'DELETE',
  });
  const users = await apiRequest(`/users/${encodeURIComponent(familyId)}`);
  const removedFromActiveList = !users.users?.some((item) => item.id === userId);
  addCheck('live user crud', removedFromActiveList, `created, updated, soft-deleted user ${userId}`);
}

async function main() {
  const appConfig = readText('miniapp/src/app.config.ts');
  const miniappConfig = readText('miniapp/config/index.js');
  const miniappEnv = readText('miniapp/.env');
  const miniappRequest = readText('miniapp/src/utils/request.ts');
  const miniappAuth = readText('miniapp/src/services/auth.ts');
  const elderlyService = readText('miniapp/src/services/elderly.ts');
  const aiCompanionServiceClient = readText('miniapp/src/services/aiCompanion.ts');
  const familyService = readText('miniapp/src/services/family.ts');
  const serviceService = readText('miniapp/src/services/service.ts');
  const loginPage = readText('miniapp/src/pages/login/index.tsx');
  const elderlyHomePage = readText('miniapp/src/pages/elderly/home/index.tsx');
  const familyDashboardPage = readText('miniapp/src/pages/family/dashboard/index.tsx');
  const serviceCaseDetailPage = readText('miniapp/src/pages/service/case-detail/index.tsx');
  const serviceSession = readText('miniapp/src/utils/serviceSession.ts');
  const adminApi = readText('src/admin/api.ts');
  const adminMain = readText('src/admin/main.tsx');
  const apiTokenInterceptor = readText('server-java/src/main/java/com/kinecho/server/config/ApiTokenInterceptor.java');
  const userController = readText('server-java/src/main/java/com/kinecho/server/controller/KinEchoApiController.java');
  const userService = readText('server-java/src/main/java/com/kinecho/server/service/KinEchoApiService.java');
  const aiCompanionService = readText('server-java/src/main/java/com/kinecho/server/service/AiCompanionService.java');
  const mapper = readText('server-java/src/main/java/com/kinecho/server/mapper/KinEchoMapper.java');
  const appYml = readText('server-java/src/main/resources/application.yml');
  const checklist = readText('docs/小程序关键路径冒烟测试清单.md');

  const keyPages = [
    'miniapp/src/pages/login/index.tsx',
    'miniapp/src/pages/elderly/home/index.tsx',
    'miniapp/src/pages/elderly/profile/index.tsx',
    'miniapp/src/pages/elderly/basic-info/index.tsx',
    'miniapp/src/pages/elderly/family-bindings/index.tsx',
    'miniapp/src/pages/elderly/record-history/index.tsx',
    'miniapp/src/pages/family/bind-elderly/index.tsx',
    'miniapp/src/pages/family/dashboard/index.tsx',
    'miniapp/src/pages/service/workspace/index.tsx',
  ];

  for (const page of keyPages) {
    addCheck(`page exists: ${page}`, exists(page), page);
  }

  addCheck(
    'elderly profile routes registered',
    includesAll(appConfig, ['pages/elderly/basic-info/index', 'pages/elderly/family-bindings/index', 'pages/elderly/record-history/index']),
    'app.config.ts'
  );

  addCheck(
    'miniapp auth client methods',
    includesAll(miniappAuth, ['login', '/auth/login']),
    'miniapp/src/services/auth.ts'
  );

  addCheck(
    'elderly user api client methods',
    includesAll(elderlyService, ['createUser', 'updateUser', 'deleteFamilyUser', 'getUserBindingCode']),
    'miniapp/src/services/elderly.ts'
  );

  addCheck(
    'family binding api client methods',
    includesAll(familyService, ['bindFamilyByCode', 'binding_code']),
    'miniapp/src/services/family.ts'
  );

  addCheck(
    'service overview api client methods',
    includesAll(serviceService, ['getServiceOverview', '/service/overview']),
    'miniapp/src/services/service.ts'
  );

  addCheck(
    'service domain api client methods',
    includesAll(serviceService, ['getServiceTasks', 'getServiceCases', 'getServiceCaseDetail', 'getServiceFollowups', 'createServiceRecord', '/service/tasks', '/service/cases', '/service/followups', '/service/records']),
    'miniapp/src/services/service.ts'
  );

  addCheck(
    'care insight closed-loop clients',
    includesAll(elderlyService, ['getElderlyCareInsight', '/care/insight']) &&
      includesAll(familyService, ['getCareInsight', '/care/insight', 'service_sop']) &&
      includesAll(serviceService, ['CareInsight', 'insight: data.insight || null']),
    'miniapp care insight service clients'
  );

  addCheck(
    'care insight role surfaces',
    includesAll(elderlyHomePage, ['ef-care-insight', 'getElderlyCareInsight']) &&
      includesAll(familyDashboardPage, ['ff-care-insight', 'getCareInsight']) &&
      includesAll(serviceCaseDetailPage, ['service-insight', 'service_sop']),
    'elderly/family/service care insight surfaces'
  );

  addCheck(
    'session scoped miniapp context',
    includesAll(elderlyService, ['getElderlySession', 'resolveFamilyId', 'resolveElderlyId']) &&
      includesAll(serviceService, ['getCurrentServiceFamilyId', 'resolveFamilyId']) &&
      includesAll(serviceSession, ['familyId: string', 'getCurrentServiceFamilyId']) &&
      includesAll(loginPage, ['saveServiceSession({', 'familyId: result.family_id']),
    'miniapp session-aware services'
  );

  addCheck(
    'family scoped mutation clients',
    includesAll(familyService, [
      'deleteMessage(messageId: number, familyId = DEFAULT_FAMILY_ID)',
      'markAlertAsRead(alertId: number, familyId = DEFAULT_FAMILY_ID)',
      'family_id: resolveFamilyId(payload.family_id || DEFAULT_FAMILY_ID)',
      '`/family/media/${mediaId}?${query}`',
    ]),
    'miniapp family mutation context'
  );

  addCheck(
    'elderly and service mutation clients scoped by family',
    includesAll(elderlyService, ['/elderly/schedules/${scheduleId}/status', 'family_id: resolveFamilyId()']) &&
      includesAll(serviceService, ['/service/followups/${consultation.id}/status', 'family_id: resolveFamilyId()']),
    'miniapp elderly/service mutation context'
  );

  addCheck(
    'miniapp api token injection',
    includesAll(miniappConfig, ['__API_TOKEN__']) && includesAll(miniappRequest, ['Authorization', 'X-KinEcho-Token']),
    'miniapp config + request'
  );

  addCheck(
    'miniapp api base self healing',
    includesAll(miniappConfig, ['isLocalDevelopmentApiBaseUrl', 'lanFallbacks', 'externalConfigured', "'http://127.0.0.1:8000/api'"]) &&
      includesAll(miniappRequest, [
        'ACTIVE_API_BASE_URL_SIGNATURE_KEY',
        'ensureApiBaseUrlCacheFresh',
        'isKnownApiBaseUrl',
        'forgetFailedUrl',
      ]),
    'stale LAN API cache should not pin requests to old IPs'
  );

  addCheck(
    'miniapp env avoids stale LAN pinning',
    !miniappEnv.includes('192.168.1.12') && includesAll(miniappEnv, ['TARO_APP_API_BASE_URL=']),
    'miniapp/.env should let config auto-detect the current LAN IP'
  );

  addCheck(
    'java api token guard',
    includesAll(apiTokenInterceptor, ['X-KinEcho-Token', 'HttpHeaders.AUTHORIZATION', 'Bearer ']),
    'ApiTokenInterceptor.java'
  );

  addCheck(
    'java family scoped mutations',
    includesAll(userService, ['familyScopedUpdate(', 'softDeleteFamilyRecord(', 'requireFamilyRecord(']),
    'KinEchoApiService.java'
  );

  addCheck(
    'admin user api client methods',
    includesAll(adminApi, ['loginAdmin', 'createUser', 'updateUser', 'deleteUser', 'getAdminServiceSummary', 'getAdminAnalytics']),
    'src/admin/api.ts'
  );

  addCheck(
    'admin core pages wired to real api',
    includesAll(adminMain, [
      'handleDeleteUser',
      'ServicePageLive',
      'AnalyticsPageLive',
      'getAdminServiceSummary()',
      'getAdminAnalytics(undefined, { months: 6, days: 7 })',
      'casePreviewRows',
    ]),
    'src/admin/main.tsx'
  );

  addCheck(
    'admin user management write actions',
    includesAll(adminMain, ['新增用户', '编辑用户', 'handleDeleteUser']),
    'src/admin/main.tsx'
  );

  addCheck(
    'java user write endpoints',
    includesAll(userController, [
      '@PostMapping("/auth/login")',
      '@PostMapping("/users")',
      '@PutMapping("/users/{userId}")',
      '@DeleteMapping("/users/{userId}")',
      '@GetMapping("/users/{userId}/binding-code")',
      '@PostMapping("/users/bind-by-code")',
      '@GetMapping("/service/overview")',
      '@GetMapping("/service/tasks")',
      '@PostMapping("/service/tasks/{alertId}/start")',
      '@PostMapping("/service/tasks/{alertId}/complete")',
      '@GetMapping("/service/cases")',
      '@GetMapping("/service/cases/{elderlyId}")',
      '@GetMapping("/service/followups")',
      '@PostMapping("/service/followups")',
      '@PutMapping("/service/followups/{consultationId}/status")',
      '@PostMapping("/service/records")',
      '@GetMapping("/admin/service-summary")',
      '@GetMapping("/admin/analytics")',
    ]),
    'KinEchoApiController.java'
  );

  addCheck(
    'java user soft delete contract',
    includesAll(userService, ['is_active = 0', 'updated_at = CURRENT_TIMESTAMP', 'only family contacts can be deleted']),
    'KinEchoApiService.java'
  );

  addCheck(
    'admin summary service contract',
    includesAll(userService, ['getAdminServiceSummary', 'getAdminAnalytics', 'weekly_activity', 'role_stats', 'case_rows']),
    'KinEchoApiService.java'
  );

  addCheck(
    'care insight backend contract',
    includesAll(userController, ['@GetMapping("/care/insight")']) &&
      includesAll(userService, ['getCareInsight', 'careServiceSop', 'auditCareAction']) &&
      includesAll(mapper, ['care_audit_logs', 'idx_care_audit_family_created']),
    'care insight API + audit log'
  );

  addCheck(
    'ai companion quick fallback contract',
    includesAll(aiCompanionService, [
      'INTERACTIVE_CHAT_TIMEOUT_SECONDS = 10',
      'INTERACTIVE_TTS_TIMEOUT_SECONDS = 4',
      'safeRecordInteraction',
      'fallbackChat',
      'canUseBailianChat',
    ]) &&
      includesAll(userService, ['return ok(aiCompanion.fallbackChat(message, user, ex.getMessage()))']) &&
      includesAll(appYml, ['bailian-chat-model: qwen-turbo', 'bailian-chat-timeout-seconds: 10', 'bailian-tts-timeout-seconds: 4']) &&
      includesAll(aiCompanionServiceClient, ['AI_CHAT_TIMEOUT = 18000', 'AI_VOICE_CHAT_TIMEOUT = 120000']),
    'AI chat should wait for provider while still degrading before miniapp timeout'
  );

  addCheck(
    'service backend aggregate contract',
    includesAll(userService, ['getServiceTasks', 'getServiceCases', 'getServiceCaseDetail', 'getServiceFollowups', 'createServiceFollowup', 'createServiceRecord']),
    'KinEchoApiService.java'
  );

  addCheck(
    'users table migration contract',
    includesAll(mapper, ['migrateSchema()', 'binding_code', 'is_active', 'updated_at', 'deleted_at', 'deleted_by', 'idx_users_binding_code']),
    'KinEchoMapper.java'
  );

  addCheck(
    'manual smoke checklist covers new elderly paths',
    includesAll(checklist, ['基本信息维护', '绑定码', '查看详细趋势', '/api/users/{userId}/binding-code', '/api/users/bind-by-code']),
    'docs/小程序关键路径冒烟测试清单.md'
  );

  await checkApiHealth();
  await checkLiveUserCrud();

  const nameWidth = Math.max(...checks.map((check) => check.name.length), 4);
  for (const check of checks) {
    const status = check.passed ? 'PASS' : 'FAIL';
    console.log(`${status} ${check.name.padEnd(nameWidth)}  ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.passed);
  if (failed.length) {
    console.error(`\n${failed.length} smoke preflight check(s) failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${checks.length} smoke preflight checks passed.`);
  console.log(`Manual checklist: ${path.relative(process.cwd(), path.join(repoRoot, 'docs/小程序关键路径冒烟测试清单.md'))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
