package com.kinecho.server.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
@ConfigurationProperties(prefix = "kinecho")
public class KinEchoProperties {
    public ZoneId zoneId = ZoneId.of("Asia/Shanghai");
    public boolean seedDemoData = false;
    public boolean apiTokenEnabled = false;
    public String apiToken = "";
    public String demoLoginPassword = "";
    public String serviceUsername = "service";
    public String servicePassword = "123456";
    public String serviceFamilyId = "family_001";
    public String serviceDisplayName = "服务专员";
    public String adminUsername = "admin";
    public String adminPassword = "123456";
    public String adminDisplayName = "平台管理员";
    public String wechatAppId = "";
    public String wechatAppSecret = "";
    public String serviceWechatOpenid = "";
    public String aiChatProvider = "bailian";
    public int aiAudioRetentionCount = 32;

    public String bailianApiKey = "";
    public String bailianApiBaseUrl = "https://dashscope.aliyuncs.com/api/v1";
    public String bailianCompatibleBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
    public String bailianSystemPrompt = "你是 KinEcho 的温和中文陪伴助手。请简短、自然、可靠地回应老人，避免诊断医疗问题，必要时提醒联系家属或专业人员。";
    public String bailianAsrModel = "paraformer-v2";
    public List<String> bailianAsrLanguageHints = new ArrayList<>(List.of("zh", "en"));
    public String bailianAsrFileBaseUrl = "";
    public int bailianAsrTimeoutSeconds = 90;
    public int bailianAsrPollIntervalMillis = 800;
    public String bailianChatModel = "qwen-turbo";
    public double bailianChatTemperature = 0.7;
    public int bailianChatMaxTokens = 240;
    public int bailianChatTimeoutSeconds = 10;
    public String bailianTtsModel = "qwen3-tts-flash";
    public String bailianTtsVoice = "Serena";
    public String bailianTtsLanguageType = "Chinese";
    public String bailianTtsFileExtension = "wav";
    public int bailianTtsTimeoutSeconds = 4;

    public boolean redisEnabled = false;
    public String redisHost = "127.0.0.1";
    public int redisPort = 6379;
    public String redisPassword = "";
    public int redisDatabase = 0;
    public int redisDefaultTtlSeconds = 300;

    public Path projectRoot;
    public Path serverDir;
    public Path uploadDir;
    public Path aiAudioDir;
    public Path aiVoiceUploadDir;

    private String projectRootPath = "";
    private String serverDirPath = "server";
    private String uploadDirPath = "server/uploads";
    private String aiAudioDirPath = "server/uploads/ai-audio";
    private String aiVoiceUploadDirPath = "server/uploads/ai-voice";

    @PostConstruct
    public void initializePaths() {
        Path detectedRoot = detectProjectRoot();
        projectRoot = resolvePath(projectRootPath, detectedRoot);
        serverDir = resolvePath(serverDirPath, projectRoot);
        uploadDir = resolvePath(uploadDirPath, projectRoot);
        aiAudioDir = resolvePath(aiAudioDirPath, projectRoot);
        aiVoiceUploadDir = resolvePath(aiVoiceUploadDirPath, projectRoot);

        aiChatProvider = valueOrDefault(aiChatProvider, "bailian").toLowerCase(Locale.ROOT);
        apiToken = valueOrDefault(apiToken, "");
        demoLoginPassword = valueOrDefault(demoLoginPassword, "");
        serviceUsername = valueOrDefault(serviceUsername, "service");
        servicePassword = valueOrDefault(servicePassword, "123456");
        serviceFamilyId = valueOrDefault(serviceFamilyId, "family_001");
        serviceDisplayName = valueOrDefault(serviceDisplayName, "服务专员");
        adminUsername = valueOrDefault(adminUsername, "admin");
        adminPassword = valueOrDefault(adminPassword, "123456");
        adminDisplayName = valueOrDefault(adminDisplayName, "平台管理员");
        wechatAppId = valueOrDefault(wechatAppId, "");
        wechatAppSecret = valueOrDefault(wechatAppSecret, "");
        serviceWechatOpenid = valueOrDefault(serviceWechatOpenid, "");
        bailianApiBaseUrl = trimTrailingSlash(bailianApiBaseUrl);
        bailianCompatibleBaseUrl = trimTrailingSlash(bailianCompatibleBaseUrl);
        bailianAsrFileBaseUrl = trimTrailingSlash(bailianAsrFileBaseUrl);
        bailianTtsFileExtension = valueOrDefault(bailianTtsFileExtension, "wav").replace(".", "").toLowerCase(Locale.ROOT);
    }

