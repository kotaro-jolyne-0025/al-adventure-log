package com.dndadvlog.backend.entity;

import java.time.OffsetDateTime;

public class AuthRateLimitState {
    private OffsetDateTime blockedUntil;
    private boolean blocked;

    public OffsetDateTime getBlockedUntil() { return blockedUntil; }
    public void setBlockedUntil(OffsetDateTime blockedUntil) { this.blockedUntil = blockedUntil; }
    public boolean isBlocked() { return blocked; }
    public void setBlocked(boolean blocked) { this.blocked = blocked; }
}
