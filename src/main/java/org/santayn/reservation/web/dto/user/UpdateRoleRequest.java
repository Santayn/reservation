package org.santayn.reservation.web.dto.user;

import jakarta.validation.constraints.NotBlank;

/**
 * Запрос на смену роли пользователя.
 * Поддерживаемые значения: "ADMIN" или "USER".
 */
public record UpdateRoleRequest(
        @NotBlank String role
) {}
