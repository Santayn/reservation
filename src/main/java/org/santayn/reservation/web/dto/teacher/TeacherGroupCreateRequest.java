package org.santayn.reservation.web.dto.teacher;

import jakarta.validation.constraints.NotNull;

/**
 * Запрос на создание связи преподаватель ↔ группа.
 */
public record TeacherGroupCreateRequest(
        @NotNull Long teacherId,
        @NotNull Long groupId
) {}