    public boolean isMysql() {
        return true;
    }

    public void setZoneId(String zoneId) {
        if (zoneId != null && !zoneId.isBlank()) {
            this.zoneId = ZoneId.of(zoneId.trim());
        }
    }

    public void setSeedDemoData(boolean seedDemoData) {
        this.seedDemoData = seedDemoData;
    }

    public void setApiTokenEnabled(boolean apiTokenEnabled) {
        this.apiTokenEnabled = apiTokenEnabled;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = valueOrDefault(apiToken, "");
    }

    public void setDemoLoginPassword(String demoLoginPassword) {
        this.demoLoginPassword = valueOrDefault(demoLoginPassword, this.demoLoginPassword);
    }

    public void setServiceUsername(String serviceUsername) {
        this.serviceUsername = valueOrDefault(serviceUsername, this.serviceUsername);
    }

    public void setServicePassword(String servicePassword) {
        this.servicePassword = valueOrDefault(servicePassword, this.servicePassword);
    }

    public void setServiceFamilyId(String serviceFamilyId) {
        this.serviceFamilyId = valueOrDefault(serviceFamilyId, this.serviceFamilyId);
    }

    public void setServiceDisplayName(String serviceDisplayName) {
        this.serviceDisplayName = valueOrDefault(serviceDisplayName, this.serviceDisplayName);
    }

    public void setAdminUsername(String adminUsername) {
        this.adminUsername = valueOrDefault(adminUsername, this.adminUsername);
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = valueOrDefault(adminPassword, this.adminPassword);
    }

    public void setAdminDisplayName(String adminDisplayName) {
        this.adminDisplayName = valueOrDefault(adminDisplayName, this.adminDisplayName);
    }

    public void setWechatAppId(String wechatAppId) {
        this.wechatAppId = valueOrDefault(wechatAppId, "");
    }

    public void setWechatAppSecret(String wechatAppSecret) {
        this.wechatAppSecret = valueOrDefault(wechatAppSecret, "");
    }

    public void setServiceWechatOpenid(String serviceWechatOpenid) {
        this.serviceWechatOpenid = valueOrDefault(serviceWechatOpenid, "");
    }

    public void setAiChatProvider(String aiChatProvider) {
        this.aiChatProvider = valueOrDefault(aiChatProvider, this.aiChatProvider);
    }

    public void setAiAudioRetentionCount(int aiAudioRetentionCount) {
        this.aiAudioRetentionCount = aiAudioRetentionCount;
    }

    public void setBailianApiKey(String bailianApiKey) {
        this.bailianApiKey = valueOrDefault(bailianApiKey, "");
    }

    public void setBailianApiBaseUrl(String bailianApiBaseUrl) {
        this.bailianApiBaseUrl = valueOrDefault(bailianApiBaseUrl, this.bailianApiBaseUrl);
    }

    public void setBailianCompatibleBaseUrl(String bailianCompatibleBaseUrl) {
        this.bailianCompatibleBaseUrl = valueOrDefault(bailianCompatibleBaseUrl, this.bailianCompatibleBaseUrl);
    }

    public void setBailianSystemPrompt(String bailianSystemPrompt) {
        this.bailianSystemPrompt = valueOrDefault(bailianSystemPrompt, this.bailianSystemPrompt);
    }

    public void setBailianAsrModel(String bailianAsrModel) {
        this.bailianAsrModel = valueOrDefault(bailianAsrModel, this.bailianAsrModel);
    }

    public void setBailianAsrLanguageHints(List<String> bailianAsrLanguageHints) {
        if (bailianAsrLanguageHints != null) {
            this.bailianAsrLanguageHints = bailianAsrLanguageHints;
        }
    }

    public void setBailianAsrFileBaseUrl(String bailianAsrFileBaseUrl) {
        this.bailianAsrFileBaseUrl = valueOrDefault(bailianAsrFileBaseUrl, "");
    }

