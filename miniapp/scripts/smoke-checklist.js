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

function routeRegistered(appConfig, route) {
  if (appConfig.includes(`'${route}'`) || appConfig.includes(`"${route}"`)) {
    return true;
  }

  const parts = route.split('/');
  const root = parts.slice(0, 2).join('/');
  const page = parts.slice(2).join('/');
  return (
    (appConfig.includes(`root: '${root}'`) || appConfig.includes(`root: "${root}"`)) &&
    (appConfig.includes(`'${page}'`) || appConfig.includes(`"${page}"`))
  );
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
  const appCss = readText('miniapp/src/app.css');
  const miniappConfig = readText('miniapp/config/index.js');
  const miniappEnv = readText('miniapp/.env');
  const rootPackage = readText('package.json');
  const miniappRequest = readText('miniapp/src/utils/request.ts');
  const miniappAuth = readText('miniapp/src/services/auth.ts');
  const elderlyService = readText('miniapp/src/services/elderly.ts');
  const aiCompanionServiceClient = readText('miniapp/src/services/aiCompanion.ts');
  const familyService = readText('miniapp/src/services/family.ts');
  const serviceService = readText('miniapp/src/services/service.ts');
  const loginPage = readText('miniapp/src/pages/login/index.tsx');
  const userAgreementPage = readText('miniapp/src/pages/legal/user-agreement/index.tsx');
  const privacyPolicyPage = readText('miniapp/src/pages/legal/privacy-policy/index.tsx');
  const elderlyHomePage = readText('miniapp/src/pages/elderly/home/index.tsx');
  const elderlyCounselorListPage = readText('miniapp/src/pages/elderly/counselor-list/index.tsx');
  const elderlyCounselorDetailPage = readText('miniapp/src/pages/elderly/counselor-detail/index.tsx');
  const familyDashboardPage = readText('miniapp/src/pages/family/dashboard/index.tsx');
  const familyCounselingPage = readText('miniapp/src/pages/family/counseling/index.tsx');
  const familyCarePage = readText('miniapp/src/pages/family/care/index.tsx');
  const familyMediaPage = readText('miniapp/src/pages/family/media/index.tsx');
  const familyMessagesPage = readText('miniapp/src/pages/family/messages/index.tsx');
  const familyAlertsPage = readText('miniapp/src/pages/family/alerts/index.tsx');
  const familyProfilePage = readText('miniapp/src/pages/family/profile/index.tsx');
  const serviceCaseDetailPage = readText('miniapp/src/pages/service/case-detail/index.tsx');
  const serviceWorkspacePage = readText('miniapp/src/pages/service/workspace/index.tsx');
  const serviceTasksPage = readText('miniapp/src/pages/service/tasks/index.tsx');
  const serviceFollowupPage = readText('miniapp/src/pages/service/followup/index.tsx');
  const serviceConsultationsPage = readText('miniapp/src/pages/service/consultations/index.tsx');
  const serviceSession = readText('miniapp/src/utils/serviceSession.ts');
  const adminApi = readText('src/admin/api.ts');
  const adminMain = readText('src/admin/main.tsx');
  const serverPom = readText('server-java/pom.xml');
  const apiExceptionHandler = readText('server-java/src/main/java/com/kinecho/server/config/ApiExceptionHandler.java');
  const openApiConfig = readText('server-java/src/main/java/com/kinecho/server/config/OpenApiConfig.java');
  const adminAuthCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminAuthAccountCreateRequest.java');
  const adminAuthUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminAuthAccountUpdateRequest.java');
  const privacyRequestCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/PrivacyRequestCreateRequest.java');
  const privacyRequestReviewDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/PrivacyRequestReviewRequest.java');
  const serviceCertificationSubmitDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ServiceCertificationSubmitRequest.java');
  const serviceCertificationReviewDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ServiceCertificationReviewRequest.java');
  const userCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/UserCreateRequest.java');
  const userUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/UserUpdateRequest.java');
  const serviceFollowupCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ServiceFollowupCreateRequest.java');
  const serviceFollowupStatusDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ServiceFollowupStatusRequest.java');
  const serviceRecordCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ServiceRecordCreateRequest.java');
  const consultationCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ConsultationCreateRequest.java');
  const consultationUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ConsultationUpdateRequest.java');
  const scheduleCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ScheduleCreateRequest.java');
  const scheduleUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ScheduleUpdateRequest.java');
  const scheduleStatusDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ScheduleStatusRequest.java');
  const familyAlertCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/FamilyAlertCreateRequest.java');
  const familyAlertHandleDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/FamilyAlertHandleRequest.java');
  const familyAlertReplyDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/FamilyAlertReplyRequest.java');
  const familyMessageCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/FamilyMessageCreateRequest.java');
  const consentRecordCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ConsentRecordCreateRequest.java');
  const familyBindByCodeDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/FamilyBindByCodeRequest.java');
  const elderlyAlertCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ElderlyAlertCreateRequest.java');
  const elderlyMoodCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/ElderlyMoodCreateRequest.java');
  const mediaUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/MediaUpdateRequest.java');
  const mediaPlayRecordDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/MediaPlayRecordRequest.java');
  const mediaFeedbackDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/MediaFeedbackRequest.java');
  const adminCounselorUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminCounselorUpdateRequest.java');
  const adminPsychologyVideoCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminPsychologyVideoCreateRequest.java');
  const adminPsychologyVideoUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminPsychologyVideoUpdateRequest.java');
  const adminPsychologyQuestionCreateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminPsychologyQuestionCreateRequest.java');
  const adminPsychologyQuestionUpdateDto = readText('server-java/src/main/java/com/kinecho/server/controller/dto/AdminPsychologyQuestionUpdateRequest.java');
  const apiTokenInterceptor = readText('server-java/src/main/java/com/kinecho/server/config/ApiTokenInterceptor.java');
  const webConfig = readText('server-java/src/main/java/com/kinecho/server/config/WebConfig.java');
  const familyScopeInterceptor = readText('server-java/src/main/java/com/kinecho/server/config/FamilyScopeInterceptor.java');
  const familyScopeRequestBodyAdvice = readText('server-java/src/main/java/com/kinecho/server/config/FamilyScopeRequestBodyAdvice.java');
  const userController = readText('server-java/src/main/java/com/kinecho/server/controller/KinEchoApiController.java');
  const userService = readText('server-java/src/main/java/com/kinecho/server/service/KinEchoApiService.java');
  const aiCompanionService = readText('server-java/src/main/java/com/kinecho/server/service/AiCompanionService.java');
  const mapper = readText('server-java/src/main/java/com/kinecho/server/mapper/KinEchoMapper.java');
  const appYml = readText('server-java/src/main/resources/application.yml');
  const prodExampleYml = readText('server-java/src/main/resources/application-prod.example.yml');
  const miniappMediaUtils = readText('miniapp/src/utils/media.ts');
  const backupScript = readText('scripts/backup-pilot.ps1');
  const backupRunbook = readText('docs/封闭试点备份恢复演练.md');
  const checklist = readText('docs/小程序关键路径冒烟测试清单.md');
  const securityChecklist = readText('docs/封闭试点安全验证清单.md');
  const dailyOpsChecklist = readText('docs/封闭试点每日运营检查表.md');
  const pilotRosterTemplate = readText('docs/首批试点名单冻结模板.md');
  const planAudit = readText('docs/PLAN完成审计.md');

  const keyPages = [
    'miniapp/src/pages/login/index.tsx',
    'miniapp/src/pages/elderly/home/index.tsx',
    'miniapp/src/pages/elderly/profile/index.tsx',
    'miniapp/src/pages/elderly/basic-info/index.tsx',
    'miniapp/src/pages/elderly/family-bindings/index.tsx',
    'miniapp/src/pages/elderly/record-history/index.tsx',
    'miniapp/src/pages/elderly/psychology-video/index.tsx',
    'miniapp/src/pages/family/bind-elderly/index.tsx',
    'miniapp/src/pages/family/dashboard/index.tsx',
    'miniapp/src/pages/service/workspace/index.tsx',
  ];

  for (const page of keyPages) {
    addCheck(`page exists: ${page}`, exists(page), page);
  }

  addCheck(
    'elderly profile routes registered',
    ['pages/elderly/basic-info/index', 'pages/elderly/family-bindings/index', 'pages/elderly/record-history/index'].every((route) =>
      routeRegistered(appConfig, route)
    ),
    'app.config.ts'
  );

  const psychologyConsultingPage = readText('miniapp/src/pages/elderly/psychological-consulting/index.tsx');
  const psychologyVideoPage = readText('miniapp/src/pages/elderly/psychology-video/index.tsx');
  const mentalHealthService = readText('miniapp/src/services/mentalHealth.ts');
  const psychologyVideoProxy = readText('server-java/src/main/java/com/kinecho/server/controller/PsychologyVideoAssetController.java');

  addCheck(
    'elderly psychology video route registered',
    routeRegistered(appConfig, 'pages/elderly/psychology-video/index'),
    'app.config.ts'
  );

  addCheck(
    'elderly psychology encyclopedia opens videos',
    includesAll(psychologyConsultingPage, ['getPsychologyResources', 'openPsychologyVideo', '/pages/elderly/psychology-video/index?id=']) &&
      includesAll(psychologyVideoPage, ['<Swiper', 'vertical', '<Video', 'getPsychologyVideoUrl', 'source_url', '上下滑动切换视频', '咨询']) &&
      includesAll(mentalHealthService, ['getPsychologyResources', '/psychology/resources', 'getPsychologyVideoUrl', '/psychology-videos/', 'source_url', 'takeaways']) &&
      !mentalHealthService.includes('upload.wikimedia.org') &&
      includesAll(psychologyVideoProxy, ['@GetMapping("/psychology-videos/{videoId}.mp4")', 'psychologyVideoSource(videoId)', 'ACCEPT_RANGES', 'HttpResponse.BodyHandlers.ofInputStream']),
    'elderly psychology encyclopedia video flow'
  );

  addCheck(
    'role pages split into subpackages',
    includesAll(appConfig, ["root: 'pages/family'", "root: 'pages/elderly'", "root: 'pages/service'"]),
    'app.config.ts'
  );

  addCheck(
    'formal login legal pages',
    routeRegistered(appConfig, 'pages/legal/user-agreement/index') &&
      routeRegistered(appConfig, 'pages/legal/privacy-policy/index') &&
      includesAll(loginPage, ['/pages/legal/user-agreement/index', '/pages/legal/privacy-policy/index']) &&
      includesAll(userAgreementPage, ['用户协议', '不提供医学诊断', '高风险事件']) &&
      includesAll(privacyPolicyPage, ['隐私政策', '受控接口访问', '导出、删除与保留']),
    'login agreement and privacy policy pages'
  );

  addCheck(
    'miniapp auth client methods',
    includesAll(miniappAuth, ['login', '/auth/login', 'getMe', '/me', 'X-KinEcho-Session', 'recordLoginConsent', '/privacy/consents']),
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
    'service workflow dto validation',
    includesAll(userController, ['ServiceFollowupCreateRequest', 'ServiceFollowupStatusRequest', 'ServiceRecordCreateRequest']) &&
      includesAll(serviceFollowupCreateDto, ['record ServiceFollowupCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'consultation_type', 'scheduled_time', 'toMap()']) &&
      includesAll(serviceFollowupStatusDto, ['record ServiceFollowupStatusRequest', '@Schema', '@Pattern', 'cancel_reason', 'toMap()']) &&
      includesAll(serviceRecordCreateDto, ['record ServiceRecordCreateRequest', '@Schema', '@NotBlank', 'alert_id', 'content', 'toMap()']),
    'service workflow writes should use DTO validation and schema metadata'
  );

  addCheck(
    'schedule dto validation',
    includesAll(userController, ['ScheduleCreateRequest', 'ScheduleUpdateRequest', 'ScheduleStatusRequest']) &&
      includesAll(scheduleCreateDto, ['record ScheduleCreateRequest', '@Schema', '@NotBlank', 'schedule_type', 'schedule_time', 'repeat_type', 'auto_remind', 'toMap()']) &&
      includesAll(scheduleUpdateDto, ['record ScheduleUpdateRequest', '@Schema', '@Pattern', 'repeat_days', 'status', 'toMap()']) &&
      includesAll(scheduleStatusDto, ['record ScheduleStatusRequest', '@Schema', '@NotBlank', 'elderly_id', 'toMap()']),
    'family and elderly schedule writes should use DTO validation and schema metadata'
  );

  addCheck(
    'family communication dto validation',
    includesAll(userController, ['FamilyAlertCreateRequest', 'FamilyAlertHandleRequest', 'FamilyAlertReplyRequest', 'FamilyMessageCreateRequest']) &&
      includesAll(familyAlertCreateDto, ['record FamilyAlertCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'alert_type', 'metadata', 'toMap()']) &&
      includesAll(familyAlertHandleDto, ['record FamilyAlertHandleRequest', '@Schema', '@NotBlank', 'handled_by', 'reply_message', 'toMap()']) &&
      includesAll(familyAlertReplyDto, ['record FamilyAlertReplyRequest', '@Schema', '@NotBlank', 'reply_message', 'toMap()']) &&
      includesAll(familyMessageCreateDto, ['record FamilyMessageCreateRequest', '@Schema', '@NotBlank', 'sender_name', 'sender_relation', 'scheduled_time', 'toMap()']),
    'family alert and message writes should use DTO validation and schema metadata'
  );

  addCheck(
    'privacy consent and binding dto validation',
    includesAll(userController, ['ConsentRecordCreateRequest', 'FamilyBindByCodeRequest']) &&
      includesAll(consentRecordCreateDto, ['record ConsentRecordCreateRequest', '@Schema', '@NotBlank', 'consent_type', 'actor_role', 'metadata', 'toMap()']) &&
      includesAll(familyBindByCodeDto, ['record FamilyBindByCodeRequest', '@Schema', '@NotBlank', 'binding_code', 'wechat_openid', 'toMap()']),
    'privacy consent and family binding writes should use DTO validation and schema metadata'
  );

  addCheck(
    'elderly care dto validation',
    includesAll(userController, ['ElderlyAlertCreateRequest', 'ElderlyMoodCreateRequest']) &&
      includesAll(elderlyAlertCreateDto, ['record ElderlyAlertCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'alert_type', 'metadata', 'toMap()']) &&
      includesAll(elderlyMoodCreateDto, ['record ElderlyMoodCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'mood_type', 'mood_score', 'recorded_at', 'toMap()']),
    'elderly alert and mood writes should use DTO validation and schema metadata'
  );

  addCheck(
    'media interaction dto validation',
    includesAll(userController, ['MediaUpdateRequest', 'MediaPlayRecordRequest', 'MediaFeedbackRequest']) &&
      includesAll(mediaUpdateDto, ['record MediaUpdateRequest', '@Schema', '@NotBlank', 'time_windows', 'cooldown', 'priority', 'toMap()']) &&
      includesAll(mediaPlayRecordDto, ['record MediaPlayRecordRequest', '@Schema', '@NotNull', 'duration_watched', 'triggered_by', 'toMap()']) &&
      includesAll(mediaFeedbackDto, ['record MediaFeedbackRequest', '@Schema', '@Pattern', 'feedback_type', 'toMap()']),
    'media update, play and feedback writes should use DTO validation and schema metadata'
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
    'elderly home core action surface',
    includesAll(elderlyHomePage, [
      'coreActions',
      '陪我聊',
      '联系家人',
      '今日任务',
      '记录心情',
      '/pages/elderly/companion/index',
      '/pages/elderly/help/index',
      '/pages/elderly/reminders/index',
      '/pages/elderly/record/index',
    ]) &&
      includesAll(appCss, ['ef-core-actions', 'ef-core-action__label', 'ef-core-action__hint']),
    'elderly home should keep the first-screen actions focused'
  );

  addCheck(
    'session scoped miniapp context',
      includesAll(elderlyService, ['getElderlySession', 'resolveFamilyId', 'resolveElderlyId', 'resolveWriteFamilyId', 'resolveWriteElderlyId']) &&
      includesAll(serviceService, ['getCurrentServiceFamilyId', 'resolveFamilyId', 'resolveWriteFamilyId']) &&
      includesAll(serviceSession, ['familyId: string', 'getCurrentServiceFamilyId', 'requireCurrentServiceFamilyId']) &&
      includesAll(loginPage, ['saveServiceSession({', 'familyId: service.family_id']),
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
    'family pages require session before writes',
    includesAll(familyCounselingPage, ['requireCurrentFamilyId', 'family_id: familyId']) &&
      includesAll(familyCarePage, ['requireCurrentFamilyId', 'family_id: familyId']) &&
      includesAll(familyMediaPage, ['requireCurrentFamilyId', 'family_id: familyId']) &&
      includesAll(familyMessagesPage, ['requireCurrentFamilyId', 'family_id: familyId']) &&
      ![familyCounselingPage, familyCarePage, familyMediaPage, familyMessagesPage, familyAlertsPage].some((text) =>
        text.includes('DEFAULT_FAMILY_ID')
      ),
    'family write pages should not pin DEFAULT_FAMILY_ID'
  );

  addCheck(
    'elderly and service mutation clients scoped by family',
    includesAll(elderlyService, ['/elderly/schedules/${scheduleId}/status', 'family_id: resolveWriteFamilyId()', 'elderly_id: resolveWriteElderlyId']) &&
      includesAll(serviceService, ['/service/followups/${consultation.id}/status', 'family_id: resolveWriteFamilyId()']),
    'miniapp elderly/service mutation context'
  );

  addCheck(
    'miniapp api token injection',
    includesAll(miniappConfig, ['__API_TOKEN__']) && includesAll(miniappRequest, ['Authorization', 'X-KinEcho-Token', 'X-KinEcho-Session']),
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
    'session current-user interface',
    includesAll(userController, ['@GetMapping("/me")', 'X-KinEcho-Session', 'service.me']) &&
      includesAll(userService, ['session_token', 'createSessionToken', 'verifySessionToken', 'session_expires_in']),
    'GET /api/me session contract'
  );

  addCheck(
    'session family scope guard',
    includesAll(familyScopeInterceptor, ['familyScopeSessionRequired', 'session token is required', 'family_id', 'family scope mismatch', 'SessionTokenCodec.extract', 'SessionTokenCodec.verify']) &&
      includesAll(familyScopeRequestBodyAdvice, ['familyScopeSessionRequired', 'afterBodyRead', 'family_id', 'family scope mismatch', 'ResponseStatusException']) &&
      includesAll(miniappRequest, ['X-KinEcho-Session']) &&
      includesAll(adminApi, ['X-KinEcho-Session']),
    'session family_id compatibility guard'
  );

  addCheck(
    'production disables demo phone suffix login',
    includesAll(userService, ['phoneSuffixLoginEnabled', 'matchesLoginPassword']) &&
      includesAll(appYml, ['phone-suffix-login-enabled: ${KINECHO_PHONE_SUFFIX_LOGIN_ENABLED:true}']) &&
      includesAll(prodExampleYml, ['phone-suffix-login-enabled: ${KINECHO_PHONE_SUFFIX_LOGIN_ENABLED:false}']),
    'production login safety config'
  );

  addCheck(
    'uploaded media uses controlled download endpoints',
    !webConfig.includes('addResourceHandler("/uploads/**")') &&
      includesAll(userController, ['@GetMapping("/family/media/{mediaId}/file")', '@GetMapping("/family/media/{mediaId}/thumbnail")']) &&
      includesAll(userService, ['downloadMediaAsset', 'resolveStoredMediaPath', 'mediaAssetUrl', 'media path is outside upload directory']) &&
      includesAll(miniappMediaUtils, ['path.startsWith(\'/api/\')', 'getMiniappAssetOrigin()']) &&
      !miniappMediaUtils.includes('/uploads/'),
    'authenticated media download contract'
  );

  addCheck(
    'ai audio assets use signed temporary urls',
    !webConfig.includes('addResourceHandler("/uploads/ai-audio/**")') &&
      !webConfig.includes('addResourceHandler("/uploads/ai-voice/**")') &&
      includesAll(webConfig, ['"/api/ai/audio/**"', '"/api/ai/voice-upload/**"']) &&
      includesAll(userController, ['@GetMapping("/ai/audio/{filename:.+}")', '@GetMapping("/ai/voice-upload/{filename:.+}")']) &&
      includesAll(userService, ['downloadAiAudio', 'downloadAiVoiceUpload', 'verifySignedPayload', 'invalid or expired audio token', 'invalid or expired voice upload token']) &&
      includesAll(aiCompanionService, ['signedAiAudioUrl', 'createSignedPayload', 'api/ai/audio/', 'api/ai/voice-upload/']),
    'AI TTS and ASR upload playback should both use short-lived signed URLs'
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
    'admin service certification review clients',
    includesAll(adminApi, ['getServiceCertifications', '/admin/service-certifications', 'reviewServiceCertification']) &&
      includesAll(adminMain, ['服务认证审核', "getServiceCertifications('pending')", 'reviewServiceCertification']) &&
      includesAll(userController, ['ServiceCertificationSubmitRequest', 'ServiceCertificationReviewRequest']) &&
      includesAll(serviceCertificationSubmitDto, ['record ServiceCertificationSubmitRequest', '@Schema', '@NotBlank', 'staff_no', 'toMap()']) &&
      includesAll(serviceCertificationReviewDto, ['record ServiceCertificationReviewRequest', '@Schema', '@Pattern', 'reject_reason', 'toMap()']),
    'admin service certification review surface'
  );

  addCheck(
    'admin counselor management clients',
    includesAll(userController, ['@GetMapping("/admin/counselors")', '@PutMapping("/admin/counselors/{counselorId}")']) &&
      includesAll(userController, ['AdminCounselorUpdateRequest']) &&
      includesAll(adminCounselorUpdateDto, ['record AdminCounselorUpdateRequest', '@Schema', 'available', 'is_active', 'availability_text', 'calendar', 'toMap()']) &&
      includesAll(userService, ['getAdminCounselors', 'updateAdminCounselor', 'UPDATE counselors SET']) &&
      includesAll(adminApi, ['getAdminCounselors', '/admin/counselors', 'updateAdminCounselor', 'ApiCounselor']) &&
      includesAll(adminMain, ['咨询师管理', 'getAdminCounselors', 'updateAdminCounselor', '暂停接单', '开放预约']),
    'admin should manage counselor availability'
  );

  addCheck(
    'admin psychology content inventory',
    includesAll(adminApi, ['getPsychologyResources', '/psychology/resources', 'createPsychologyVideo', 'updatePsychologyVideo', 'createPsychologyQuestion', 'updatePsychologyQuestion', 'ApiPsychologyResources']) &&
      includesAll(userController, ['AdminPsychologyVideoCreateRequest', 'AdminPsychologyVideoUpdateRequest', 'AdminPsychologyQuestionCreateRequest', 'AdminPsychologyQuestionUpdateRequest']) &&
      includesAll(adminPsychologyVideoCreateDto, ['record AdminPsychologyVideoCreateRequest', '@Schema', '@NotBlank', 'source_url', 'cover_class_name', 'takeaways', 'toMap()']) &&
      includesAll(adminPsychologyVideoUpdateDto, ['record AdminPsychologyVideoUpdateRequest', '@Schema', 'source_url', 'sort_order', 'is_active', 'toMap()']) &&
      includesAll(adminPsychologyQuestionCreateDto, ['record AdminPsychologyQuestionCreateRequest', '@Schema', '@NotBlank', 'question', 'sort_order', 'toMap()']) &&
      includesAll(adminPsychologyQuestionUpdateDto, ['record AdminPsychologyQuestionUpdateRequest', '@Schema', 'question', 'is_active', 'toMap()']) &&
      includesAll(adminMain, ['心理内容库', 'getPsychologyResources', 'createPsychologyVideo', 'updatePsychologyVideo', 'createPsychologyQuestion', 'updatePsychologyQuestion', 'reply_count']),
    'admin content management should expose psychology inventory'
  );

  addCheck(
    'admin core pages wired to real api',
    includesAll(adminMain, [
      'handleDeleteUser',
      'ServicePageLive',
      'AnalyticsPageLive',
      'getAdminFamilies()',
      'selectedFamilyId={selectedFamilyId}',
      'getAdminServiceSummary(selectedFamilyId)',
      'getAdminAnalytics(selectedFamilyId, { months: 6, days: 7 })',
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
      '@GetMapping("/admin/service-certifications")',
      '@PutMapping("/admin/service-certifications/{certificationId}")',
      '@GetMapping("/admin/service-summary")',
      '@GetMapping("/admin/analytics")',
    ]) &&
      includesAll(userController, ['UserCreateRequest', 'UserUpdateRequest']) &&
      includesAll(userCreateDto, ['record UserCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'user_type', 'family_id', 'toMap()']) &&
      includesAll(userUpdateDto, ['record UserUpdateRequest', '@Schema', '@NotBlank', 'family_id', 'toMap()']),
    'KinEchoApiController.java'
  );

  addCheck(
    'admin auth account dto validation',
      includesAll(serverPom, ['spring-boot-starter-validation']) &&
      includesAll(userController, ['AdminAuthAccountCreateRequest', 'AdminAuthAccountUpdateRequest', '@Valid @RequestBody(required = false)']) &&
      includesAll(adminAuthCreateDto, ['record AdminAuthAccountCreateRequest', '@Schema', '@NotBlank', '@Pattern', '@Size', 'toMap()', 'display_name', 'user_id']) &&
      includesAll(adminAuthUpdateDto, ['record AdminAuthAccountUpdateRequest', '@Schema', '@Size', 'confirmation', 'toMap()', 'confirmed']) &&
      includesAll(apiExceptionHandler, ['@RestControllerAdvice', 'MethodArgumentNotValidException', 'VALIDATION_ERROR', 'request_id']),
    'admin account lifecycle writes should use DTO validation and structured errors'
  );

  addCheck(
    'java openapi contract skeleton',
    includesAll(serverPom, ['springdoc-openapi-starter-webmvc-ui']) &&
      includesAll(openApiConfig, ['KinEcho API', 'GroupedOpenApi', 'admin-api', 'service-api', 'miniapp-api', 'apiToken', 'sessionToken']) &&
      includesAll(appYml, ['springdoc:', 'KINECHO_OPENAPI_ENABLED', '/v3/api-docs', '/swagger-ui.html']) &&
      includesAll(prodExampleYml, ['KINECHO_OPENAPI_ENABLED:false', 'KINECHO_SWAGGER_UI_ENABLED:false']),
    'backend should expose an OpenAPI skeleton for grouped API docs'
  );

  addCheck(
    'java service certification review contract',
    includesAll(userService, [
      'getServiceCertifications',
      'reviewServiceCertification',
      'status must be approved or rejected',
      'reject_reason is required',
      'UPDATE service_certifications',
    ]),
    'KinEchoApiService.java'
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
    'privacy consent and data request contract',
    includesAll(userController, ['@PostMapping("/privacy/consents")', '@GetMapping("/privacy/export")', '@PostMapping("/privacy/requests")', '@GetMapping("/admin/privacy/requests")', '@PutMapping("/admin/privacy/requests/{requestId}")']) &&
      includesAll(userService, ['recordConsent', 'exportFamilyData', 'createPrivacyRequest', 'getPrivacyRequests', 'reviewPrivacyRequest', 'privacy_data_exported', 'privacy_request_created', 'privacy_request_reviewed']) &&
      includesAll(mapper, ['consent_records', 'privacy_requests', 'idx_consent_family_created', 'idx_privacy_requests_family_created']) &&
      includesAll(familyService, ['recordConsent', 'getConsentRecords', 'exportFamilyData', 'createPrivacyRequest']) &&
      includesAll(loginPage, ['recordVerifiedLoginConsents', 'user-agreement', 'privacy-policy', 'LOGIN_CONSENT_VERSION']) &&
      includesAll(adminApi, ['getPrivacyRequests', '/admin/privacy/requests', 'reviewPrivacyRequest']) &&
      includesAll(adminMain, ['隐私请求队列', 'getPrivacyRequests(selectedFamilyId', 'reviewPrivacyRequest']) &&
      includesAll(userController, ['PrivacyRequestCreateRequest', 'PrivacyRequestReviewRequest']) &&
      includesAll(privacyRequestCreateDto, ['record PrivacyRequestCreateRequest', '@Schema', '@NotBlank', '@Pattern', 'request_type', 'family_id', 'toMap()']) &&
      includesAll(privacyRequestReviewDto, ['record PrivacyRequestReviewRequest', '@Schema', '@Pattern', 'process_note', 'toMap()']) &&
      miniappAuth.includes('miniapp-login') &&
      includesAll(familyProfilePage, ['handleExportData', 'submitPrivacyRequest', 'exportFamilyData', 'createPrivacyRequest', '导出家庭数据', '提交删除请求']),
    'privacy consent records, family data export, and deletion request workflow'
  );

  addCheck(
    'retention policy operations contract',
    includesAll(userController, ['@GetMapping("/admin/retention/summary")', 'service.retentionSummary()']) &&
      includesAll(userService, ['retentionSummary', 'ai_audio_retention_count', 'ai_voice_retention_days', 'mental_frame_retention_days', 'audit_log_retention_days']) &&
      includesAll(appYml, ['ai-voice-retention-days', 'mental-frame-retention-days', 'ai-chat-retention-days', 'consultation-retention-days', 'audit-log-retention-days']) &&
      includesAll(adminApi, ['getRetentionSummary', '/admin/retention/summary', 'ApiRetentionSummary']) &&
      includesAll(adminMain, ['保留策略', 'getRetentionSummary', 'ai_audio_retention_count']),
    'backend and admin should expose pilot retention policy'
  );

  addCheck(
    'admin ops metrics surface',
    includesAll(userController, ['@GetMapping("/admin/ops/metrics")', 'service.getAdminOpsMetrics()']) &&
      includesAll(userService, ['getAdminOpsMetrics', 'open_alerts', 'pending_privacy_requests', 'locked_auth_accounts', 'safeMetricCount']) &&
      includesAll(adminApi, ['getAdminOpsMetrics', '/admin/ops/metrics', 'ApiAdminOpsMetrics']) &&
      includesAll(adminMain, ['运维指标总览', 'getAdminOpsMetrics', 'OPS_METRIC_LABELS', 'locked_auth_accounts']),
    'admin should expose operational health counts'
  );

  addCheck(
    'backup and restore drill contract',
    exists('scripts/backup-pilot.cmd') &&
      includesAll(rootPackage, ['"backup:pilot"', 'scripts/backup-pilot.cmd']) &&
      includesAll(backupScript, ['mysqldump', 'Compress-Archive', 'manifest.json', 'MANUAL_ACTIONS.txt']) &&
      includesAll(backupRunbook, ['封闭试点备份恢复演练', 'npm run backup:pilot', 'database.sql', 'uploads.zip', '恢复演练']) &&
      includesAll(checklist, ['管理端健康检查']),
    'pilot backup script and restore runbook'
  );

  addCheck(
    'manual security checklist covers pilot risks',
    exists('docs/封闭试点安全验证清单.md') &&
      includesAll(securityChecklist, [
        'KINECHO_FAMILY_SCOPE_SESSION_REQUIRED=true',
        'KINECHO_PHONE_SUFFIX_LOGIN_ENABLED=false',
        'SEC-01',
        'SEC-02',
        'SEC-03',
        'SEC-06',
        'SEC-10',
        'SEC-13',
        'SEC-15',
        'SEC-18',
        '跨家庭',
        '未登录',
        'Token',
        '上传',
        '隐私',
      ]),
    'security checklist should cover cross-family access, unauthenticated access, token, upload, and privacy audit cases'
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
      (includesAll(appYml, ['bailian-chat-model: qwen-turbo', 'bailian-chat-timeout-seconds: 10']) ||
        includesAll(appYml, ['KINECHO_BAILIAN_CHAT_MODEL:qwen-turbo', 'KINECHO_BAILIAN_CHAT_TIMEOUT_SECONDS:10'])) &&
      includesAll(appYml, ['bailian-tts-timeout-seconds: 4']) &&
      includesAll(aiCompanionServiceClient, ['AI_CHAT_TIMEOUT = 18000', 'AI_VOICE_CHAT_TIMEOUT = 120000']),
    'AI chat should wait for provider while still degrading before miniapp timeout'
  );

  addCheck(
    'ai companion crisis escalation contract',
    includesAll(userController, ['@RequestParam(required = false) String family_id', '@RequestParam(required = false) Long elderly_id']) &&
      includesAll(userService, ['hasAiCrisisSignal', 'aiCrisisResponse', 'ai_crisis', 'insertAlert(alert, "ai_companion")', 'ai_crisis_detected']) &&
      includesAll(aiCompanionServiceClient, ['getElderlySession', 'family_id: session.familyId', 'elderly_id: session.elderlyId', 'crisis_detected']),
    'AI companion should create a high-risk family/service alert before normal chat fallback'
  );

  addCheck(
    'service backend aggregate contract',
    includesAll(userService, ['getServiceTasks', 'getServiceCases', 'getServiceCaseDetail', 'getServiceFollowups', 'createServiceFollowup', 'createServiceRecord']),
    'KinEchoApiService.java'
  );

  addCheck(
    'consultation lifecycle family contract',
    includesAll(userService, [
      'validateConsultationLifecycle',
      'attachConsultationFamilySummary',
      'family_visible_summary',
      'only scheduled consultations can be rescheduled',
      'cancellation reason is required',
    ]) &&
      includesAll(familyService, ['status_label', 'family_visible_summary', 'next_action', 'can_cancel', 'can_reschedule']) &&
      includesAll(userController, ['ConsultationCreateRequest', 'ConsultationUpdateRequest']) &&
      includesAll(consultationCreateDto, ['record ConsultationCreateRequest', '@Schema', '@NotBlank', 'notify_service', 'concern_level', 'toMap()']) &&
      includesAll(consultationUpdateDto, ['record ConsultationUpdateRequest', '@Schema', '@Pattern', 'cancel_reason', 'toMap()']) &&
      includesAll(familyCounselingPage, ['family_visible_summary', 'next_action', 'status_label', 'can_reschedule', 'can_cancel']) &&
      includesAll(serviceService, ['statusLabel', 'familyVisibleSummary', 'nextAction', 'canCancel', 'canReschedule']) &&
      includesAll(serviceWorkspacePage, ['familyVisibleSummary', 'nextAction']) &&
      includesAll(serviceFollowupPage, ['getFollowupStatusLabel', 'getFollowupActionLabel', 'familyVisibleSummary']) &&
      includesAll(serviceConsultationsPage, ['getConsultationStatusLabel', 'getConsultationActionLabel', 'familyVisibleSummary']),
    'consultation status rules and family visible summaries'
  );

  addCheck(
    'counselor availability booking contract',
    includesAll(userService, [
      'attachCounselorAvailabilitySummary',
      'validateCounselorBooking',
      'available_slot_count',
      'next_available_text',
      'counselor slot is already booked',
      'counselor is not available',
    ]) &&
      includesAll(familyService, ['availability_text', 'available_slot_count', 'next_available_text']) &&
      includesAll(elderlyService, ['availability_text', 'available_slot_count', 'next_available_text']) &&
      includesAll(familyCounselingPage, ['next_available_text', 'availability_text']) &&
      includesAll(elderlyCounselorListPage, ['next_available_text', 'availability_text']) &&
      includesAll(elderlyCounselorDetailPage, ['next_available_text']),
    'counselor slots should be visible and double booking should be rejected'
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

  addCheck(
    'manual smoke checklist covers real-device abnormal paths',
    includesAll(checklist, ['真机与异常场景', '大字体', '高对比', '录音权限拒绝', '摄像头权限拒绝', '弱网请求', '离线恢复', '语音播放失败']),
    'docs/小程序关键路径冒烟测试清单.md'
  );

  addCheck(
    'daily pilot operations checklist covers phase 5 metrics',
    exists('docs/封闭试点每日运营检查表.md') &&
      includesAll(dailyOpsChecklist, ['高风险工单', 'AI 失败率', '老人使用率', '家属查看率', '咨询完成率', '随访完成率', '隐私请求积压', '升级规则']),
    'closed pilot daily operations checklist'
  );

  addCheck(
    'pilot roster freeze template covers required participants',
    exists('docs/首批试点名单冻结模板.md') &&
      includesAll(pilotRosterTemplate, ['试点家庭', '服务人员', '咨询师', '管理员', '冻结确认', '10-30 户真实家庭', 'SLA', '可预约时段']),
    'closed pilot roster freeze template'
  );

  addCheck(
    'plan completion audit records remaining blockers',
    exists('docs/PLAN完成审计.md') &&
      includesAll(planAudit, ['审计结论', '交付项对照', '当前发布门禁', '本轮跳过项', '完成判定', '跳过提供真实试点名单以及目标环境参数', '微信生产登录', '真机', '安全验证', '备份恢复演练']),
    'PLAN completion audit should map evidence and remaining blockers'
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
