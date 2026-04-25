package com.kinecho.server.controller;

import com.kinecho.server.service.KinEchoApiService;
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

    @GetMapping("/family/schedules")
    public ResponseEntity<Map<String, Object>> getFamilySchedules(@RequestParam(required = false) String family_id) {
        return service.getFamilySchedules(family_id);
    }

    @PostMapping("/family/schedules")
    public ResponseEntity<Map<String, Object>> createSchedule(@RequestBody Map<String, Object> data) {
        return service.createSchedule(data);
    }

    @PutMapping("/family/schedules/{scheduleId}")
    public ResponseEntity<Map<String, Object>> updateSchedule(@PathVariable long scheduleId, @RequestBody Map<String, Object> data) {
        return service.updateSchedule(scheduleId, data);
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
    public ResponseEntity<Map<String, Object>> createAlert(@RequestBody Map<String, Object> data) {
        return service.createAlert(data);
    }

    @PostMapping("/family/alerts/{alertId}/handle")
    public ResponseEntity<Map<String, Object>> handleAlert(@PathVariable long alertId, @RequestBody(required = false) Map<String, Object> data) {
        return service.handleAlert(alertId, data);
    }

    @PostMapping("/family/alerts/{alertId}/read")
    public ResponseEntity<Map<String, Object>> markAlertRead(@PathVariable long alertId,
                                                             @RequestParam(required = false) String family_id) {
        return service.markAlertRead(alertId, family_id);
    }

    @PostMapping("/family/alerts/{alertId}/reply")
    public ResponseEntity<Map<String, Object>> replyAlert(@PathVariable long alertId, @RequestBody Map<String, Object> data) {
        return service.replyAlert(alertId, data);
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
    public ResponseEntity<Map<String, Object>> createMessage(@RequestBody Map<String, Object> data) {
        return service.createMessage(data);
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
    public ResponseEntity<Map<String, Object>> createElderlyAlert(@RequestBody Map<String, Object> data) {
        return service.createElderlyAlert(data);
    }

    @GetMapping("/elderly/alerts/replies")
    public ResponseEntity<Map<String, Object>> getElderlyAlertReplies(@RequestParam Map<String, String> params) {
        return service.getElderlyAlertReplies(params);
    }

    @PostMapping("/elderly/moods")
    public ResponseEntity<Map<String, Object>> createMood(@RequestBody Map<String, Object> data) {
        return service.createMood(data);
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
    public ResponseEntity<Map<String, Object>> updateScheduleStatus(@PathVariable long scheduleId, @RequestBody Map<String, Object> data) {
        return service.updateScheduleStatus(scheduleId, data);
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, Object> data) {
        return service.createUser(data);
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<Map<String, Object>> updateUser(@PathVariable long userId, @RequestBody Map<String, Object> data) {
        return service.updateUser(userId, data);
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
    public ResponseEntity<Map<String, Object>> bindFamilyByCode(@RequestBody Map<String, Object> data) {
        return service.bindFamilyByCode(data);
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
    public ResponseEntity<Map<String, Object>> createServiceFollowup(@RequestBody Map<String, Object> data) {
        return service.createServiceFollowup(data);
    }

    @PutMapping("/service/followups/{consultationId}/status")
    public ResponseEntity<Map<String, Object>> updateServiceFollowupStatus(@PathVariable long consultationId,
                                                                           @RequestBody Map<String, Object> data) {
        return service.updateServiceFollowupStatus(consultationId, data);
    }

    @PostMapping("/service/records")
    public ResponseEntity<Map<String, Object>> createServiceRecord(@RequestBody Map<String, Object> data) {
        return service.createServiceRecord(data);
    }

    @GetMapping("/admin/service-summary")
    public ResponseEntity<Map<String, Object>> getAdminServiceSummary(@RequestParam(required = false) String family_id) {
        return service.getAdminServiceSummary(family_id);
    }

    @GetMapping("/admin/analytics")
    public ResponseEntity<Map<String, Object>> getAdminAnalytics(@RequestParam(required = false) String family_id,
                                                                 @RequestParam(defaultValue = "6") int months,
                                                                 @RequestParam(defaultValue = "7") int days) {
        return service.getAdminAnalytics(family_id, months, days);
    }

    @GetMapping("/counselors")
    public ResponseEntity<Map<String, Object>> getCounselors() {
        return service.getCounselors();
    }

    @GetMapping("/consultations")
    public ResponseEntity<Map<String, Object>> getConsultations(@RequestParam Map<String, String> params) {
        return service.getConsultations(params);
    }

    @PostMapping("/consultations")
    public ResponseEntity<Map<String, Object>> createConsultation(@RequestBody Map<String, Object> data) {
        return service.createConsultation(data);
    }

    @PutMapping("/consultations/{consultationId}")
    public ResponseEntity<Map<String, Object>> updateConsultation(@PathVariable long consultationId, @RequestBody Map<String, Object> data) {
        return service.updateConsultation(consultationId, data);
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

    @PutMapping("/family/media/{mediaId}")
    public ResponseEntity<Map<String, Object>> updateMedia(@PathVariable long mediaId, @RequestBody Map<String, Object> data) {
        return service.updateMedia(mediaId, data);
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
    public ResponseEntity<Map<String, Object>> recordMediaPlay(@PathVariable long mediaId, @RequestBody Map<String, Object> data) {
        return service.recordMediaPlay(mediaId, data);
    }

    @PostMapping("/elderly/media/{mediaId}/feedback")
    public ResponseEntity<Map<String, Object>> submitMediaFeedback(@PathVariable long mediaId, @RequestBody Map<String, Object> data) {
        return service.submitMediaFeedback(mediaId, data);
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
                                                               @RequestHeader HttpHeaders headers) {
        return service.aiVoiceChat(file, voice, audio, user, headers);
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
}
