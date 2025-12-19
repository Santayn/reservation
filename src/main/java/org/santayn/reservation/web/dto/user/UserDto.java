package org.santayn.reservation.web.dto.user;

/**
 * Короткое представление пользователя для списков.
 */
public record UserDto(
        Long id,
        String displayName, // у нас нет fullName, сюда можно подставить login
        String login,
        String role
) {}
