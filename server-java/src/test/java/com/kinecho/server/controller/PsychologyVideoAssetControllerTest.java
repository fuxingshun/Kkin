package com.kinecho.server.controller;

import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.service.KinEchoApiService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PsychologyVideoAssetControllerTest {
    @Test
    void rejectsPrivateVideoSource() throws Exception {
        KinEchoApiService service = mock(KinEchoApiService.class);
        when(service.psychologyVideoSource("demo")).thenReturn("http://127.0.0.1/private.mp4");
        PsychologyVideoAssetController controller = new PsychologyVideoAssetController(service, new KinEchoProperties());

        ResponseEntity<StreamingResponseBody> response = controller.streamVideo("demo", null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void rejectsHostOutsideAllowlist() throws Exception {
        KinEchoApiService service = mock(KinEchoApiService.class);
        when(service.psychologyVideoSource("demo")).thenReturn("https://untrusted.example.net/video.mp4");
        KinEchoProperties properties = new KinEchoProperties();
        properties.setPsychologyVideoAllowedHosts(List.of("media.example.com"));
        PsychologyVideoAssetController controller = new PsychologyVideoAssetController(service, properties);

        ResponseEntity<StreamingResponseBody> response = controller.streamVideo("demo", null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }
}
