package com.kinecho.server.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadSecurityValidatorTest {
    @Test
    void acceptsPngWithMatchingMimeAndMagic() {
        UploadSecurityValidator.Result result = UploadSecurityValidator.validate(
            file("frame.png", "image/png", bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3)),
            UploadSecurityValidator.Profile.MENTAL_FRAME
        );

        assertTrue(result.accepted());
    }

    @Test
    void rejectsContentSpoofedImage() {
        UploadSecurityValidator.Result result = UploadSecurityValidator.validate(
            file("photo.jpg", "image/jpeg", bytes(0x4D, 0x5A, 1, 2, 3, 4)),
            UploadSecurityValidator.Profile.FAMILY_MEDIA
        );

        assertFalse(result.accepted());
    }

    @Test
    void rejectsMimeExtensionMismatch() {
        UploadSecurityValidator.Result result = UploadSecurityValidator.validate(
            file("photo.jpg", "image/png", bytes(0xFF, 0xD8, 0xFF, 0x00, 0x01)),
            UploadSecurityValidator.Profile.FAMILY_MEDIA
        );

        assertFalse(result.accepted());
    }

    @Test
    void rejectsOversizedMentalFrame() {
        byte[] payload = new byte[3 * 1024 * 1024 + 1];
        byte[] header = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
        System.arraycopy(header, 0, payload, 0, header.length);

        UploadSecurityValidator.Result result = UploadSecurityValidator.validate(
            file("frame.png", "image/png", payload),
            UploadSecurityValidator.Profile.MENTAL_FRAME
        );

        assertFalse(result.accepted());
    }

    @Test
    void acceptsM4aWithMp4ContainerMagic() {
        byte[] payload = new byte[24];
        byte[] marker = new byte[] {0, 0, 0, 20, 'f', 't', 'y', 'p', 'M', '4', 'A', ' '};
        System.arraycopy(marker, 0, payload, 0, marker.length);

        UploadSecurityValidator.Result result = UploadSecurityValidator.validate(
            file("voice.m4a", "audio/mp4", payload),
            UploadSecurityValidator.Profile.VOICE_AUDIO
        );

        assertTrue(result.accepted());
    }

    private MockMultipartFile file(String filename, String contentType, byte[] bytes) {
        return new MockMultipartFile("file", filename, contentType, bytes);
    }

    private static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = (byte) values[i];
        }
        return result;
    }
}
