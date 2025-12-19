package org.santayn.reservation.web.dto.user;

/**
 * Информация о текущем пользователе.
 * firstName/lastName оставляем null, так как в нашей модели User их нет.
 */
public record UserMeDto(
        Long id,
        String firstName,
        String lastName,
        String login,
        String email,
        String role
) {}
