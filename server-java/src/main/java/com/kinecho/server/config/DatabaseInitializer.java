package com.kinecho.server.config;

import com.kinecho.server.mapper.KinEchoMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements ApplicationRunner {
    private final KinEchoMapper mapper;

    public DatabaseInitializer(KinEchoMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        mapper.initialize();
    }
}