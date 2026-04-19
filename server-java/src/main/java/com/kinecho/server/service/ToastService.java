package com.kinecho.server.service;

import com.kinecho.server.mapper.KinEchoMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ToastService {
    private final KinEchoMapper db;
    private final Map<String, Deque<Map<String, Object>>> pending = new ConcurrentHashMap<>();
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public ToastService(KinEchoMapper db) {
        this.db = db;
    }

    public Map<String, Object> create(String familyId, String type, String message, int duration) {
        Map<String, Object> toast = db.map(
            "id", System.currentTimeMillis(),
            "type", type == null || type.isBlank() ? "info" : type,
            "message", message,
            "duration", duration <= 0 ? 3000 : duration,
            "created_at", LocalDateTime.now().toString()
        );
        pending.computeIfAbsent(familyId, key -> new ArrayDeque<>()).add(toast);
        for (SseEmitter emitter : new ArrayList<>(emitters.getOrDefault(familyId, List.of()))) {
            try {
                emitter.send(SseEmitter.event().data(toast));
            } catch (IOException ex) {
                emitter.complete();
            }
        }
        return toast;
    }

    public Map<String, Object> poll(String familyId) {
        Deque<Map<String, Object>> queue = pending.get(familyId);
        Map<String, Object> toast = queue == null ? null : queue.pollFirst();
        return db.map("toast", toast);
    }

    public SseEmitter stream(String familyId) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(familyId, key -> new ArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(familyId, emitter));
        emitter.onTimeout(() -> remove(familyId, emitter));
        emitter.onError(error -> remove(familyId, emitter));
        try {
            emitter.send(SseEmitter.event().data(db.map("type", "connected")));
        } catch (IOException ex) {
            emitter.complete();
        }
        return emitter;
    }

    private void remove(String familyId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(familyId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                emitters.remove(familyId);
            }
        }
    }
}
