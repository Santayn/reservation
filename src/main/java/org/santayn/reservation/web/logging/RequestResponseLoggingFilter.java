package org.santayn.reservation.web.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;

/**
 * Лёгкий логгер тела запросов/ответов для диагностики.
 * В проде держите на INFO, при проблемах — поднимайте до DEBUG.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RequestResponseLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestResponseLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {

        ContentCachingRequestWrapper request = new ContentCachingRequestWrapper(req);
        ContentCachingResponseWrapper response = new ContentCachingResponseWrapper(res);

        long start = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            long time = System.currentTimeMillis() - start;

            String method = request.getMethod();
            String uri = request.getRequestURI();
            String query = request.getQueryString();
            String body = new String(request.getContentAsByteArray(), StandardCharsets.UTF_8);

            StringBuilder headers = new StringBuilder();
            Enumeration<String> names = request.getHeaderNames();
            for (String n : Collections.list(names)) {
                headers.append(n).append(": ").append(request.getHeader(n)).append("; ");
            }

            String respBody = new String(response.getContentAsByteArray(), StandardCharsets.UTF_8);

            // ЛОГ
            log.info("HTTP {} {}{} | {} ms | headers=[{}] | reqBody={} | status={} | respBody={}",
                    method, uri, (query != null ? "?" + query : ""), time, headers, body, response.getStatus(), respBody);

            response.copyBodyToResponse();
        }
    }
}
