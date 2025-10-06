package org.santayn.reservation.web.dto.group;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Создание группы. facultyId опционален — если передан, создадим связь group↔faculty. */
public record GroupCreateRequest(
        @NotBlank String name,
        @NotNull @Min(1) Integer personsCount,
        Long facultyId
) {}
