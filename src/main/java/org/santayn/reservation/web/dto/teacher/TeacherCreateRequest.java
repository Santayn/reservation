package org.santayn.reservation.web.dto.teacher;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Создание преподавателя. В нашей модели преподаватель = User с admin=false.
 * Пароль передаётся в открытом виде и будет захеширован в сервисе.
 */
public record TeacherCreateRequest(
        @NotBlank String login,
        @NotBlank String password,
        @NotNull  Long facultyId
) {}
