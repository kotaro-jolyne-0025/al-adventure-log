package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.AuthRateLimitState;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthRateLimitMapper {
    @Select("""
            INSERT INTO auth_rate_limits (rate_key, window_started_at, request_count, expires_at)
            VALUES (#{key}, clock_timestamp(), 1, clock_timestamp() + (#{windowSeconds} * INTERVAL '1 second'))
            ON CONFLICT (rate_key) DO UPDATE SET
                window_started_at = CASE
                    WHEN auth_rate_limits.expires_at <= clock_timestamp()
                      OR auth_rate_limits.blocked_until <= clock_timestamp() THEN clock_timestamp()
                    ELSE auth_rate_limits.window_started_at END,
                request_count = CASE
                    WHEN auth_rate_limits.expires_at <= clock_timestamp()
                      OR auth_rate_limits.blocked_until <= clock_timestamp() THEN 1
                    WHEN auth_rate_limits.blocked_until > clock_timestamp() THEN auth_rate_limits.request_count
                    ELSE auth_rate_limits.request_count + 1 END,
                blocked_until = CASE
                    WHEN auth_rate_limits.expires_at <= clock_timestamp()
                      OR auth_rate_limits.blocked_until <= clock_timestamp() THEN NULL
                    WHEN auth_rate_limits.blocked_until > clock_timestamp() THEN auth_rate_limits.blocked_until
                    WHEN auth_rate_limits.request_count + 1 > #{maximumRequests}
                        THEN clock_timestamp() + (#{cooldownSeconds} * INTERVAL '1 second')
                    ELSE NULL END,
                expires_at = CASE
                    WHEN auth_rate_limits.expires_at <= clock_timestamp()
                      OR auth_rate_limits.blocked_until <= clock_timestamp()
                        THEN clock_timestamp() + (#{windowSeconds} * INTERVAL '1 second')
                    WHEN auth_rate_limits.blocked_until > clock_timestamp()
                        THEN GREATEST(auth_rate_limits.expires_at,
                            auth_rate_limits.blocked_until + (#{windowSeconds} * INTERVAL '1 second'))
                    WHEN auth_rate_limits.request_count + 1 > #{maximumRequests}
                        THEN clock_timestamp() + ((#{cooldownSeconds} + #{windowSeconds}) * INTERVAL '1 second')
                    ELSE auth_rate_limits.expires_at END
            RETURNING blocked_until, (blocked_until IS NOT NULL) AS blocked
            """)
    AuthRateLimitState consume(@Param("key") String key,
                               @Param("maximumRequests") int maximumRequests,
                               @Param("windowSeconds") int windowSeconds,
                               @Param("cooldownSeconds") int cooldownSeconds);

    @Delete("""
            WITH expired AS (
                SELECT rate_key FROM auth_rate_limits
                WHERE expires_at <= clock_timestamp()
                ORDER BY expires_at
                LIMIT 500
            )
            DELETE FROM auth_rate_limits
            WHERE expires_at <= clock_timestamp()
              AND rate_key IN (SELECT rate_key FROM expired)
            """)
    int deleteExpiredBatch();
}
