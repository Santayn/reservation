package org.santayn.reservation.web.dto.faculty;

import jakarta.validation.constraints.NotBlank;

/** Запрос на создание факультета. */
public record FacultyCreateRequest(
        @NotBlank String name
) {}
