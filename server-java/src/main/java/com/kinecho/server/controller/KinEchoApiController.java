package com.kinecho.server.controller;

import com.kinecho.server.controller.dto.AdminAuthAccountCreateRequest;
import com.kinecho.server.controller.dto.AdminAuthAccountUpdateRequest;
import com.kinecho.server.controller.dto.AdminCounselorUpdateRequest;
import com.kinecho.server.controller.dto.AdminPsychologyQuestionCreateRequest;
import com.kinecho.server.controller.dto.AdminPsychologyQuestionUpdateRequest;
import com.kinecho.server.controller.dto.AdminPsychologyVideoCreateRequest;
import com.kinecho.server.controller.dto.AdminPsychologyVideoUpdateRequest;
import com.kinecho.server.controller.dto.ConsentRecordCreateRequest;
import com.kinecho.server.controller.dto.ConsultationCreateRequest;
import com.kinecho.server.controller.dto.ConsultationUpdateRequest;
import com.kinecho.server.controller.dto.ElderlyAlertCreateRequest;
import com.kinecho.server.controller.dto.ElderlyMoodCreateRequest;
import com.kinecho.server.controller.dto.FamilyAlertCreateRequest;
import com.kinecho.server.controller.dto.FamilyAlertHandleRequest;
import com.kinecho.server.controller.dto.FamilyAlertReplyRequest;
import com.kinecho.server.controller.dto.FamilyBindByCodeRequest;
import com.kinecho.server.controller.dto.FamilyMessageCreateRequest;
import com.kinecho.server.controller.dto.MediaFeedbackRequest;
import com.kinecho.server.controller.dto.MediaPlayRecordRequest;
import com.kinecho.server.controller.dto.MediaUpdateRequest;
import com.kinecho.server.controller.dto.PrivacyRequestCreateRequest;
import com.kinecho.server.controller.dto.PrivacyRequestReviewRequest;
import com.kinecho.server.controller.dto.ScheduleCreateRequest;
import com.kinecho.server.controller.dto.ScheduleStatusRequest;
import com.kinecho.server.controller.dto.ScheduleUpdateRequest;
import com.kinecho.server.controller.dto.ServiceCertificationReviewRequest;
import com.kinecho.server.controller.dto.ServiceCertificationSubmitRequest;
import com.kinecho.server.controller.dto.ServiceFollowupCreateRequest;
import com.kinecho.server.controller.dto.ServiceFollowupStatusRequest;
import com.kinecho.server.controller.dto.ServiceRecordCreateRequest;
import com.kinecho.server.controller.dto.UserCreateRequest;
import com.kinecho.server.controller.dto.UserUpdateRequest;
import com.kinecho.server.service.KinEchoApiService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class KinEchoApiController {
    private final KinEchoApiService service;

    public KinEchoApiController(KinEchoApiService service) {
        this.service = service;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> data) {
        return service.login(data);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@RequestHeader(value = "X-KinEcho-Session", required = false) String sessionToken,
                                                  @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.me(sessionToken, authorization);
    }

    @PostMapping("/auth/wechat-login")
    public ResponseEntity<Map<String, Object>> wechatLogin(@RequestBody Map<String, Object> data) {
        return service.wechatLogin(data);
    }

    @PostMapping("/auth/wechat-openid")
    public ResponseEntity<Map<String, Object>> wechatOpenid(@RequestBody Map<String, Object> data) {
        return service.wechatOpenid(data);
    }

    @GetMapping("/auth/wechat-identity")
    public ResponseEntity<Map<String, Object>> wechatIdentity(@RequestParam String openid) {
        return service.wechatIdentity(openid);
    }

    @PostMapping("/auth/service-certification")
    public ResponseEntity<Map<String, Object>> serviceCertification(@Valid @RequestBody(required = false) ServiceCertificationSubmitRequest data) {
        return service.submitServiceCertification(data == null ? null : data.toMap());
    }

    @GetMapping("/admin/service-certifications")
    public ResponseEntity<Map<String, Object>> getServiceCertifications(@RequestParam(required = false) String status,
                                                                        @RequestParam(defaultValue = "100") int limit) {
        return service.getServiceCertifications(status, limit);
    }

    @PutMapping("/admin/service-certifications/{certificationId}")
    public ResponseEntity<Map<String, Object>> reviewServiceCertification(@PathVariable long certificationId,
                                                                          @Valid @RequestBody(required = false) ServiceCertificationReviewRequest data) {
        return service.reviewServiceCertification(certificationId, data == null ? null : data.toMap());
    }

    @GetMapping("/admin/privacy/requests")
    public ResponseEntity<Map<String, Object>> getPrivacyRequests(@RequestParam(required = false) String family_id,
                                                                  @RequestParam(required = false) String status,
                                                                  @RequestParam(defaultValue = "100") int limit) {
        return service.getPrivacyRequests(family_id, status, limit);
    }

    @PutMapping("/admin/privacy/requests/{requestId}")
    public ResponseEntity<Map<String, Object>> reviewPrivacyRequest(@PathVariable long requestId,
                                                                    @Valid @RequestBody(required = false) PrivacyRequestReviewRequest data) {
        return service.reviewPrivacyRequest(requestId, data == null ? null : data.toMap());
    }

    @GetMapping("/admin/auth/accounts")
    public ResponseEntity<Map<String, Object>> getAdminAuthAccounts(@RequestParam(required = false) String role,
                                                                    @RequestParam(required = false) String family_id,
                                                                    @RequestParam(required = false) String status,
                                                                    @RequestParam(defaultValue = "100") int limit,
                                                                    @RequestHeader(value = "X-KinEcho-Session", required = false) String sessionToken,
                                                                    @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.getAdminAuthAccounts(role, family_id, status, limit, sessionToken, authorization);
    }

    @PostMapping("/admin/auth/accounts")
    public ResponseEntity<Map<String, Object>> createAdminAuthAccount(@Valid @RequestBody(required = false) AdminAuthAccountCreateRequest data,
                                                                      @RequestHeader(value = "X-KinEcho-Session", required = false) String sessionToken,
                                                                      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.createAdminAuthAccount(data == null ? null : data.toMap(), sessionToken, authorization);
    }

    @PutMapping("/admin/auth/accounts/{accountId}")
    public ResponseEntity<Map<String, Object>> updateAdminAuthAccount(@PathVariable long accountId,
                                                                      @Valid @RequestBody(required = false) AdminAuthAccountUpdateRequest data,
                                                                      @RequestHeader(value = "X-KinEcho-Session", required = false) String sessionToken,
                                                                      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return service.updateAdminAuthAccount(accountId, data == null ? null : data.toMap(), sessionToken, authorization);
    }

    @GetMapping("/family/schedules")
    public ResponseEntity<Map<String, Object>> getFamilySchedules(@RequestParam(required = false) String family_id) {
        return service.getFamilySchedules(family_id);
    }

    @PostMapping("/family/schedules")
    public ResponseEntity<Map<String, Object>> createSchedule(@Valid @RequestBody(required = false) ScheduleCreateRequest data) {
        return service.createSchedule(data == null ? Map.of() : data.toMap());
    }

    @PutMapping("/family/schedules/{scheduleId}")
    public ResponseEntity<Map<String, Object>> updateSchedule(@PathVariable long scheduleId,
                                                              @Valid @RequestBody(required = false) ScheduleUpdateRequest data) {
        return service.updateSchedule(scheduleId, data == null ? Map.of() : data.toMap());
    }

    @DeleteMapping("/family/schedules/{scheduleId}")
    public ResponseEntity<Map<String, Object>> deleteSchedule(@PathVariable long scheduleId,
                                                              @RequestParam(required = false) String family_id) {
        return service.deleteSchedule(scheduleId, family_id);
    }

    @GetMapping("/family/alerts")
    public ResponseEntity<Map<String, Object>> getFamilyAlerts(@RequestParam Map<String, String> params) {
        return service.getFamilyAlerts(params);
    }

    @PostMapping("/family/alerts")
    public ResponseEntity<Map<String, Object>> createAlert(@Valid @RequestBody(required = false) FamilyAlertCreateRequest data) {
        return service.createAlert(data == null ? Map.of() : data.toMap());
    }

    @PostMapping("/family/alerts/{alertId}/handle")
    public ResponseEntity<Map<String, Object>> handleAlert(@PathVariable long alertId,
                                                           @Valid @RequestBody(required = false) FamilyAlertHandleRequest data) {
        return service.handleAlert(alertId, data == null ? Map.of() : data.toMap());
    }

    @PostMapping("/family/alerts/{alertId}/read")
    public ResponseEntity<Map<String, Object>> markAlertRead(@PathVariable long alertId,
                                                             @RequestParam(required = false) String family_id) {
        return service.markAlertRead(alertId, family_id);
    }

    @PostMapping("/family/alerts/{alertId}/reply")
    public ResponseEntity<Map<String, Object>> replyAlert(@PathVariable long alertId,
                                                          @Valid @RequestBody(required = false) FamilyAlertReplyRequest data) {
        return service.replyAlert(alertId, data == null ? Map.of() : data.toMap());
    }

    @DeleteMapping("/family/alerts/{alertId}")
    public ResponseEntity<Map<String, Object>> deleteAlert(@PathVariable long alertId,
                                                           @RequestParam(required = false) String family_id) {
        return service.deleteAlert(alertId, family_id);
    }

    @GetMapping("/family/alerts/stats")
    public ResponseEntity<Map<String, Object>> getAlertStats(@RequestParam(required = false) String family_id) {
        return service.getAlertStats(family_id);
    }

    @GetMapping("/family/messages")
    public ResponseEntity<Map<String, Object>> getFamilyMessages(@RequestParam(required = false) String family_id) {
        return service.getFamilyMessages(family_id);
    }

    @PostMapping("/family/messages")
    public ResponseEntity<Map<String, Object>> createMessage(@Valid @RequestBody(required = false) FamilyMessageCreateRequest data) {
        return service.createMessage(data == null ? Map.of() : data.toMap());
    }

    @DeleteMapping("/family/messages/{messageId}")
    public ResponseEntity<Map<String, Object>> deleteMessage(@PathVariable long messageId,
                                                             @RequestParam(required = false) String family_id) {
        return service.deleteMessage(messageId, family_id);
    }

    @GetMapping("/elderly/messages")
    public ResponseEntity<Map<String, Object>> getElderlyMessages(@RequestParam(required = false) String family_id) {
        return service.getElderlyMessages(family_id);
    }

    @GetMapping("/elderly/messages/pending")
    public ResponseEntity<Map<String, Object>> getPendingMessages(@RequestParam(required = false) String family_id) {
        return service.getPendingMessages(family_id);
    }

    @PostMapping("/elderly/messages/{messageId}/play")
    public ResponseEntity<Map<String, Object>> playMessage(@PathVariable long messageId) {
        return service.playMessage(messageId);
    }

    @PostMapping("/elderly/messages/{messageId}/like")
    public ResponseEntity<Map<String, Object>> likeMessage(@PathVariable long messageId) {
        return service.likeMessage(messageId);
    }

    @PostMapping("/elderly/messages/{messageId}/unlike")
    public ResponseEntity<Map<String, Object>> unlikeMessage(@PathVariable long messageId) {
        return service.unlikeMessage(messageId);
    }

    @PostMapping("/elderly/alerts")
    public ResponseEntity<Map<String, Object>> createElderlyAlert(@Valid @RequestBody(required = false) ElderlyAlertCreateRequest data) {
        return service.createElderlyAlert(data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/elderly/alerts/replies")
    public ResponseEntity<Map<String, Object>> getElderlyAlertReplies(@RequestParam Map<String, String> params) {
        return service.getElderlyAlertReplies(params);
    }

    @PostMapping("/elderly/moods")
    public ResponseEntity<Map<String, Object>> createMood(@Valid @RequestBody(required = false) ElderlyMoodCreateRequest data) {
        return service.createMood(data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/elderly/moods")
    public ResponseEntity<Map<String, Object>> getElderlyMoods(@RequestParam Map<String, String> params) {
        return service.getElderlyMoods(params);
    }

    @GetMapping("/elderly/moods/today")
    public ResponseEntity<Map<String, Object>> getTodayMoods(@RequestParam Map<String, String> params) {
        return service.getTodayMoods(params);
    }

    @GetMapping("/elderly/moods/latest")
    public ResponseEntity<Map<String, Object>> getLatestMood(@RequestParam Map<String, String> params) {
        return service.getLatestMood(params);
    }

    @GetMapping("/elderly/profile-stats")
    public ResponseEntity<Map<String, Object>> getElderlyProfileStats(@RequestParam(required = false) String family_id,
                                                                      @RequestParam(required = false) Long elderly_id) {
        return service.getElderlyProfileStats(family_id, elderly_id);
    }

    @GetMapping("/elderly/weather")
    public ResponseEntity<Map<String, Object>> getWeather(@RequestParam Map<String, String> params) {
        return service.getWeather(params);
    }

    @GetMapping("/family/moods")
    public ResponseEntity<Map<String, Object>> getFamilyMoods(@RequestParam Map<String, String> params) {
        return service.getFamilyMoods(params);
    }

    @GetMapping("/family/moods/stats")
    public ResponseEntity<Map<String, Object>> getMoodStats(@RequestParam Map<String, String> params) {
        return service.getMoodStats(params);
    }

    @GetMapping("/family/moods/trend")
    public ResponseEntity<Map<String, Object>> getMoodTrend(@RequestParam Map<String, String> params) {
        return service.getMoodTrend(params);
    }

    @GetMapping("/care/insight")
    public ResponseEntity<Map<String, Object>> getCareInsight(@RequestParam(required = false) String family_id,
                                                              @RequestParam(required = false) Long elderly_id) {
        return service.getCareInsight(family_id, elderly_id);
    }

    @PostMapping("/privacy/consents")
    public ResponseEntity<Map<String, Object>> recordConsent(@Valid @RequestBody(required = false) ConsentRecordCreateRequest data) {
        return service.recordConsent(data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/privacy/consents")
    public ResponseEntity<Map<String, Object>> getConsentRecords(@RequestParam(required = false) String family_id,
                                                                 @RequestParam(required = false) Long elderly_id) {
        return service.getConsentRecords(family_id, elderly_id);
    }

    @GetMapping("/privacy/export")
    public ResponseEntity<Map<String, Object>> exportFamilyData(@RequestParam(required = false) String family_id) {
        return service.exportFamilyData(family_id);
    }

    @PostMapping("/privacy/requests")
    public ResponseEntity<Map<String, Object>> createPrivacyRequest(@Valid @RequestBody(required = false) PrivacyRequestCreateRequest data) {
        return service.createPrivacyRequest(data == null ? null : data.toMap());
    }

    @PostMapping(value = "/elderly/mental-screenings/live", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> createLiveMentalScreening(@RequestPart("frame") MultipartFile frame,
                                                                         @RequestParam String family_id,
                                                                         @RequestParam(required = false) Long elderly_id,
                                                                         @RequestParam(defaultValue = "1") int frame_count,
                                                                         @RequestParam(defaultValue = "0") int completed_actions,
                                                                         @RequestParam(defaultValue = "0") int liveness_score,
                                                                         @RequestParam(defaultValue = "0") int quality_score,
                                                                         @RequestParam(defaultValue = "mental-screening-live-v1") String consent_version) {
        return service.createLiveMentalScreening(frame, family_id, elderly_id, frame_count, completed_actions, liveness_score, quality_score, consent_version);
    }

    @GetMapping("/mental-screenings/latest")
    public ResponseEntity<Map<String, Object>> getLatestMentalScreening(@RequestParam(required = false) String family_id,
                                                                        @RequestParam(required = false) Long elderly_id) {
        return service.getLatestMentalScreening(family_id, elderly_id);
    }

    @GetMapping("/mental-screenings")
    public ResponseEntity<Map<String, Object>> getMentalScreenings(@RequestParam(required = false) String family_id,
                                                                   @RequestParam(required = false) Long elderly_id,
                                                                   @RequestParam(defaultValue = "10") int limit) {
        return service.getMentalScreenings(family_id, elderly_id, limit);
    }

    @GetMapping("/family/interactions")
    public ResponseEntity<Map<String, Object>> getFamilyInteractions(@RequestParam(defaultValue = "User") String username,
                                                                         @RequestParam(defaultValue = "100") int limit) {
        return service.getFamilyInteractions(username, limit);
    }

    @PostMapping("/family/interactions/clear")
    public ResponseEntity<Map<String, Object>> clearFamilyInteractions(@RequestBody(required = false) Map<String, Object> data,
                                                                           @RequestParam(required = false) String username) {
        return service.clearFamilyInteractions(data, username);
    }

    @PostMapping("/get-msg")
    public ResponseEntity<Map<String, Object>> getMessagesCompat(@RequestBody(required = false) Map<String, Object> data) {
        return service.getMessagesCompat(data);
    }

    @GetMapping("/elderly/schedules/today")
    public ResponseEntity<Map<String, Object>> getTodaySchedules(@RequestParam(required = false) String family_id) {
        return service.getTodaySchedules(family_id);
    }

    @GetMapping("/elderly/schedules/history")
    public ResponseEntity<Map<String, Object>> getScheduleHistory(@RequestParam(required = false) String family_id,
                                                                      @RequestParam(defaultValue = "40") int limit) {
        return service.getScheduleHistory(family_id, limit);
    }

    @GetMapping("/elderly/schedules/upcoming")
    public ResponseEntity<Map<String, Object>> getUpcomingSchedules(@RequestParam(required = false) String family_id) {
        return service.getUpcomingSchedules(family_id);
    }

    @PostMapping("/elderly/reminders/{reminderId}/complete")
    public ResponseEntity<Map<String, Object>> completeReminder(@PathVariable long reminderId,
                                                                @RequestParam(required = false) String family_id) {
        return service.completeReminder(reminderId, family_id);
    }

    @PostMapping("/elderly/reminders/{reminderId}/dismiss")
    public ResponseEntity<Map<String, Object>> dismissReminder(@PathVariable long reminderId,
                                                               @RequestParam(required = false) String family_id) {
        return service.dismissReminder(reminderId, family_id);
    }

    @PostMapping("/elderly/schedules/{scheduleId}/status")
    public ResponseEntity<Map<String, Object>> updateScheduleStatus(@PathVariable long scheduleId,
                                                                    @Valid @RequestBody(required = false) ScheduleStatusRequest data) {
        return service.updateScheduleStatus(scheduleId, data == null ? Map.of() : data.toMap());
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(@Valid @RequestBody(required = false) UserCreateRequest data) {
        return service.createUser(data == null ? null : data.toMap());
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<Map<String, Object>> updateUser(@PathVariable long userId,
                                                          @Valid @RequestBody(required = false) UserUpdateRequest data) {
        return service.updateUser(userId, data == null ? null : data.toMap());
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable long userId,
                                                          @RequestParam String family_id,
                                                          @RequestParam(required = false) String operator) {
        return service.deleteUser(userId, family_id, operator);
    }

    @GetMapping("/users/{familyId}")
    public ResponseEntity<Map<String, Object>> getFamilyUsers(@PathVariable String familyId) {
        return service.getFamilyUsers(familyId);
    }

    @GetMapping("/users/{userId}/binding-code")
    public ResponseEntity<Map<String, Object>> getUserBindingCode(@PathVariable long userId,
                                                                  @RequestParam String family_id) {
        return service.getUserBindingCode(userId, family_id);
    }

    @PostMapping("/users/bind-by-code")
    public ResponseEntity<Map<String, Object>> bindFamilyByCode(@Valid @RequestBody(required = false) FamilyBindByCodeRequest data) {
        return service.bindFamilyByCode(data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/service/overview")
    public ResponseEntity<Map<String, Object>> getServiceOverview(@RequestParam(required = false) String family_id) {
        return service.getServiceOverview(family_id);
    }

    @GetMapping("/service/tasks")
    public ResponseEntity<Map<String, Object>> getServiceTasks(@RequestParam Map<String, String> params) {
        return service.getServiceTasks(params);
    }

    @PostMapping("/service/tasks/{alertId}/start")
    public ResponseEntity<Map<String, Object>> startServiceTask(@PathVariable long alertId) {
        return service.startServiceTask(alertId);
    }

    @PostMapping("/service/tasks/{alertId}/complete")
    public ResponseEntity<Map<String, Object>> completeServiceTask(@PathVariable long alertId,
                                                                   @RequestBody(required = false) Map<String, Object> data) {
        return service.completeServiceTask(alertId, data);
    }

    @GetMapping("/service/cases")
    public ResponseEntity<Map<String, Object>> getServiceCases(@RequestParam(required = false) String family_id) {
        return service.getServiceCases(family_id);
    }

    @GetMapping("/service/cases/{elderlyId}")
    public ResponseEntity<Map<String, Object>> getServiceCaseDetail(@PathVariable long elderlyId,
                                                                    @RequestParam(required = false) String family_id) {
        return service.getServiceCaseDetail(family_id, elderlyId);
    }

    @GetMapping("/service/followups")
    public ResponseEntity<Map<String, Object>> getServiceFollowups(@RequestParam Map<String, String> params) {
        return service.getServiceFollowups(params);
    }

    @PostMapping("/service/followups")
    public ResponseEntity<Map<String, Object>> createServiceFollowup(@Valid @RequestBody(required = false) ServiceFollowupCreateRequest data) {
        return service.createServiceFollowup(data == null ? null : data.toMap());
    }

    @PutMapping("/service/followups/{consultationId}/status")
    public ResponseEntity<Map<String, Object>> updateServiceFollowupStatus(@PathVariable long consultationId,
                                                                           @Valid @RequestBody(required = false) ServiceFollowupStatusRequest data) {
        return service.updateServiceFollowupStatus(consultationId, data == null ? null : data.toMap());
    }

    @PostMapping("/service/records")
    public ResponseEntity<Map<String, Object>> createServiceRecord(@Valid @RequestBody(required = false) ServiceRecordCreateRequest data) {
        return service.createServiceRecord(data == null ? null : data.toMap());
    }

    @GetMapping("/admin/service-summary")
    public ResponseEntity<Map<String, Object>> getAdminServiceSummary(@RequestParam(required = false) String family_id) {
        return service.getAdminServiceSummary(family_id);
    }

    @GetMapping("/admin/families")
    public ResponseEntity<Map<String, Object>> getAdminFamilies() {
        return service.getAdminFamilies();
    }

    @GetMapping("/admin/analytics")
    public ResponseEntity<Map<String, Object>> getAdminAnalytics(@RequestParam(required = false) String family_id,
                                                                 @RequestParam(defaultValue = "6") int months,
                                                                 @RequestParam(defaultValue = "7") int days) {
        return service.getAdminAnalytics(family_id, months, days);
    }

    @GetMapping("/admin/ops/metrics")
    public ResponseEntity<Map<String, Object>> getAdminOpsMetrics() {
        return service.getAdminOpsMetrics();
    }

    @GetMapping("/counselors")
    public ResponseEntity<Map<String, Object>> getCounselors() {
        return service.getCounselors();
    }

    @GetMapping("/admin/counselors")
    public ResponseEntity<Map<String, Object>> getAdminCounselors() {
        return service.getAdminCounselors();
    }

    @PutMapping("/admin/counselors/{counselorId}")
    public ResponseEntity<Map<String, Object>> updateAdminCounselor(@PathVariable long counselorId,
                                                                    @Valid @RequestBody(required = false) AdminCounselorUpdateRequest data) {
        return service.updateAdminCounselor(counselorId, data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/psychology/resources")
    public ResponseEntity<Map<String, Object>> getPsychologyResources() {
        return service.getPsychologyResources();
    }

    @PostMapping("/admin/psychology/videos")
    public ResponseEntity<Map<String, Object>> createAdminPsychologyVideo(@Valid @RequestBody(required = false) AdminPsychologyVideoCreateRequest data) {
        return service.createAdminPsychologyVideo(data == null ? Map.of() : data.toMap());
    }

    @PutMapping("/admin/psychology/videos/{videoId}")
    public ResponseEntity<Map<String, Object>> updateAdminPsychologyVideo(@PathVariable long videoId,
                                                                          @Valid @RequestBody(required = false) AdminPsychologyVideoUpdateRequest data) {
        return service.updateAdminPsychologyVideo(videoId, data == null ? Map.of() : data.toMap());
    }

    @PostMapping("/admin/psychology/questions")
    public ResponseEntity<Map<String, Object>> createAdminPsychologyQuestion(@Valid @RequestBody(required = false) AdminPsychologyQuestionCreateRequest data) {
        return service.createAdminPsychologyQuestion(data == null ? Map.of() : data.toMap());
    }

    @PutMapping("/admin/psychology/questions/{questionId}")
    public ResponseEntity<Map<String, Object>> updateAdminPsychologyQuestion(@PathVariable long questionId,
                                                                             @Valid @RequestBody(required = false) AdminPsychologyQuestionUpdateRequest data) {
        return service.updateAdminPsychologyQuestion(questionId, data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/psychology/questions/{questionId}")
    public ResponseEntity<Map<String, Object>> getPsychologyQuestion(@PathVariable long questionId) {
        return service.getPsychologyQuestion(questionId);
    }

    @GetMapping("/consultations")
    public ResponseEntity<Map<String, Object>> getConsultations(@RequestParam Map<String, String> params) {
        return service.getConsultations(params);
    }

    @PostMapping("/consultations")
    public ResponseEntity<Map<String, Object>> createConsultation(@Valid @RequestBody(required = false) ConsultationCreateRequest data) {
        return service.createConsultation(data == null ? null : data.toMap());
    }

    @PutMapping("/consultations/{consultationId}")
    public ResponseEntity<Map<String, Object>> updateConsultation(@PathVariable long consultationId,
                                                                  @Valid @RequestBody(required = false) ConsultationUpdateRequest data) {
        return service.updateConsultation(consultationId, data == null ? null : data.toMap());
    }

    @PostMapping(value = "/family/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadMedia(@RequestPart("file") MultipartFile file,
                                                               @RequestParam String family_id,
                                                               @RequestParam String title,
                                                               @RequestParam(defaultValue = "") String description,
                                                               @RequestParam(required = false) Long uploaded_by) {
        return service.uploadMedia(file, family_id, title, description, uploaded_by);
    }

    @GetMapping("/family/media")
    public ResponseEntity<Map<String, Object>> getFamilyMedia(@RequestParam(required = false) String family_id) {
        return service.getFamilyMedia(family_id);
    }

    @GetMapping("/family/media/{mediaId}")
    public ResponseEntity<Map<String, Object>> getMediaDetail(@PathVariable long mediaId,
                                                              @RequestParam(required = false) String family_id) {
        return service.getMediaDetail(mediaId, family_id);
    }

    @GetMapping("/family/media/{mediaId}/file")
    public ResponseEntity<?> downloadMediaFile(@PathVariable long mediaId,
                                               @RequestParam(required = false) String family_id) {
        return service.downloadMediaAsset(mediaId, family_id, false);
    }

    @GetMapping("/family/media/{mediaId}/thumbnail")
    public ResponseEntity<?> downloadMediaThumbnail(@PathVariable long mediaId,
                                                    @RequestParam(required = false) String family_id) {
        return service.downloadMediaAsset(mediaId, family_id, true);
    }

    @GetMapping("/ai/audio/{filename:.+}")
    public ResponseEntity<?> downloadAiAudio(@PathVariable String filename,
                                             @RequestParam(required = false) String token) {
        return service.downloadAiAudio(filename, token);
    }

    @GetMapping("/ai/voice-upload/{filename:.+}")
    public ResponseEntity<?> downloadAiVoiceUpload(@PathVariable String filename,
                                                   @RequestParam(required = false) String token) {
        return service.downloadAiVoiceUpload(filename, token);
    }

    @PutMapping("/family/media/{mediaId}")
    public ResponseEntity<Map<String, Object>> updateMedia(@PathVariable long mediaId,
                                                           @Valid @RequestBody(required = false) MediaUpdateRequest data) {
        return service.updateMedia(mediaId, data == null ? Map.of() : data.toMap());
    }

    @DeleteMapping("/family/media/{mediaId}")
    public ResponseEntity<Map<String, Object>> deleteMedia(@PathVariable long mediaId,
                                                           @RequestParam(required = false) String family_id) {
        return service.deleteMedia(mediaId, family_id);
    }

    @GetMapping("/elderly/media/recommended")
    public ResponseEntity<Map<String, Object>> getRecommendedMedia(@RequestParam Map<String, String> params) {
        return service.getRecommendedMedia(params);
    }

    @PostMapping("/elderly/media/{mediaId}/play")
    public ResponseEntity<Map<String, Object>> recordMediaPlay(@PathVariable long mediaId,
                                                               @Valid @RequestBody(required = false) MediaPlayRecordRequest data) {
        return service.recordMediaPlay(mediaId, data == null ? Map.of() : data.toMap());
    }

    @PostMapping("/elderly/media/{mediaId}/feedback")
    public ResponseEntity<Map<String, Object>> submitMediaFeedback(@PathVariable long mediaId,
                                                                   @Valid @RequestBody(required = false) MediaFeedbackRequest data) {
        return service.submitMediaFeedback(mediaId, data == null ? Map.of() : data.toMap());
    }

    @GetMapping("/elderly/media/history")
    public ResponseEntity<Map<String, Object>> getMediaHistory(@RequestParam(required = false) Long elderly_id,
                                                                   @RequestParam(defaultValue = "50") int limit) {
        return service.getMediaHistory(elderly_id, limit);
    }

    @GetMapping("/family/media/recent-plays")
    public ResponseEntity<Map<String, Object>> getRecentPlays(@RequestParam(required = false) String family_id,
                                                                  @RequestParam(defaultValue = "10") int limit) {
        return service.getRecentPlays(family_id, limit);
    }

    @PostMapping("/elderly/toast")
    public ResponseEntity<Map<String, Object>> createToast(@RequestBody Map<String, Object> data) {
        return service.createToast(data);
    }

    @GetMapping("/elderly/toast/poll")
    public ResponseEntity<Map<String, Object>> pollToast(@RequestParam(required = false) String family_id) {
        return service.pollToast(family_id);
    }

    @GetMapping("/elderly/toast/stream")
    public SseEmitter toastStream(@RequestParam String family_id) {
        return service.toastStream(family_id);
    }

    @PostMapping("/elderly/ai/chat")
    public ResponseEntity<Map<String, Object>> aiChat(@RequestBody(required = false) Map<String, Object> data,
                                                          @RequestHeader HttpHeaders headers) {
        return service.aiChat(data, headers);
    }

    @PostMapping(value = "/elderly/ai/voice-chat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> aiVoiceChat(@RequestPart(required = false) MultipartFile file,
                                                               @RequestPart(required = false) MultipartFile voice,
                                                               @RequestPart(required = false) MultipartFile audio,
                                                               @RequestParam(defaultValue = "User") String user,
                                                               @RequestParam(required = false) String family_id,
                                                               @RequestParam(required = false) Long elderly_id,
                                                               @RequestHeader HttpHeaders headers) {
        return service.aiVoiceChat(file, voice, audio, user, family_id, elderly_id, headers);
    }

    @PostMapping("/elderly/ai/speak")
    public ResponseEntity<Map<String, Object>> aiSpeak(@RequestBody(required = false) Map<String, Object> data,
                                                           @RequestHeader HttpHeaders headers) {
        return service.aiSpeak(data, headers);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return service.health();
    }

    @GetMapping("/admin/retention/summary")
    public ResponseEntity<Map<String, Object>> retentionSummary() {
        return service.retentionSummary();
    }
}
