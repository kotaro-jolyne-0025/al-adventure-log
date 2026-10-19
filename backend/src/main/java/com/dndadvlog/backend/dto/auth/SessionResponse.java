package com.dndadvlog.backend.dto.auth;

import java.time.Instant;

public record SessionResponse(String id, Instant issuedAt, Instant expiresAt) {}
