package com.dndadvlog.backend.service;

import com.dndadvlog.backend.config.JwtTokenProvider;
import com.dndadvlog.backend.dto.auth.OAuthLoginRequest;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.auth.oauth2.GooglePublicKeysManager;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real JWT parsing/RSA verification; cache tests download certificates over loopback HTTP. */
class GoogleTokenVerificationTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static KeyPair trustedKey;
    private static KeyPair otherKey;
    private static String trustedCertificate;
    private static String otherCertificate;
    @TempDir
    static Path keyDirectory;
    private final UserMapper users = mock(UserMapper.class);
    private final UserOAuthAccountMapper accounts = mock(UserOAuthAccountMapper.class);
    private final OAuthService service = new OAuthService(users, accounts,
            new JwtTokenProvider("synthetic-test-key-at-least-32-bytes-long", 3600000),
            new OAuthAccountService(users, accounts));
    private int keyRequests;
    private volatile boolean keyServerUnavailable;
    private HttpServer keyServer;
    private volatile String servedCertificate;
    private final AtomicInteger httpKeyRequests = new AtomicInteger();

    @BeforeAll
    static void keys() throws Exception {
        Path storePath = keyDirectory.resolve("keys.p12");
        Path keytool = Path.of(System.getProperty("java.home"), "bin",
                System.getProperty("os.name").startsWith("Windows") ? "keytool.exe" : "keytool");
        for (String alias : List.of("trusted", "other")) {
            var process = new ProcessBuilder(keytool.toString(), "-genkeypair", "-alias", alias,
                    "-keyalg", "RSA", "-keysize", "2048", "-sigalg", "SHA256withRSA",
                    "-dname", "CN=OAuth cache test", "-validity", "1", "-storetype", "PKCS12",
                    "-keystore", storePath.toString(), "-storepass", "synthetic-test-password", "-noprompt")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD).start();
            if (!process.waitFor(20, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                fail("Test key generation timed out");
            }
            assertEquals(0, process.exitValue(), "Test key generation failed");
        }
        var store = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(storePath)) {
            store.load(input, "synthetic-test-password".toCharArray());
        }
        trustedKey = new KeyPair(store.getCertificate("trusted").getPublicKey(),
                (PrivateKey) store.getKey("trusted", "synthetic-test-password".toCharArray()));
        otherKey = new KeyPair(store.getCertificate("other").getPublicKey(),
                (PrivateKey) store.getKey("other", "synthetic-test-password".toCharArray()));
        trustedCertificate = certificatePem(store, "trusted");
        otherCertificate = certificatePem(store, "other");
    }

    private static String certificatePem(KeyStore store, String alias) throws Exception {
        return "-----BEGIN CERTIFICATE-----\n"
                + Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(store.getCertificate(alias).getEncoded())
                + "\n-----END CERTIFICATE-----\n";
    }

    @AfterEach
    void stopKeyServer() {
        if (keyServer != null) keyServer.stop(0);
    }

    @BeforeEach
    void configure() throws Exception {
        ReflectionTestUtils.setField(service, "googleClientId", "example-client");
        service.initializeGoogleIdTokenVerifier();
        var configured = (GoogleIdTokenVerifier) ReflectionTestUtils.getField(service, "googleIdTokenVerifier");
        assertIterableEquals(List.of("accounts.google.com", "https://accounts.google.com"), configured.getIssuers());
        assertIterableEquals(List.of("example-client"), configured.getAudience());
        GooglePublicKeysManager publicKeys = mock(GooglePublicKeysManager.class);
        when(publicKeys.getPublicKeys()).thenAnswer(invocation -> {
            keyRequests++;
            return List.of(trustedKey.getPublic());
        });
        ReflectionTestUtils.setField(service, "googleIdTokenVerifier", new GoogleIdTokenVerifier.Builder(publicKeys)
                .setIssuers(configured.getIssuers()).setAudience(configured.getAudience())
                .setClock(configured.getClock()).setAcceptableTimeSkewSeconds(configured.getAcceptableTimeSkewSeconds())
                .build());
    }

    @Test
    void acceptsSignedCredentialsFromBothGoogleIssuers() throws Exception {
        for (String issuer : List.of("accounts.google.com", "https://accounts.google.com")) {
            var claims = claims();
            claims.put("iss", issuer);
            var result = service.processOAuthLogin(request(signed(claims, trustedKey)));
            assertNull(result.user());
            assertNotNull(result.registrationToken());
        }
        assertEquals(2, keyRequests);
        verify(users, never()).insert(any());
    }

    @Test
    void rejectsSignatureFromAnotherKey() throws Exception {
        rejects(signed(claims(), otherKey));
    }

    @Test
    void rejectsModifiedPayloadWithOriginalSignature() throws Exception {
        String token = signed(claims(), trustedKey);
        var altered = claims();
        altered.put("sub", "different-account");
        String[] parts = token.split("\\.");
        rejects(parts[0] + "." + encode(JSON.writeValueAsBytes(altered)) + "." + parts[2]);
    }

    @ParameterizedTest
    @ValueSource(strings = {"iss", "aud", "exp", "iat", "sub", "email", "email_verified"})
    void rejectsMissingClaimsWithoutServerError(String field) throws Exception {
        var claims = claims();
        claims.remove(field);
        rejects(signed(claims, trustedKey));
    }

    @ParameterizedTest
    @ValueSource(strings = {"sub", "email", "exp", "iat"})
    void rejectsNullClaimsWithoutServerError(String field) throws Exception {
        var claims = claims();
        claims.put(field, null);
        rejects(signed(claims, trustedKey));
    }

    @ParameterizedTest
    @ValueSource(strings = {"aud", "iss", "exp", "iat", "email_verified"})
    void rejectsInvalidClaims(String field) throws Exception {
        var claims = claims();
        claims.put(field, switch (field) {
            case "aud" -> "another-client";
            case "iss" -> "https://example.invalid";
            case "exp" -> Instant.now().minusSeconds(1).getEpochSecond();
            case "iat" -> Instant.now().plusSeconds(3600).getEpochSecond();
            default -> false;
        });
        rejects(signed(claims, trustedKey));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-a-jwt", "a.b.c", "e30.e30.c2lnbmF0dXJl", "bnVsbA.bnVsbA.c2lnbmF0dXJl"})
    void rejectsMalformedTokensWithoutServerError(String token) {
        rejects(token);
        assertEquals(0, keyRequests);
    }

    @ParameterizedTest
    @ValueSource(longs = {780001, 1080001})
    void downloadsAndRotatesHttpCertificatesWithSameVerifier(long refreshTime) throws Exception {
        var clock = new AtomicLong(System.currentTimeMillis());
        long start = clock.get();
        GooglePublicKeysManager manager = useHttpKeyServer(clock);
        String firstToken = signed(claims(), trustedKey);
        assertNotNull(service.processOAuthLogin(request(firstToken)).registrationToken());
        assertEquals(1, httpKeyRequests.get());
        assertEquals(start + 1080000, manager.getExpirationTimeMilliseconds());

        // max-age 1200 minus Age 120 gives 1080 seconds; refresh starts 300 seconds early.
        servedCertificate = otherCertificate;
        clock.set(start + 779999);
        assertNotNull(service.processOAuthLogin(request(firstToken)).registrationToken());
        assertEquals(1, httpKeyRequests.get());

        clock.set(start + refreshTime);
        String rotatedToken = signed(claims(), otherKey);
        assertNotNull(service.processOAuthLogin(request(rotatedToken)).registrationToken());
        assertEquals(2, httpKeyRequests.get());
        assertEquals(clock.get() + 1080000, manager.getExpirationTimeMilliseconds());
        clearInvocations(users, accounts);
        rejects(firstToken);
        assertEquals(2, httpKeyRequests.get());
    }

    @Test
    void httpRefreshOutageRejectsLoginAndRecoversWithoutReplacingVerifier() throws Exception {
        var clock = new AtomicLong(System.currentTimeMillis());
        useHttpKeyServer(clock);
        String firstToken = signed(claims(), trustedKey);
        assertNotNull(service.processOAuthLogin(request(firstToken)).registrationToken());
        assertEquals(1, httpKeyRequests.get());

        clock.addAndGet(1080001);
        servedCertificate = otherCertificate;
        keyServerUnavailable = true;
        clearInvocations(users, accounts);
        rejects(firstToken);
        assertEquals(2, httpKeyRequests.get());

        keyServerUnavailable = false;
        assertNotNull(service.processOAuthLogin(request(signed(claims(), otherKey))).registrationToken());
        assertEquals(3, httpKeyRequests.get());
    }

    private GooglePublicKeysManager useHttpKeyServer(AtomicLong clock) throws IOException {
        servedCertificate = trustedCertificate;
        keyServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        keyServer.createContext("/certs", exchange -> {
            httpKeyRequests.incrementAndGet();
            try {
                if (keyServerUnavailable) {
                    exchange.sendResponseHeaders(503, -1);
                    return;
                }
                byte[] body = JSON.writeValueAsBytes(Map.of("test-key", servedCertificate));
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.getResponseHeaders().set("Cache-Control", "public, max-age=1200");
                exchange.getResponseHeaders().set("Age", "120");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } finally {
                exchange.close();
            }
        });
        keyServer.start();
        var manager = new GooglePublicKeysManager.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setPublicCertsEncodedUrl("http://127.0.0.1:" + keyServer.getAddress().getPort() + "/certs")
                .setClock(clock::get).build();
        // Only the key-cache clock advances; token validity still uses real time.
        ReflectionTestUtils.setField(service, "googleIdTokenVerifier", new GoogleIdTokenVerifier.Builder(manager)
                .setAudience(List.of("example-client"))
                .setIssuers(List.of("accounts.google.com", "https://accounts.google.com")).build());
        return manager;
    }

    @Test
    void missingConfigurationRejectsLoginBeforeAccessingAccounts() throws Exception {
        ReflectionTestUtils.setField(service, "googleClientId", "");
        rejects(signed(claims(), trustedKey));
        assertEquals(0, keyRequests);
    }

    private void rejects(String token) {
        var error = assertThrows(BusinessException.class, () -> service.processOAuthLogin(request(token)));
        assertFalse(error.getMessage().contains(token));
        verifyNoInteractions(users, accounts);
    }

    private static OAuthLoginRequest request(String token) {
        var request = new OAuthLoginRequest();
        request.setProvider("GOOGLE");
        request.setTokenOrCode(token);
        return request;
    }

    private static Map<String, Object> claims() {
        return new LinkedHashMap<>(Map.of("iss", "https://accounts.google.com", "aud", "example-client",
                "exp", Instant.now().plusSeconds(600).getEpochSecond(),
                "iat", Instant.now().minusSeconds(5).getEpochSecond(), "sub", "subject",
                "email", "player@example.invalid", "email_verified", true));
    }

    private static String signed(Map<String, Object> claims, KeyPair key) throws Exception {
        String content = encode(JSON.writeValueAsBytes(Map.of("alg", "RS256", "kid", "test-key")))
                + "." + encode(JSON.writeValueAsBytes(claims));
        var signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(key.getPrivate());
        signer.update(content.getBytes(StandardCharsets.US_ASCII));
        return content + "." + encode(signer.sign());
    }

    private static String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
}
