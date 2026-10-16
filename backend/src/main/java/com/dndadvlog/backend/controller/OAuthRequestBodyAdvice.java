package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.dto.auth.OAuthLoginRequest;
import com.dndadvlog.backend.dto.auth.OAuthRegisterRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;

@ControllerAdvice(assignableTypes = AuthController.class)
public class OAuthRequestBodyAdvice extends RequestBodyAdviceAdapter {
    private static final int MAX_BODY_BYTES = 64 * 1024;

    @Override
    public boolean supports(MethodParameter parameter, Type targetType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return targetType == OAuthLoginRequest.class || targetType == OAuthRegisterRequest.class;
    }

    @Override
    public HttpInputMessage beforeBodyRead(HttpInputMessage message, MethodParameter parameter, Type targetType,
                                          Class<? extends HttpMessageConverter<?>> converterType) throws IOException {
        if (message.getHeaders().getContentLength() > MAX_BODY_BYTES) {
            throw tooLarge();
        }
        // Bound actual reads as chunked requests may not declare Content-Length.
        byte[] body = message.getBody().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) {
            throw tooLarge();
        }
        return new HttpInputMessage() {
            @Override
            public InputStream getBody() {
                return new ByteArrayInputStream(body);
            }

            @Override
            public HttpHeaders getHeaders() {
                return message.getHeaders();
            }
        };
    }

    private ResponseStatusException tooLarge() {
        return new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "第三方登入請求內容過大");
    }
}