    public void setBailianAsrTimeoutSeconds(int bailianAsrTimeoutSeconds) {
        this.bailianAsrTimeoutSeconds = bailianAsrTimeoutSeconds;
    }

    public void setBailianAsrPollIntervalMillis(int bailianAsrPollIntervalMillis) {
        this.bailianAsrPollIntervalMillis = bailianAsrPollIntervalMillis;
    }

    public void setBailianChatModel(String bailianChatModel) {
        this.bailianChatModel = valueOrDefault(bailianChatModel, this.bailianChatModel);
    }

    public void setBailianChatTemperature(double bailianChatTemperature) {
        this.bailianChatTemperature = bailianChatTemperature;
    }

    public void setBailianChatMaxTokens(int bailianChatMaxTokens) {
        this.bailianChatMaxTokens = bailianChatMaxTokens;
    }

    public void setBailianChatTimeoutSeconds(int bailianChatTimeoutSeconds) {
        this.bailianChatTimeoutSeconds = bailianChatTimeoutSeconds;
    }

    public void setBailianTtsModel(String bailianTtsModel) {
        this.bailianTtsModel = valueOrDefault(bailianTtsModel, this.bailianTtsModel);
    }

    public void setBailianTtsVoice(String bailianTtsVoice) {
        this.bailianTtsVoice = valueOrDefault(bailianTtsVoice, this.bailianTtsVoice);
    }

    public void setBailianTtsLanguageType(String bailianTtsLanguageType) {
        this.bailianTtsLanguageType = valueOrDefault(bailianTtsLanguageType, this.bailianTtsLanguageType);
    }

    public void setBailianTtsFileExtension(String bailianTtsFileExtension) {
        this.bailianTtsFileExtension = valueOrDefault(bailianTtsFileExtension, this.bailianTtsFileExtension);
    }

    public void setBailianTtsTimeoutSeconds(int bailianTtsTimeoutSeconds) {
        this.bailianTtsTimeoutSeconds = bailianTtsTimeoutSeconds;
    }

    public void setRedisEnabled(boolean redisEnabled) {
        this.redisEnabled = redisEnabled;
    }

    public void setRedisHost(String redisHost) {
        this.redisHost = valueOrDefault(redisHost, this.redisHost);
    }

    public void setRedisPort(int redisPort) {
        this.redisPort = redisPort;
    }

    public void setRedisPassword(String redisPassword) {
        this.redisPassword = valueOrDefault(redisPassword, "");
    }

    public void setRedisDatabase(int redisDatabase) {
        this.redisDatabase = redisDatabase;
    }

    public void setRedisDefaultTtlSeconds(int redisDefaultTtlSeconds) {
        this.redisDefaultTtlSeconds = redisDefaultTtlSeconds;
    }

    public void setProjectRoot(String projectRoot) {
        this.projectRootPath = valueOrDefault(projectRoot, "");
    }

    public void setServerDir(String serverDir) {
        this.serverDirPath = valueOrDefault(serverDir, this.serverDirPath);
    }

    public void setUploadDir(String uploadDir) {
        this.uploadDirPath = valueOrDefault(uploadDir, this.uploadDirPath);
    }

    public void setAiAudioDir(String aiAudioDir) {
        this.aiAudioDirPath = valueOrDefault(aiAudioDir, this.aiAudioDirPath);
    }

    public void setAiVoiceUploadDir(String aiVoiceUploadDir) {
        this.aiVoiceUploadDirPath = valueOrDefault(aiVoiceUploadDir, this.aiVoiceUploadDirPath);
    }

    private static Path detectProjectRoot() {
        Path cwd = Paths.get("").toAbsolutePath().normalize();
        if ("server-java".equalsIgnoreCase(cwd.getFileName().toString())) {
            Path parent = cwd.getParent();
            return parent == null ? cwd : parent;
        }
        return cwd;
    }

    private static Path resolvePath(String value, Path base) {
        String raw = valueOrDefault(value, "");
        if (raw.isBlank()) {
            return base.toAbsolutePath().normalize();
        }
        Path path = Paths.get(raw);
        if (!path.isAbsolute()) {
            path = base.resolve(path);
        }
        return path.toAbsolutePath().normalize();
    }

    private static String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String trimTrailingSlash(String value) {
        String result = valueOrDefault(value, "");
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }
}
