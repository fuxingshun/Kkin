package com.kinecho.server.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class UploadSecurityValidator {
    private static final long MB = 1024L * 1024L;
    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of(
        "app", "bat", "cmd", "com", "dll", "exe", "hta", "html", "jar", "js", "jsp",
        "msi", "php", "ps1", "scr", "sh", "svg", "vbs", "war", "wsf", "xml", "zip"
    );
    private static final Map<String, List<String>> MIME_BY_EXTENSION = Map.ofEntries(
        Map.entry("jpg", List.of("image/jpeg")),
        Map.entry("jpeg", List.of("image/jpeg")),
        Map.entry("png", List.of("image/png")),
        Map.entry("gif", List.of("image/gif")),
        Map.entry("mp4", List.of("video/mp4", "application/mp4")),
        Map.entry("mov", List.of("video/quicktime", "video/mp4")),
        Map.entry("avi", List.of("video/x-msvideo", "video/avi")),
        Map.entry("mp3", List.of("audio/mpeg", "audio/mp3")),
        Map.entry("aac", List.of("audio/aac", "audio/aacp", "audio/mp4")),
        Map.entry("m4a", List.of("audio/mp4", "audio/x-m4a", "video/mp4")),
        Map.entry("wav", List.of("audio/wav", "audio/x-wav", "audio/wave")),
        Map.entry("webm", List.of("audio/webm", "video/webm")),
        Map.entry("ogg", List.of("audio/ogg", "application/ogg")),
        Map.entry("flac", List.of("audio/flac", "audio/x-flac"))
    );

    private UploadSecurityValidator() {
    }

    static Result validate(MultipartFile file, Profile profile) {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()) {
            return Result.reject("unsupported or empty file");
        }

        String filename = file.getOriginalFilename().trim();
        if (filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            return Result.reject("unsafe file name");
        }

        String extension = extension(filename);
        if (extension.isBlank() || DANGEROUS_EXTENSIONS.contains(extension) || !profile.extensions.contains(extension)) {
            return Result.reject("unsupported file extension");
        }

        long maxSize = profile.maxBytes(extension);
        if (file.getSize() <= 0 || file.getSize() > maxSize) {
            return Result.reject("file size exceeds " + (maxSize / MB) + "MB limit");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (!contentType.isBlank() && !"application/octet-stream".equals(contentType)) {
            List<String> allowedMime = MIME_BY_EXTENSION.getOrDefault(extension, List.of());
            if (!allowedMime.contains(contentType)) {
                return Result.reject("file MIME type does not match extension");
            }
        }

        String magicType;
        try {
            magicType = detectMagicType(file);
        } catch (IOException error) {
            return Result.reject("file header could not be read");
        }
        if (magicType.startsWith("dangerous:")) {
            return Result.reject("dangerous file content is not allowed");
        }
        if ("unknown".equals(magicType) || !profile.magicTypes.contains(magicType) || !extensionMatchesMagic(extension, magicType)) {
            return Result.reject("file content does not match allowed type");
        }

        return Result.accept(extension, magicType);
    }

    static String extension(String filename) {
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String detectMagicType(MultipartFile file) throws IOException {
        byte[] header;
        try (InputStream input = file.getInputStream()) {
            header = input.readNBytes(64);
        }
        if (header.length < 4) {
            return "unknown";
        }
        if (startsWith(header, bytes(0x4D, 0x5A))) {
            return "dangerous:windows-executable";
        }
        if (startsWith(header, bytes(0x7F, 0x45, 0x4C, 0x46))) {
            return "dangerous:elf-executable";
        }
        String ascii = new String(header, 0, Math.min(header.length, 32), java.nio.charset.StandardCharsets.ISO_8859_1)
            .trim()
            .toLowerCase(Locale.ROOT);
        if (ascii.startsWith("#!") || ascii.startsWith("<!doctype html") || ascii.startsWith("<html") || ascii.startsWith("<?php")) {
            return "dangerous:script";
        }
        if (startsWith(header, bytes(0x50, 0x4B, 0x03, 0x04))) {
            return "dangerous:archive";
        }
        if (startsWith(header, bytes(0xFF, 0xD8, 0xFF))) {
            return "jpg";
        }
        if (startsWith(header, bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))) {
            return "png";
        }
        if (startsWith(header, "GIF87a") || startsWith(header, "GIF89a")) {
            return "gif";
        }
        if (header.length >= 12 && startsWith(header, 4, "ftyp")) {
            return "mp4";
        }
        if (startsWith(header, "RIFF") && startsWith(header, 8, "AVI ")) {
            return "avi";
        }
        if (startsWith(header, "RIFF") && startsWith(header, 8, "WAVE")) {
            return "wav";
        }
        if (header.length >= 2 && (header[0] & 0xFF) == 0xFF && (((header[1] & 0xF6) == 0xF0))) {
            return "aac";
        }
        if (startsWith(header, "ID3") || (header.length >= 2 && (header[0] & 0xFF) == 0xFF && (header[1] & 0xE0) == 0xE0)) {
            return "mp3";
        }
        if (startsWith(header, "OggS")) {
            return "ogg";
        }
        if (startsWith(header, "fLaC")) {
            return "flac";
        }
        if (startsWith(header, bytes(0x1A, 0x45, 0xDF, 0xA3))) {
            return "webm";
        }
        return "unknown";
    }

    private static boolean extensionMatchesMagic(String extension, String magicType) {
        if (extension.equals(magicType)) {
            return true;
        }
        return switch (magicType) {
            case "jpg" -> extension.equals("jpeg");
            case "mp4" -> List.of("mp4", "mov", "m4a").contains(extension);
            default -> false;
        };
    }

    private static String normalizeContentType(String value) {
        if (value == null) {
            return "";
        }
        int separator = value.indexOf(';');
        String type = separator >= 0 ? value.substring(0, separator) : value;
        return type.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean startsWith(byte[] value, String prefix) {
        return startsWith(value, 0, prefix);
    }

    private static boolean startsWith(byte[] value, int offset, String prefix) {
        byte[] bytes = prefix.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        if (value.length < offset + bytes.length) {
            return false;
        }
        for (int i = 0; i < bytes.length; i++) {
            if (value[offset + i] != bytes[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean startsWith(byte[] value, byte[] prefix) {
        if (value.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (value[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = (byte) values[i];
        }
        return result;
    }

    enum Profile {
        FAMILY_MEDIA(
            Set.of("jpg", "jpeg", "png", "gif", "mp4", "mov", "avi"),
            Set.of("jpg", "png", "gif", "mp4", "avi")
        ),
        MENTAL_FRAME(
            Set.of("jpg", "jpeg", "png"),
            Set.of("jpg", "png")
        ),
        VOICE_AUDIO(
            Set.of("mp3", "aac", "m4a", "wav", "webm", "ogg", "flac"),
            Set.of("mp3", "aac", "mp4", "wav", "webm", "ogg", "flac")
        );

        private final Set<String> extensions;
        private final Set<String> magicTypes;

        Profile(Set<String> extensions, Set<String> magicTypes) {
            this.extensions = extensions;
            this.magicTypes = magicTypes;
        }

        long maxBytes(String extension) {
            return switch (this) {
                case MENTAL_FRAME -> 3L * MB;
                case VOICE_AUDIO -> 25L * MB;
                case FAMILY_MEDIA -> List.of("mp4", "mov", "avi").contains(extension) ? 100L * MB : 10L * MB;
            };
        }
    }

    record Result(boolean accepted, String message, String extension, String magicType) {
        static Result accept(String extension, String magicType) {
            return new Result(true, "", extension, magicType);
        }

        static Result reject(String message) {
            return new Result(false, message, "", "");
        }
    }
}
